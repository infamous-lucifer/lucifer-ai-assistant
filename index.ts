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

dotenv.config({ path: CONFIG_FILE });

let apiKey = process.env.API_KEY;
let ai: GoogleGenAI;
let localAI: OpenAI;

const rl = readline.createInterface({ input, output });

// --- CLI Argument Handling ---
const args = process.argv.slice(2);

// ISSUE 2 — --rollback implementation
if (args.includes('--rollback')) {
    if (fs.existsSync(BACKUP_FILE)) {
        fs.copyFileSync(BACKUP_FILE, path.join(PROJECT_ROOT, 'index.ts'));
        console.log(chalk.green('✔ Rolled back to last stable version.'));
    } else {
        console.log(chalk.red('✘ No backup found.'));
    }
    process.exit(0);
}

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
    console.log(chalk.yellow("\n[Signal] Interrupt received. Shutting down..."));
    rl.close();
    process.exit(0);
});

async function initializeApp() {
    if (!apiKey) {
        console.log(chalk.yellow("\n=== First Time Setup ==="));
        apiKey = await rl.question(chalk.green('Enter your Gemini API Key: '));
        if (apiKey) fs.writeFileSync(CONFIG_FILE, `API_KEY=${apiKey.trim()}\n`);
    }
    // Correct v1.x SDK initialization
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
    
    localAI = new OpenAI({
        baseURL: "http://localhost:1234/v1", 
        apiKey: "lm-studio",
        timeout: 60000,
    });
}

// ISSUE 1 — !screen vision logic (Fixed for v1.x SDK)
async function seeScreen(query: string): Promise<string> {
    try {
        const screenshotPath = path.join(os.tmpdir(), `lucifer-screen.png`);
        execSync(`screencapture -x ${screenshotPath}`);
        const imageData = fs.readFileSync(screenshotPath).toString('base64');
        fs.unlinkSync(screenshotPath);

        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
                { role: "user", parts: [
                    { text: query || "What is on my screen?" },
                    { inlineData: { mimeType: "image/png", data: imageData } }
                ]}
            ]
        });
        return result.text || "No vision analysis generated.";
    } catch (e: any) {
        return `Vision Error: ${e.message}`;
    }
}

