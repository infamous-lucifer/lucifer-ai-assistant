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

// --- Global Configuration ---
const CONFIG_FILE: string = path.join(os.homedir(), '.lucifer-env');
const PROJECT_ROOT: string = "/Users/lucifer/personal-assistant";
const BACKUP_FILE: string = path.join(PROJECT_ROOT, "index.ts.bak");
dotenv.config({ path: CONFIG_FILE });

let apiKey: string | undefined = process.env.API_KEY;
let ai: GoogleGenAI;
let localAI: OpenAI;

const rl = readline.createInterface({ input, output });

// --- Graceful Shutdown Handler ---
process.on('SIGINT', () => {
    console.log(chalk.yellow("\n[Signal] Shutting down Lucifer..."));
    rl.close();
    process.exit(0);
});

async function initializeApp(): Promise<void> {
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
    
    localAI = new OpenAI({
        baseURL: "http://localhost:1234/v1", 
        apiKey: "lm-studio",
        timeout: 60000, // 60s for M5 chip deep reasoning
    });
}

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
            description: "Surgical text replacement in a file.",
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
            description: "Create a Review Request for the Senior Agent (Gemini CLI).",
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
    return fs.existsSync(rootPath) ? rootPath : filePath;
}

function executeTool(name: string, args: any): string {
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
                return `Proposal saved to ${reviewPath}.`;

            case "get_system_info":
                console.log(chalk.yellow(`  [Action] Gathering health report...`));
                const uptime = execSync('uptime', { encoding: 'utf-8' }).trim();
                const battery = execSync('pmset -g batt', { encoding: 'utf-8' }).trim();
                return `📊 **System Health Report**\n\n**Uptime:** ${uptime}\n**Battery:**\n\`\`\`\n${battery}\n\`\`\``;

            default: return "Unknown tool";
        }
    } catch (error: any) { return `Error: ${error.message}`; }
}

async function main(): Promise<void> {
    await initializeApp(); 
    const isEvolving = process.argv.includes('--evolve');
    
    console.clear();
    console.log(chalk.cyan(`=== LUCIFER-HYBRID v3.5 ${isEvolving ? "(EVOLUTION)" : ""} ===`));
    console.log(chalk.gray(`Logic: Qwen 2.5 Coder (Local) | Vision: Gemini 1.5 (API)`));
    console.log(chalk.gray(`Path: ${PROJECT_ROOT}\n`));

    let history: any[] = [
        { 
            role: "system", 
            content: `You are Lucifer, a professional agentic AI. 
                     RULES:
                     1. After running a command, ALWAYS give a text summary.
                     2. Use Markdown for ALL responses.
                     3. If a tool fails, explain why and stop.`
        }
    ];

    while (true) {
        const query: string = await rl.question(chalk.green(`lucifer@m5 > `));
        if (['exit', 'quit'].includes(query.toLowerCase())) break;
        if (!query.trim()) continue;

        history.push({ role: "user", content: query });
        let loopCount = 0;
        let finalResponse = "";

        try {
            while (loopCount < 5) {
                const response = await localAI.chat.completions.create({
                    model: "qwen2.5-coder-7b-instruct-mlx",
                    messages: history,
                    tools: tools as any,
                });

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

            if (!finalResponse && loopCount >= 5) {
                finalResponse = "⚠️ [System] Model reached max reasoning steps without a text reply.";
            }

            console.log(chalk.white(finalResponse || "(No response generated)") + '\n');
        }
        catch (err: any) {
            console.log(chalk.red(`\nError: ${err.message}\n`));
        }
    }
    rl.close();
}

main().catch(console.error);