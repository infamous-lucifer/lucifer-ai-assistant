#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// --- Dynamic Path Resolution ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT: string = process.env.LUCIFER_HOME || __dirname;
const CONFIG_FILE = path.join(os.homedir(), '.lucifer-env');
const BACKUP_FILE = path.join(PROJECT_ROOT, "index.ts.bak");
const RUNTIMES_PATH = path.join(os.homedir(), "runtimes");
const LOGS_DIR = path.join(os.homedir(), '.lucifer-logs');

dotenv.config({ path: CONFIG_FILE });

let apiKey = process.env.API_KEY;
let ai: GoogleGenAI;
let localAI: OpenAI;

const rl = readline.createInterface({ input, output });

// --- CLI Argument Handling ---
const args = process.argv.slice(2);

function printHelp() {
    console.log(chalk.cyan(`
=== LUCIFER v4.5 — Quick Reference ===

STARTUP
  lucifer              Start assistant (normal mode)
  lucifer --evolve     Start in code audit mode
  lucifer --rollback   Restore last stable version
  lucifer --status     Check system health
  lucifer --setup      First-time setup wizard
  lucifer --install-daemon  Install auto-start background service
  lucifer --last       Open most recent session log
  lucifer --help       Show this message

IN-SESSION COMMANDS
  !screen [query]      Analyze your screen with Gemini Vision
  !clip [query]        Analyze clipboard content
  exit / quit          End session

TOOLS (model can use these autonomously)
  run_command          Execute shell commands
  read_file            Read files (supports line ranges)
  replace_in_file      Surgical text edits with auto-backup
  propose_fix          Write a review request to REVIEW_REQUEST.md
  get_deep_system_report  CPU, Memory, Battery & Network deep stats
`));
}

async function runStatusCheck() {
    console.log(chalk.cyan('\n=== LUCIFER STATUS ===\n'));
    const keyExists = fs.existsSync(CONFIG_FILE) && fs.readFileSync(CONFIG_FILE, 'utf-8').includes('API_KEY=');
    console.log(keyExists ? chalk.green('✔ API Key found') : chalk.red('✘ API Key missing — run: lucifer --setup'));
    try {
        const status = execSync(`${path.join(os.homedir(), '.lmstudio/bin/lms')} status`, { encoding: 'utf-8' });
        console.log(!status.includes('Server: OFF') ? chalk.green('✔ LM Studio server running') : chalk.yellow('⚠ LM Studio server OFF'));
    } catch { console.log(chalk.red('✘ LM Studio not found')); }
    console.log(fs.existsSync(BACKUP_FILE) ? chalk.green('✔ Rollback backup available') : chalk.gray('– No backup yet'));
    console.log(fs.existsSync(RUNTIMES_PATH) ? chalk.green(`✔ Runtimes folder found`) : chalk.yellow(`⚠ Runtimes folder missing`));
    console.log('');
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

if (args.includes('--rollback')) {
    if (fs.existsSync(BACKUP_FILE)) {
        fs.copyFileSync(BACKUP_FILE, path.join(PROJECT_ROOT, 'index.ts'));
        console.log(chalk.green('✔ Rollback successful.'));
    } else { console.log(chalk.red('✘ No backup found.')); }
    process.exit(0);
}
if (args.includes('--help') || args.includes('-h')) { printHelp(); process.exit(0); }
if (args.includes('--status')) { await runStatusCheck(); process.exit(0); }
if (args.includes('--setup')) { await runSetupWizard(); process.exit(0); }
if (args.includes('--install-daemon')) { await installLaunchAgent(); process.exit(0); }
if (args.includes('--last')) {
    const logs = fs.existsSync(LOGS_DIR) ? fs.readdirSync(LOGS_DIR).sort().reverse() : [];
    if (logs.length > 0) execSync(`open ${path.join(LOGS_DIR, logs[0]!)}`);
    else console.log(chalk.yellow('No logs found.'));
    process.exit(0);
}

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
    console.log(chalk.yellow("\n[Signal] Shutting down..."));
    rl.close();
    process.exit(0);
});

async function initializeApp() {
    if (!apiKey) {
        console.log(chalk.yellow("\n=== First Time Setup ==="));
        apiKey = await rl.question(chalk.green('Enter your Gemini API Key: '));
        if (apiKey) fs.writeFileSync(CONFIG_FILE, `API_KEY=${apiKey.trim()}\n`);
    }
    ai = new GoogleGenAI({ apiKey: apiKey!.trim() });
    try {
        const lmsPath = path.join(os.homedir(), '.lmstudio/bin/lms');
        const status = execSync(`${lmsPath} status`, { encoding: 'utf-8' });
        if (status.includes('Server: OFF')) {
            process.stdout.write(chalk.yellow("Starting local server..."));
            execSync(`${lmsPath} daemon up`);
            console.log(chalk.green(" Done."));
        }
    } catch (e) {}
    localAI = new OpenAI({ baseURL: "http://localhost:1234/v1", apiKey: "lm-studio", timeout: 60000 });
}

