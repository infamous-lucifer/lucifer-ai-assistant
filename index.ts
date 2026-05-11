#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output, stdin } from 'node:process';
import { execSync, execFileSync, exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

import {
    highlightMarkdown,
    truncateOutput,
    getLogsToDelete,
    resolveFilePath
} from './src/utils/index.js';

import { AssistantConfig } from './src/core/types.js';
import { Assistant } from './src/core/assistant.js';
import { syncDependencies, buildIndex, runStatusCheck } from './src/setup.js';
import { toolHandlers } from './src/tools/index.js';

const execAsync = promisify(exec);

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
let manifest: any = { version: "9.2", dependencies: [], dangerPatterns: [], tools: [] };
try {
    if (fs.existsSync(MANIFEST_PATH)) {
        manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    }
} catch (e) { console.error(chalk.red("Failed to load manifest. Using defaults.")); }

dotenv.config({ path: CONFIG_FILE });

let apiKey = process.env.API_KEY;
const rl = readline.createInterface({ input, output });

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
    dangerPatterns: manifest.dangerPatterns || []
};

const args = process.argv.slice(2);

function printHelp() {
    console.log(chalk.cyan(`
=== LUCIFER v9.2 (HYBRID UTILITY) — Quick Reference ===

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
  lucifer --rollback   Restore last stable version
  lucifer --status     Check system health
  lucifer --setup      First-time setup wizard
  lucifer --install-daemon  Install auto-start background service
  lucifer --last       Open most recent session log
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
  exit / quit          End session
`));
}

async function runSetupWizard() {
    console.log(chalk.cyan('\n=== LUCIFER SETUP WIZARD ===\n'));
    const key = await rl.question('Paste your Gemini API key (leave blank to skip): ');
    if (key.trim()) fs.writeFileSync(CONFIG_FILE, `API_KEY=${key.trim()}\n`);
    const lmsOk = await rl.question('Is LM Studio installed? (y/n): ');
    if (lmsOk.toLowerCase() !== 'y') console.log(chalk.yellow('⚠ Please install it from lmstudio.ai\n'));
    console.log(chalk.yellow('Step 3: Run "npm link" to register the global command.\n'));
    console.log(chalk.cyan('Setup complete! Run: lucifer\n'));
}

