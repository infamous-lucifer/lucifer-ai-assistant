#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

import { getLogsToDelete } from './src/utils/index.js';
import type { AssistantConfig } from './src/core/types.js';
import { syncDependencies, runStatusCheck, buildIndex, installDaemon } from './src/setup.js';
import { RecipeStorage } from './src/storage/recipe.storage.js';
import { handleOneShot } from './src/cli/parser.js';
import { startRepl } from './src/cli/repl.js';

// --- Dynamic Path Resolution ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT: string = process.env.LUCIFER_HOME || (__dirname.endsWith('dist') ? path.join(__dirname, '..') : __dirname);
const CONFIG_FILE = path.join(os.homedir(), '.lucifer-env');
const BACKUP_FILE = path.join(PROJECT_ROOT, "index.ts.bak");
const RUNTIMES_PATH = path.join(os.homedir(), "runtimes");
const LOGS_DIR = path.join(os.homedir(), '.lucifer-logs');
const INDEX_FILE = path.join(PROJECT_ROOT, '.lucifer-index.json');

// --- Configuration & Manifest ---
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'lucifer-manifest.json');
let manifest: any = { version: "9.3", dependencies: [], dangerPatterns: [], tools: [] };

function safeParseManifest(filePath: string) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch (e) {
        console.error(chalk.red("Failed to load manifest. Using defaults."));
    }
    return manifest;
}

manifest = safeParseManifest(MANIFEST_PATH);
dotenv.config({ path: CONFIG_FILE });

let apiKey = process.env.API_KEY;
const rl = readline.createInterface({ input, output });
const recipeStorage = new RecipeStorage(PROJECT_ROOT);

const config: AssistantConfig = {
    ai: undefined,
    localAI: undefined,
    rl,
    projectRoot: PROJECT_ROOT,
    runtimesPath: RUNTIMES_PATH,
    logsDir: LOGS_DIR,
    indexFile: INDEX_FILE,
    backupFile: BACKUP_FILE,
    allowedRoots: [PROJECT_ROOT, RUNTIMES_PATH],
    dangerPatterns: manifest.dangerPatterns || [],
    recipeStorage,
    modelName: process.env.LUCIFER_MODEL || "qwen2.5-coder-7b-instruct-mlx",
    visionModelName: process.env.LUCIFER_VISION_MODEL || "gemini-2.0-flash"
};

const args = process.argv.slice(2);

async function initialize() {
    await syncDependencies(config, manifest);
    if (!apiKey) {
        apiKey = await rl.question(chalk.green('Enter your Gemini API Key: '));
        if (apiKey) fs.writeFileSync(CONFIG_FILE, `API_KEY=${apiKey.trim()}\n`, { mode: 0o600 });
    }
    config.ai = new GoogleGenAI({ apiKey: apiKey!.trim() });
    try {
        const lmsPath = path.join(os.homedir(), '.lmstudio/bin/lms');
        const status = execFileSync(lmsPath, ['status'], { encoding: 'utf-8', timeout: 5000 });
        if (status.includes('Server: OFF')) {
            console.log(chalk.yellow("Starting LM Studio daemon..."));
            execFileSync(lmsPath, ['daemon', 'up'], { timeout: 30000 });
        }
    } catch (e: any) {
        console.log(chalk.gray(`Note: LM Studio daemon status check failed: ${e.message}`));
    }
    config.localAI = new OpenAI({ baseURL: "http://localhost:1234/v1", apiKey: "lm-studio", timeout: 60000 });
}

async function main() {
    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk.cyan(`
=== LUCIFER v9.3 (HARDENED EDITION) — Quick Reference ===

STARTUP / ONE-SHOT
  lucifer "query"      One-shot answer and exit
  cat file | lucifer   Pipe data to Lucifer for analysis
  lucifer -c "query"   Generate and optionally execute a command
  lucifer --json       Force output in structured JSON
  lucifer --vision     Analyze screen and exit
  lucifer --search     Web search and exit

INTERACTIVE MODE
  lucifer              Start interactive agent session
  lucifer --evolve     Start in system evolution mode (health check + audit)
  lucifer --index      Build/Update local codebase search index
  lucifer --status     Check system health
  lucifer --setup      First-time setup wizard
  lucifer --last       Open most recent session log
  lucifer --rollback   Restore last stable version
  lucifer --install-daemon  Install auto-start background service
  lucifer --help       Show this message

IN-SESSION COMMANDS
  !fix <issue>         Autonomous auto-repair (Searches, Reads, and Fixes)
  !search <query>      Direct web research (DuckDuckGo via Node Fetch)
  !tldr <command>      Get quick command cheat sheets (Native Fetch)
  !report              Instant deep system diagnostics
  !read <path>         Quickly inspect a file (auto-pipes to less if large)
  !test                Run project test suite (npm test)
  !status              Check Lucifer environment health
  !lms                 Check LM Studio server status
  !screen [query]      Analyze your screen with Gemini Vision
  !clip [query]        Analyze clipboard content
  !recipes             List all saved gourmet recipes
  !recipe <title>      Read a specific recipe
  exit / quit          End session

CAPABILITIES
  - Proactive tool use (shell, grep, read, replace)
  - Security-hardened command execution
  - Decoupled Hybrid Architecture (Local Reasoning + Cloud Vision)
`));
        process.exit(0);
    }
    if (args.includes('--status')) { await runStatusCheck(config, CONFIG_FILE); process.exit(0); }
    if (args.includes('--install-daemon')) { installDaemon(config); process.exit(0); }
    if (args.includes('--index')) { await initialize(); await buildIndex(config); process.exit(0); }
    if (args.includes('--setup')) { 
        apiKey = await rl.question(chalk.green('Enter your Gemini API Key: '));
        if (apiKey) fs.writeFileSync(CONFIG_FILE, `API_KEY=${apiKey.trim()}\n`, { mode: 0o600 });
        console.log(chalk.green("Setup complete."));
        process.exit(0);
    }
    if (args.includes('--rollback')) {
        if (fs.existsSync(BACKUP_FILE)) {
            fs.copyFileSync(BACKUP_FILE, path.join(PROJECT_ROOT, "index.ts"));
            console.log(chalk.green("Rollback successful. Restored index.ts from backup."));
        } else {
            console.log(chalk.red("No backup found."));
        }
        process.exit(0);
    }
    if (args.includes('--last')) {
        if (!fs.existsSync(LOGS_DIR)) {
            console.log(chalk.red("No logs found."));
            process.exit(0);
        }
        const logs = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.md')).sort();
        if (logs.length === 0) {
            console.log(chalk.red("No logs found."));
            process.exit(0);
        }
        const lastLog = path.join(LOGS_DIR, logs[logs.length - 1]);
        console.log(chalk.cyan(`Opening last log: ${lastLog}`));
        execFileSync('open', [lastLog]);
        process.exit(0);
    }

    await initialize();

    const isPiped = !process.stdin.isTTY;
    const hasQuery = args.filter(a => !a.startsWith('-')).length > 0;

    if (isPiped || hasQuery || args.some(a => ['--vision', '--search'].includes(a))) {
        await handleOneShot(config, args);
    } else {
        const isEvolving = args.includes('--evolve');
        if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);
        const allLogs = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.md')).sort();
        getLogsToDelete(allLogs, 50).forEach(f => fs.unlinkSync(path.join(LOGS_DIR, f)));
        await startRepl(config, manifest, isEvolving, LOGS_DIR);
    }
    rl.close();
}

main().catch(console.error);