async function seeScreen(query: string): Promise<string> {
    try {
        const screenshotPath = path.join(os.tmpdir(), `lucifer-screen.png`);
        execSync(`screencapture -x ${screenshotPath}`);
        const imageData = fs.readFileSync(screenshotPath).toString('base64');
        fs.unlinkSync(screenshotPath);
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: query || "What is on my screen?" }, { inlineData: { mimeType: "image/png", data: imageData } }] }]
        });
        return result.text || "No analysis generated.";
    } catch (e: any) { return `Vision Error: ${e.message}`; }
}

const tools = [
    { type: "function", function: { name: "run_command", description: "Execute shell command.", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } },
    { type: "function", function: { name: "read_file", description: "Read file.", parameters: { type: "object", properties: { path: { type: "string" }, start_line: { type: "number" }, end_line: { type: "number" } }, required: ["path"] } } },
    { type: "function", function: { name: "replace_in_file", description: "Edit text.", parameters: { type: "object", properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["path", "old_string", "new_string"] } } },
    { type: "function", function: { name: "propose_fix", description: "Review Request.", parameters: { type: "object", properties: { issue: { type: "string" }, file_path: { type: "string" }, suggested_fix: { type: "string" } }, required: ["issue", "file_path", "suggested_fix"] } } },
    { type: "function", function: { name: "get_deep_system_report", description: "Comprehensive macOS health report: CPU, RAM, Battery, and Network stats.", parameters: { type: "object", properties: {} } } }
];

function resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath;
    if (fs.existsSync(filePath)) return filePath;
    const rootPath = path.join(PROJECT_ROOT, filePath);
    if (fs.existsSync(rootPath)) return rootPath;
    const runtimePath = path.join(RUNTIMES_PATH, filePath);
    return fs.existsSync(runtimePath) ? runtimePath : filePath;
}

let toolsUsed: string[] = [];
function executeTool(name: string, args: any): string {
    toolsUsed.push(name);
    const BLOCKED = ['rm -rf /', 'sudo', 'mkfs', ':(){:|:&};:'];
    if (name === "run_command" && BLOCKED.some(b => args.command.includes(b))) return "Error: Blocked command.";
    try {
        switch (name) {
            case "run_command":
                console.log(chalk.yellow(`  [Action] ${args.command}`));
                return execSync(args.command, { encoding: 'utf-8', timeout: 15000 });
            case "read_file":
                const rPath = resolveFilePath(args.path);
                let content = fs.readFileSync(rPath, 'utf-8');
                if (args.start_line || args.end_line) {
                    const lines = content.split('\n');
                    content = lines.slice((args.start_line || 1) - 1, args.end_line || lines.length).join('\n');
                }
                return content;
            case "replace_in_file":
                const edPath = resolveFilePath(args.path);
                if (edPath.includes("index.ts")) fs.copyFileSync(edPath, BACKUP_FILE);
                let fileText = fs.readFileSync(edPath, 'utf-8');
                if (!fileText.includes(args.old_string)) return "Error: Text not found.";
                fs.writeFileSync(edPath, fileText.replace(args.old_string, args.new_string));
                return "Success: Applied.";
            case "propose_fix":
                const reviewPath = path.join(PROJECT_ROOT, "REVIEW_REQUEST.md");
                fs.writeFileSync(reviewPath, `# 🛠 Fix Proposal\n**File:** ${args.file_path}\n## 📝 Proposed Change\n\`\`\`ts\n${args.suggested_fix}\n\`\`\``);
                return `Review request written to REVIEW_REQUEST.md. Open it manually and submit to Gemini CLI with: gemini -f REVIEW_REQUEST.md`;
            case "get_deep_system_report":
                console.log(chalk.yellow(`  [Action] Compiling deep system report...`));
                const uptime = execSync('uptime', { encoding: 'utf-8' }).trim();
                const battery = execSync('ioreg -r -c IOPMPowerSource', { encoding: 'utf-8' }).split('\n').filter(l => l.includes('Capacity') || l.includes('Voltage') || l.includes('CycleCount')).join('\n').trim();
                const mem = execSync('vm_stat', { encoding: 'utf-8' }).trim();
                const cpu = execSync('sysctl hw.physicalcpu hw.logicalcpu', { encoding: 'utf-8' }).trim();
                const net = execSync('netstat -i | head -n 5', { encoding: 'utf-8' }).trim();
                return `📊 **Deep System Report**\n\n**Uptime:** ${uptime}\n\n**CPU:**\n${cpu}\n\n**Memory:**\n${mem}\n\n**Battery Deep Stats:**\n${battery}\n\n**Network (Top interfaces):**\n${net}`;
            default: return "Unknown tool";
        }
    } catch (error: any) { return `Error: ${error.message}`; }
}