async function installLaunchAgent() {
    const plistPath = path.join(os.homedir(), 'Library/LaunchAgents/com.lucifer.lmstudio.plist');
    const lmsPath = path.join(os.homedir(), '.lmstudio/bin/lms');
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>Label</key><string>com.lucifer.lmstudio</string><key>ProgramArguments</key><array><string>/bin/sh</string><string>-c</string><string>${lmsPath} daemon up</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><false/></dict></plist>`;
    try {
        if (!fs.existsSync(path.dirname(plistPath))) fs.mkdirSync(path.dirname(plistPath), { recursive: true });
        fs.writeFileSync(plistPath, plistContent);
        execSync(`launchctl load ${plistPath}`);
        console.log(chalk.green(`✔ Installed and loaded LaunchAgent at: ${plistPath}`));
    } catch (e: any) { console.log(chalk.red(`✘ Failed to install daemon: ${e.message}`)); }
}

async function seeScreen(query: string): Promise<string> {
    if (!config.ai) return "Error: Gemini AI not initialized.";
    const screenshotPath = path.join(os.tmpdir(), `lucifer-screen-${Date.now()}.png`);
    try {
        execSync(`screencapture -x ${screenshotPath}`, { timeout: 10000 });
        const imageData = fs.readFileSync(screenshotPath).toString('base64');
        const result = await config.ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: query || "What is on my screen?" }, { inlineData: { mimeType: "image/png", data: imageData } }] }]
        });
        return result.text || "No analysis generated.";
    } catch (e: any) { return `Vision Error: ${e.message}`; }
    finally {
        if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
    }
}

async function initialize() {
    await syncDependencies(config, manifest);
    if (!apiKey) {
        console.log(chalk.yellow("\n=== First Time Setup ==="));
        apiKey = await rl.question(chalk.green('Enter your Gemini API Key: '));
        if (apiKey) fs.writeFileSync(CONFIG_FILE, `API_KEY=${apiKey.trim()}\n`);
    }
    config.ai = new GoogleGenAI({ apiKey: apiKey!.trim() });
    try {
        const lmsPath = path.join(os.homedir(), '.lmstudio/bin/lms');
        const status = execSync(`${lmsPath} status`, { encoding: 'utf-8', timeout: 5000 });
        if (status.includes('Server: OFF')) {
            process.stdout.write(chalk.yellow("Starting local server..."));
            execSync(`${lmsPath} daemon up`, { timeout: 10000 });
            console.log(chalk.green(" Done."));
        }
    } catch (e: any) {
        console.log(chalk.yellow(`\n⚠ Could not reach LM Studio: ${e.message}`));
    }
    config.localAI = new OpenAI({ baseURL: "http://localhost:1234/v1", apiKey: "lm-studio", timeout: 60000 });
}

async function main() {
    if (args.includes('--rollback')) {
        if (fs.existsSync(BACKUP_FILE)) {
            fs.copyFileSync(BACKUP_FILE, path.join(PROJECT_ROOT, 'index.ts'));
            console.log(chalk.green('✔ Rollback successful.'));
        } else { console.log(chalk.red('✘ No backup found.')); }
        process.exit(0);
    }
    if (args.includes('--index')) { await buildIndex(config); process.exit(0); }
    if (args.includes('--help') || args.includes('-h')) { printHelp(); process.exit(0); }
    if (args.includes('--status')) { await runStatusCheck(config, CONFIG_FILE); process.exit(0); }
    if (args.includes('--setup')) { await runSetupWizard(); process.exit(0); }
    if (args.includes('--install-daemon')) { await installLaunchAgent(); process.exit(0); }
    if (args.includes('--last')) {
        const logs = fs.existsSync(LOGS_DIR) ? fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.md')).sort().reverse() : [];
        if (logs.length > 0) execFileSync('open', [path.join(LOGS_DIR, logs[0]!)]);
        else console.log(chalk.yellow('No logs found.'));
        process.exit(0);
    }

    await initialize();
    const assistant = new Assistant(config, manifest);

    // --- One-Shot / Pipe Mode ---
    const isPiped = !stdin.isTTY;
    const isJsonMode = args.includes('--json');
    const isCommandMode = args.includes('--command') || args.includes('-c');
    
    let visionQuery: string | undefined;
    let searchQuery: string | undefined;
    const visionIdx = args.indexOf('--vision');
    const searchIdx = args.indexOf('--search');
    
    if (visionIdx !== -1) visionQuery = args[visionIdx + 1] || "";
    if (searchIdx !== -1) searchQuery = args[searchIdx + 1] || "";

    const positionalArgs = args.filter((a, i) => {
        if (a.startsWith('-')) return false;
        if (i > 0 && ['--vision', '--search'].includes(args[i-1] || "")) return false;
        return true;
    });
    const oneShotQuery = positionalArgs.join(' ');

    if (isPiped || oneShotQuery || visionQuery || searchQuery) {
        let pipedData = "";
        if (isPiped) {
            const chunks = [];
            for await (const chunk of stdin) chunks.push(chunk);
            pipedData = Buffer.concat(chunks).toString('utf-8');
        }

        let fullPrompt = `${oneShotQuery}${pipedData ? '\n\nCONTEXT:\n' + pipedData : ''}`;
        
        if (visionQuery) {
            console.log(chalk.magenta("  [Vision] Analyzing screen..."));
            const result = await seeScreen(visionQuery);
            console.log(`\n${highlightMarkdown(result)}\n`);
            process.exit(0);
        }

        if (searchQuery) {
            console.log(chalk.blue(`  [Search] Researching: ${searchQuery}...`));
            const result = await toolHandlers["search_web"](config, { query: searchQuery }, new Set());
            console.log(`\n${highlightMarkdown(result)}\n`);
            process.exit(0);
        }

        if (isJsonMode) fullPrompt += "\n\nRespond ONLY in valid JSON format.";
        if (isCommandMode) fullPrompt += "\n\nRespond ONLY with the single most appropriate macOS terminal command to achieve this. Do not include markdown blocks or explanations.";

        const spinner = new Spinner("Lucifer is processing...");
        spinner.start();
        
        try {
            const response = await config.localAI!.chat.completions.create({
                model: "qwen2.5-coder-7b-instruct-mlx",
                messages: [{ role: "user", content: fullPrompt }],
                stream: false
            });
            spinner.stop();
            
            const rawOutput = response.choices[0]?.message?.content || "";
            const output = highlightMarkdown(rawOutput);
            console.log(`\n${output}\n`);

            if (isCommandMode) {
                const command = rawOutput.trim().replace(/^`+|`+$/g, '');
                const approved = await rl.question(chalk.yellow(`  Execute this command? (y/n/explain): `));
                if (approved.toLowerCase() === 'y') {
                    const { stdout, stderr } = await execAsync(command);
                    if (stdout) console.log(chalk.gray(stdout));
                    if (stderr) console.error(chalk.red(stderr));
                } else if (approved.toLowerCase() === 'e' || approved.toLowerCase() === 'explain') {
                    const explanation = await config.localAI!.chat.completions.create({
                        model: "qwen2.5-coder-7b-instruct-mlx",
                        messages: [{ role: "user", content: `Explain exactly what this macOS command does: ${command}` }]
                    });
                    console.log(`\n${highlightMarkdown(explanation.choices[0]?.message?.content || "")}\n`);
                }
            }
            process.exit(0);
        } catch (e: any) {
            spinner.stop("Failed.", 'red');
            console.error(chalk.red(`Error: ${e.message}`));
            process.exit(1);
        }
    }

    // --- Interactive Mode ---
    const isEvolving = args.includes('--evolve');
    const SESSION_ID = new Date().toISOString().replace(/[:.]/g, '-');
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);
    
    const allLogs = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.md')).sort();
    const toDelete = getLogsToDelete(allLogs, 50);
    toDelete.forEach(f => fs.unlinkSync(path.join(LOGS_DIR, f)));

    const LOG_FILE = path.join(LOGS_DIR, `session-${SESSION_ID}.md`);
    fs.writeFileSync(LOG_FILE, `# Lucifer Session — ${new Date().toLocaleString()}\n\n**Mode:** ${isEvolving ? 'Evolution' : 'Normal'}\n\n---\n\n`);

    console.log('\n' + chalk.cyan('─'.repeat(50)) + '\n');
    console.log(chalk.cyan(`=== LUCIFER-HYBRID v9.2 (MODULAR UTILITY) ===`));
    console.log(chalk.gray(`Logic: Qwen 2.5 | Vision: Gemini 2.0`));
    console.log(chalk.gray(`Status: Architecture Decoupled | Security Hardened\n`));

    if (isEvolving) {
        console.log(chalk.magenta("  [Evolution] Running deterministic health checks..."));
        let outdatedData = "";
        try { outdatedData = execSync('npm outdated --json', { encoding: 'utf-8', timeout: 30000 }); } catch (e: any) { outdatedData = e.stdout?.toString() || "{}"; }
        const outdatedJson = JSON.parse(outdatedData || "{}");
        const packages = Object.keys(outdatedJson);
        if (packages.length === 0) {
            console.log(chalk.green("  [Evolution] System up to date."));
            process.exit(0);
        }
        assistant.addSystemContext(`System Audit Complete. The following dependencies are outdated: ${packages.join(', ')}. Use 'propose_fix' to write a REVIEW_REQUEST.md.`);
    }

    while (true) {
        try {
            const query = await rl.question(chalk.green(`lucifer@m5 > `));
            if (['exit', 'quit'].includes(query.toLowerCase())) break;
            if (!query.trim()) continue;

            if (query.startsWith('!fix')) {
                const issue = query.replace('!fix', '').trim();
                if (!issue) continue;
                console.log(chalk.magenta(`\n  [Pipeline] Starting guided fix for: ${issue}`));
                const searchResult = await assistant.executeTool("keyword_search", { query: issue });
                const topFiles = searchResult.split('\n').filter(l => l.startsWith('- ')).map(l => l.replace('- ', '').split(' (')[0]);
                let context = "";
                for (const file of topFiles.slice(0, 2)) {
                    context += `\n--- FILE: ${file} ---\n${await assistant.executeTool("read_file", { path: file })}\n`;
                }
                assistant.addSystemContext(`[GUIDED FIX MODE]\nISSUE: ${issue}\nCONTEXT:${context}\n\nTASK: Output ONLY the 'search_and_replace' JSON payload.`);
                continue;
            }

            if (query.startsWith('!search')) {
                const q = query.replace('!search', '').trim();
                if (!q) continue;
                const result = await toolHandlers["search_web"](config, { query: q }, new Set());
                console.log(`\n${chalk.white(result)}\n`);
                assistant.addSystemContext(`User executed '!search ${q}'. Result:\n${truncateOutput(result, 1000)}`);
                continue;
            }

            if (query.startsWith('!report')) {
                const result = await toolHandlers["get_deep_system_report"](config, {}, new Set());
                console.log(`\n${chalk.white(result)}\n`);
                assistant.addSystemContext(`User executed '!report'. Result:\n${truncateOutput(result, 1000)}`);
                continue;
            }

            if (query.startsWith('!read')) {
                const p = query.replace('!read', '').trim();
                if (!p) continue;
                try {
                    const rPath = resolveFilePath(p, config.allowedRoots);
                    const content = fs.readFileSync(rPath, 'utf-8');
                    if (content.split('\n').length > 100) execFileSync('less', [], { input: content, stdio: ['pipe', 'inherit', 'inherit'] });
                    else console.log(`\n${chalk.white(content)}\n`);
                    assistant.addSystemContext(`User executed '!read ${p}'.`);
                } catch (e: any) { console.log(chalk.red(`Error: ${e.message}`)); }
                continue;
            }

            if (query === '!test') {
                try {
                    const result = execSync('npm test', { encoding: 'utf-8', cwd: PROJECT_ROOT, timeout: 60000 });
                    console.log(result);
                    assistant.addSystemContext(`User executed '!test'. Result:\n${result}`);
                } catch (e: any) {
                    console.log(e.stdout?.toString() || e.message);
                    assistant.addSystemContext(`User executed '!test'. FAILED.`);
                }
                continue;
            }

            if (query.startsWith('!status')) {
                await runStatusCheck(config, CONFIG_FILE);
                continue;
            }

            if (query.startsWith('!screen')) {
                const result = await seeScreen(query.replace('!screen', '').trim());
                console.log(`\n${chalk.white(result)}\n`);
                assistant.addSystemContext(`User executed '!screen'. Analysis:\n${result}`);
                continue;
            }

            if (query.startsWith('!clip')) {
                const clipboardContent = execSync('pbpaste', { encoding: 'utf-8', timeout: 5000 });
                assistant.addSystemContext(`User executed '!clip'. CLIPBOARD CONTENT:\n<untrusted_clipboard_content>\n${clipboardContent}\n</untrusted_clipboard_content>`);
                continue;
            }

            await assistant.chat(query, LOG_FILE);
        } catch (err: any) {
            console.log(chalk.red(`\nError: ${err.message}\n`));
        }
    }
    rl.close();
}

main().catch(console.error);