// --- Tool Definitions ---
const tools = [
    {
        type: "function",
        function: {
            name: "run_command",
            description: "Execute a shell command. Use for tests, scripts, or system tasks.",
            parameters: {
                type: "object",
                properties: { command: { type: "string" } },
                required: ["command"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Read a file from disk.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string" },
                    start_line: { type: "number" },
                    end_line: { type: "number" }
                },
                required: ["path"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "replace_in_file",
            description: "Surgical text replacement. Creates backup if editing core logic.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string" },
                    old_string: { type: "string" },
                    new_string: { type: "string" }
                },
                required: ["path", "old_string", "new_string"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "propose_fix",
            description: "Create a Review Request for the Senior Agent.",
            parameters: {
                type: "object",
                properties: {
                    issue: { type: "string" },
                    file_path: { type: "string" },
                    old_code: { type: "string" },
                    suggested_fix: { type: "string" }
                },
                required: ["issue", "file_path", "suggested_fix"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_system_info",
            description: "Get macOS system health including uptime and battery status.",
            parameters: { type: "object", properties: {} }
        }
    }
];

function resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath;
    if (fs.existsSync(filePath)) return filePath;
    const rootPath = path.join(PROJECT_ROOT, filePath);
    if (fs.existsSync(rootPath)) return rootPath;
    const runtimePath = path.join(RUNTIMES_PATH, filePath);
    if (fs.existsSync(runtimePath)) return runtimePath;
    return filePath;
}

function executeTool(name: string, args: any): string {
    // ISSUE 3 — Guard Rails
    const BLOCKED = ['rm -rf /', 'sudo', 'mkfs', ':(){:|:&};:'];
    if (name === "run_command" && BLOCKED.some(b => args.command.includes(b))) {
        return "Error: Blocked command. Lucifer does not run destructive or privileged commands.";
    }

    try {
        switch (name) {
            case "run_command":
                console.log(chalk.yellow(`  [Action] Executing: ${args.command}`));
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
                const doc = `# 🛠 Fix Proposal\n**File:** ${args.file_path}\n## 📝 Proposed Change\n\`\`\`ts\n${args.suggested_fix}\n\`\`\``;
                fs.writeFileSync(reviewPath, doc);
                return `Review request written to REVIEW_REQUEST.md. Open it manually and submit to Gemini CLI with: gemini -f REVIEW_REQUEST.md`;

            case "get_system_info":
                const uptime = execSync('uptime', { encoding: 'utf-8' }).trim();
                const battery = execSync('pmset -g batt', { encoding: 'utf-8' }).trim();
                return `📊 **System Health Report**\n\n**Uptime:** ${uptime}\n**Battery:**\n\`\`\`\n${battery}\n\`\`\``;

            default: return "Unknown tool";
        }
    } catch (error: any) { return `Error: ${error.message}`; }
}

async function main() {
    await initializeApp(); 
    const isEvolving = args.includes('--evolve');
    
    console.clear();
    console.log(chalk.cyan(`=== LUCIFER-HYBRID v4.3 (PRO RELEASE) ===`));
    console.log(chalk.gray(`Logic: Qwen 2.5 Coder | Vision: Gemini 2.0`));
    console.log(chalk.gray(`Tool Center: ${RUNTIMES_PATH}`));
    console.log(chalk.gray(`Path: ${PROJECT_ROOT}\n`));

    const basePrompt = `You are Lucifer, a pro agentic AI for macOS. 
    CONTEXT:
    - Source code at ${PROJECT_ROOT}.
    - Tool dashboard at ${RUNTIMES_PATH} (node, python, go, rust, etc.).
    RULES:
    1. Use surgical tools (read_file, replace_in_file) for editing.
    2. Always give text summaries after tool use.
    3. Use Markdown blocks for code.`;

    const evolvePrompt = `\nEVOLUTION MODE: You are currently auditing your own source code (index.ts). 
    Run tests, find inefficiencies, and use 'propose_fix' for improvements.`;

    let history: any[] = [
        { role: "system", content: basePrompt + (isEvolving ? evolvePrompt : "") }
    ];

    while (true) {
        const query = await rl.question(chalk.green(`lucifer@${isEvolving ? 'refine' : 'm5'} > `));
        if (['exit', 'quit'].includes(query.toLowerCase())) break;
        if (!query.trim()) continue;

        if (query.startsWith('!screen')) {
            process.stdout.write(chalk.magenta("Analyzing screen..."));
            const result = await seeScreen(query.replace('!screen', '').trim());
            console.log(`\n${chalk.white(result)}\n`);
            continue;
        }

        history.push({ role: "user", content: query });
        
        let loopCount = 0;
        let finalResponse = "";

        try {
            while (loopCount < 5) {
                // ISSUE 5 — Feedback during inference
                process.stdout.write(chalk.gray('  [Thinking...]'));
                const response = await localAI.chat.completions.create({
                    model: "qwen2.5-coder-7b-instruct-mlx",
                    messages: history,
                    tools: tools as any,
                });
                process.stdout.write('\r' + ' '.repeat(20) + '\r'); // clear the line

                const assistantMsg = response.choices[0]!.message;
                history.push(assistantMsg);

                if (assistantMsg.content) finalResponse = assistantMsg.content;
                if (!assistantMsg.tool_calls) break;

                for (const call of assistantMsg.tool_calls) {
                    const toolCall = call as any;
                    const toolResult = executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
                    history.push({ role: "tool", tool_call_id: toolCall.id, content: String(toolResult) });
                }
                loopCount++;
            }

            console.log(chalk.white(finalResponse || "Task complete.") + '\n');
        }
        catch (err: any) {
            console.log(chalk.red(`\nError: ${err.message}\n`));
        } finally {
            // ISSUE 4 — History Trimming (Moved to finally)
            const SYSTEM_MSG = history[0];
            if (history.length > 40) {
                history = [SYSTEM_MSG, ...history.slice(-39)];
            }
        }
    }
    rl.close();
}

main().catch(console.error);