async function main() {
    await initializeApp(); 
    const isEvolving = args.includes('--evolve');
    const SESSION_ID = new Date().toISOString().replace(/[:.]/g, '-');
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);
    const LOG_FILE = path.join(LOGS_DIR, `session-${SESSION_ID}.md`);
    fs.writeFileSync(LOG_FILE, `# Lucifer Session — ${new Date().toLocaleString()}\n\n**Mode:** ${isEvolving ? 'Evolution' : 'Normal'}\n**Project:** ${PROJECT_ROOT}\n\n---\n\n`);

    let gitContext = '';
    try {
        gitContext = `\n- Git repo: ${execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim()}, branch: ${execSync('git branch --show-current', { encoding: 'utf-8' }).trim()}`;
    } catch {}

    console.clear();
    console.log(chalk.cyan(`=== LUCIFER-HYBRID v4.5 (DEEP INSIGHT) ===`));
    console.log(chalk.gray(`Logic: Qwen 2.5 | Vision: Gemini 2.0`));
    console.log(chalk.gray(`Tool Center: ${RUNTIMES_PATH}`));
    console.log(chalk.gray(`Path: ${PROJECT_ROOT}${gitContext}\n`));

    const basePrompt = `You are Lucifer, a pro agentic AI for macOS. 
    CONTEXT:
    - Source code at ${PROJECT_ROOT}.${gitContext}
    - Tool dashboard at ${RUNTIMES_PATH}.
    RULES:
    1. Use surgical tools (read_file, replace_in_file) for editing.
    2. Always give text summaries. 3. Use Markdown.`;

    let history: any[] = [{ role: "system", content: basePrompt + (isEvolving ? "\nEVOLUTION MODE: Audit yourself (index.ts)." : "") }];

    while (true) {
        const query = await rl.question(chalk.green(`lucifer@m5 > `));
        if (['exit', 'quit'].includes(query.toLowerCase())) break;
        if (!query.trim()) continue;

        if (query.startsWith('!screen')) {
            process.stdout.write(chalk.magenta("Analyzing screen..."));
            const result = await seeScreen(query.replace('!screen', '').trim());
            console.log(`\n${chalk.white(result)}\n`);
            fs.appendFileSync(LOG_FILE, `## ${new Date().toLocaleTimeString()}\n\n**You:** !screen\n\n**Lucifer:** ${result}\n\n---\n\n`);
            continue;
        }

        if (query.startsWith('!clip')) {
            const clipboardContent = execSync('pbpaste', { encoding: 'utf-8' });
            history.push({ role: "user", content: `${query.replace('!clip', '').trim() || 'Analyze clipboard'}:\n\n${clipboardContent}` });
        } else { history.push({ role: "user", content: query }); }
        
        let loopCount = 0;
        let finalResponse = "";

        try {
            while (loopCount < 5) {
                process.stdout.write(chalk.gray('  [Thinking...]'));
                const stream = await localAI.chat.completions.create({ model: "qwen2.5-coder-7b-instruct-mlx", messages: history, tools: tools as any, stream: true });
                process.stdout.write('\r' + ' '.repeat(20) + '\r');

                let assistantMsgContent = "";
                let toolCalls: any[] = [];

                for await (const chunk of stream) {
                    const delta = chunk.choices[0]?.delta;
                    if (delta?.content) {
                        process.stdout.write(delta.content);
                        assistantMsgContent += delta.content;
                    }
                    if (delta?.tool_calls) {
                        for (const toolCallDelta of delta.tool_calls) {
                            if (!toolCalls[toolCallDelta.index]) toolCalls[toolCallDelta.index] = { id: toolCallDelta.id, type: "function", function: { name: "", arguments: "" } };
                            if (toolCallDelta.id) toolCalls[toolCallDelta.index].id = toolCallDelta.id;
                            if (toolCallDelta.function?.name) toolCalls[toolCallDelta.index].function.name += toolCallDelta.function.name;
                            if (toolCallDelta.function?.arguments) toolCalls[toolCallDelta.index].function.arguments += toolCallDelta.function.arguments;
                        }
                    }
                }
                console.log('\n');
                const assistantMsg: any = { role: 'assistant', content: assistantMsgContent };
                if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
                
                history.push(assistantMsg);
                if (assistantMsgContent) finalResponse = assistantMsgContent;
                if (!assistantMsg.tool_calls) break;

                for (const call of assistantMsg.tool_calls) {
                    const toolResult = executeTool(call.function.name, JSON.parse(call.function.arguments));
                    history.push({ role: "tool", tool_call_id: call.id, content: String(toolResult) });
                }
                loopCount++;
            }
            fs.appendFileSync(LOG_FILE, `## ${new Date().toLocaleTimeString()}\n\n**You:** ${query}\n\n**Lucifer:** ${finalResponse || 'Task complete.'}\n\n---\n\n`);
            if (loopCount > 1) { try { execSync(`osascript -e 'display notification "Task complete" with title "Lucifer"'`); } catch {} }
        } catch (err: any) { console.log(chalk.red(`\nError: ${err.message}\n`));
        } finally {
            if (history.length > 40) history = [history[0], ...history.slice(-39)];
        }
    }
    if (toolsUsed.length > 0) fs.appendFileSync(LOG_FILE, `\n## Session Summary\nTools used: ${[...new Set(toolsUsed)].join(', ')}\n`);
    rl.close();
}
main().catch(console.error);