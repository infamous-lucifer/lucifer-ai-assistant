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

// --- Global Configuration Setup ---
const CONFIG_FILE: string = path.join(os.homedir(), '.lucifer-env');
dotenv.config({ path: CONFIG_FILE });

let apiKey: string | undefined = process.env.API_KEY;
let ai: GoogleGenAI;
let localAI: OpenAI;

const rl = readline.createInterface({ input, output });

// --- Graceful Shutdown Handler ---
process.on('SIGINT', () => {
    console.log(chalk.yellow("\n[Signal] Interrupt received. Shutting down Lucifer safely..."));
    rl.close();
    process.exit(0);
});

async function initializeApp(): Promise<void> {
    if (!apiKey) {
        console.log(chalk.yellow("\n=== First Time Setup ==="));
        apiKey = await rl.question(chalk.green('Enter your Gemini API Key (for Vision): '));
        if (apiKey) fs.writeFileSync(CONFIG_FILE, `API_KEY=${apiKey.trim()}\n`);
    }
    
    ai = new GoogleGenAI({ apiKey: apiKey!.trim() });

    try {
        const lmsPath = path.join(os.homedir(), '.lmstudio/bin/lms');
        const status = execSync(`${lmsPath} status`, { encoding: 'utf-8' });
        if (status.includes('Server: OFF')) {
            process.stdout.write(chalk.yellow("Local server is OFF. Starting lms daemon..."));
            execSync(`${lmsPath} daemon up`);
            console.log(chalk.green(" Done."));
        }
    } catch (e) {
        console.log(chalk.gray("[Note] Could not verify local server via 'lms' CLI. Ensure it is started manually."));
    }
    
    localAI = new OpenAI({
        baseURL: "http://localhost:1234/v1", 
        apiKey: "lm-studio",
        timeout: 45000, 
    });
}

const tools = [
    {
        type: "function",
        function: {
            name: "run_command",
            description: "Execute a shell command on the user's Mac. Use this for all file system operations (list, read, create, delete, move) and system checks.",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "The exact shell command to run."
                    }
                },
                required: ["command"]
            }
        }
    }
];

function executeTool(name: string, args: any): string {
    if (name === "run_command") {
        const forbidden = ['rm -rf /', 'sudo', '.env', 'API_KEY'];
        if (forbidden.some(word => args.command.includes(word))) {
            return "Error: Security guard rail blocked this command.";
        }

        try {
            console.log(chalk.yellow(`  [Action] ${args.command}`));
            const output = execSync(args.command, { encoding: 'utf-8', timeout: 15000 });
            return output || "(Command executed successfully, no output)";
        } catch (error: any) {
            return `Error: ${error.message || "Command failed"}`;
        }
    }
    return "Unknown tool";
}

async function seeScreen(query: string): Promise<string> {
    try {
        const screenshotPath: string = path.join(os.tmpdir(), 'lucifer-screen.png');
        execSync(`screencapture -x ${screenshotPath}`);
        const data: Buffer = fs.readFileSync(screenshotPath);
        const base64Image = data.toString('base64');
        fs.unlinkSync(screenshotPath);

        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const response = await model.generateContent([
            { text: query || "What is on my screen?" },
            { inlineData: { mimeType: "image/png", data: base64Image } }
        ]);
        return response.response.text();
    } catch (e: any) {
        return `Vision Error: ${e.message}`;
    }
}

async function main(): Promise<void> {
    await initializeApp(); 
    
    console.clear();
    console.log(chalk.cyan("=== LUCIFER-HYBRID v2 (GUARD RAILS ENABLED) ==="));
    console.log(chalk.gray("Local Brain: Qwen 2.5 Coder (via LM Studio)"));
    console.log(chalk.gray("Vision: Gemini Flash API"));
    console.log(chalk.gray("Press Ctrl+C to stop or exit mid-process.\n"));

    let history: any[] = [
        { 
            role: "system", 
            content: "You are Lucifer, a professional agentic AI assistant for macOS. " +
                     "OUTPUT RULES: " +
                     "1. Use Markdown for ALL responses. " +
                     "2. Format code snippets or terminal commands inside backticks (e.g., `ls -la`) or triple-backtick blocks with the language (e.g., ```python). " +
                     "3. Be concise and professional. " +
                     "4. After running a command, explain what you did and show any relevant output in a structured way. " +
                     "5. Max 5 tool calls per user prompt. " +
                     "6. Always ensure the user can copy-paste your code blocks directly."
        }
    ];

    while (true) {
        const query: string = await rl.question(chalk.green('lucifer@m5 > '));
        if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') break;
        if (!query.trim()) continue;

        try {
            if (query.startsWith('!screen')) {
                process.stdout.write(chalk.magenta("Analyzing screen..."));
                const result = await seeScreen(query.slice(8));
                console.log(`\n${chalk.white(result)}\n`);
                continue;
            }

            history.push({ role: "user", content: query });
            
            let loopCount = 0;
            const MAX_LOOPS = 5;

            while (loopCount < MAX_LOOPS) {
                const response = await localAI.chat.completions.create({
                    model: "qwen2.5-coder-7b-instruct-mlx",
                    messages: history,
                    tools: tools as any,
                });

                const assistantMsg = response.choices[0].message;
                history.push(assistantMsg);

                if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
                    console.log(chalk.white(assistantMsg.content || "") + '\n');
                    break;
                }

                for (const toolCall of assistantMsg.tool_calls) {
                    const toolResult = executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
                    history.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: toolResult
                    });
                }
                loopCount++;
            }

            if (loopCount >= MAX_LOOPS) {
                console.log(chalk.red("[Safety] Maximum reasoning steps reached. Handing back to user."));
            }
        }
        catch (err: any) {
            console.log(chalk.red(`\nError: ${err.message}`));
            if (err.message.includes('ECONNREFUSED')) {
                console.log(chalk.gray("Check if LM Studio is running on port 1234.\n"));
            }
        }
    }
    rl.close();
}

main().catch(console.error);