#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

// --- Global Configuration Setup ---
const CONFIG_FILE: string = path.join(os.homedir(), '.lucifer-env');
dotenv.config({ path: CONFIG_FILE });

let apiKey: string | undefined = process.env.API_KEY;
let ai: GoogleGenAI;

const rl = readline.createInterface({ input, output });

async function initializeApp(): Promise<void> {
    if (!apiKey) {
        console.log(chalk.yellow("\n=== First Time Setup ==="));
        console.log(chalk.gray("Get your free Gemini API key from: https://makersuite.google.com/app/apikey"));
        
        apiKey = await rl.question(chalk.green('Enter your API Key: '));
        
        if (!apiKey || !apiKey.trim()) {
            console.log(chalk.red("Error: API Key cannot be empty. Exiting."));
            process.exit(1);
        }

        // Save it globally so they never have to enter it again
        fs.writeFileSync(CONFIG_FILE, `API_KEY=${apiKey.trim()}\n`);
        console.log(chalk.cyan(`\nSuccess! Key saved securely to ${CONFIG_FILE}`));
        console.log(chalk.gray("Starting Lucifer...\n"));
    }

    ai = new GoogleGenAI({ apiKey: apiKey.trim() });
}

// --- Rate Limit Tracking ---
const RATE_LIMIT_LOG: string = path.join(os.homedir(), '.lucifer-rate-limits.json');

interface RateLimitData {
    date: string;
    models: Record<string, number>;
}

function loadRateLimitData(): RateLimitData {
    const today: string = new Date().toISOString().split('T')[0]!;
    
    // Explicitly define the default data to satisfy strict type checks
    const defaultData: RateLimitData = { 
        date: today, 
        models: {} as Record<string, number> 
    };

    if (fs.existsSync(RATE_LIMIT_LOG)) {
        try {
            // Use 'as RateLimitData' instead of type declaration for the any-return of JSON.parse
            const data = JSON.parse(fs.readFileSync(RATE_LIMIT_LOG, 'utf-8')) as RateLimitData;
            
            if (data.date !== today) {
                return defaultData;
            }
            return data;
        } catch {
            // Removed the unused 'e' variable
            return defaultData;
        }
    }
    return defaultData;
}

function saveRateLimitData(data: RateLimitData): void {
    fs.writeFileSync(RATE_LIMIT_LOG, JSON.stringify(data, null, 2));
}

function trackRequest(model: string): void {
    if (!model) {
        console.log(chalk.yellow("  [Warning: No model specified]"));
        return;
    }
    const data = loadRateLimitData();
    data.models[model] = (data.models[model] || 0) + 1;
    saveRateLimitData(data);
    console.log(chalk.gray(`  [${model}: ${data.models[model]} req today]`));
}

function showRateLimits(): void {
    const data = loadRateLimitData();
    console.log(chalk.cyan('\n--- Rate Limit Usage ---'));
    Object.entries(data.models).forEach(([model, count]) => {
        const limit: number = model === 'gemini-2.5-flash' ? 1500 : 500;
        const percentage: number = Math.round((count / limit) * 100);
        const bar: string = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
        console.log(chalk.gray(`${model}: ${bar} ${count}/${limit} (${percentage}%)`));
    });
    console.log();
}

// --- Screen Capture Caching ---
let cachedScreenHash: string | null = null;
let cachedScreenData: string | null = null;

async function getCachedScreenCapture(): Promise<string> {
    const screenshotPath: string = path.join(os.tmpdir(), 'lucifer-screen.png');
    const platform: NodeJS.Platform = process.platform;
    let captureCommand: string;
    
    if (platform === 'darwin') {
        captureCommand = `screencapture -x ${screenshotPath}`;
    }
    else if (platform === 'linux') {
        captureCommand = `scrot -z ${screenshotPath} || import -window root ${screenshotPath}`;
    }
    else if (platform === 'win32') {
        captureCommand = `nircmd.exe savescreenshot ${screenshotPath} || powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{PRTSC}'); Start-Sleep -Milliseconds 100; $img = [System.Windows.Forms.Clipboard]::GetImage(); $img.Save('${screenshotPath}')"`;
    }
    else {
        throw new Error(`Unsupported platform: ${platform}. Please implement screenshot capture for your OS.`);
    }
    
    execSync(captureCommand);
    const data: Buffer = fs.readFileSync(screenshotPath);
    const hash: string = crypto.createHash('sha256').update(data).digest('hex');
    
    if (hash === cachedScreenHash && cachedScreenData) {
        console.log(chalk.yellow('  [Using cached screenshot]'));
        fs.unlinkSync(screenshotPath);
        return cachedScreenData;
    }
    
    cachedScreenHash = hash;
    cachedScreenData = data.toString('base64');
    fs.unlinkSync(screenshotPath);
    return cachedScreenData;
}

// --- Retry Logic with Exponential Backoff ---
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, initialDelayMs = 1000): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err: any) {
            lastError = err;
            if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
                if (attempt < maxRetries) {
                    const delayMs: number = initialDelayMs * Math.pow(2, attempt);
                    console.log(chalk.yellow(`\n  Rate limited. Retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`));
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
            }
            throw err;
        }
    }
    throw lastError;
}

// --- Optimized Multi-Model Logic ---
async function searchWeb(query: string): Promise<string> {
    return retryWithBackoff(async () => {
        trackRequest('gemini-2.5-flash');
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: query,
            config: { tools: [{ googleSearch: {} }] }
        });
        return response.text || "No response generated.";
    });
}

async function seeScreen(query: string): Promise<string> {
    return retryWithBackoff(async () => {
        trackRequest('gemini-3.1-flash-lite-preview');
        const base64Image = await getCachedScreenCapture();
        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [
                { text: query || "What is on my screen?" },
                { inlineData: { mimeType: "image/png", data: base64Image } }
            ]
        });
        return response.text || "No response generated.";
    });
}

// --- The Main Logic ---
async function main(): Promise<void> {
    await initializeApp(); 
    
    console.clear();
    console.log(chalk.cyan("=== LUCIFER: LIMIT-OPTIMIZED ASSISTANT ==="));
    console.log(chalk.gray("Mode: Multi-Model (Lite for Chat, 2.5 for Search)"));
    console.log(chalk.gray("Features: Rate Limit Tracking, Screen Caching, Retry Logic"));
    console.log(chalk.gray("Commands: !search <query>, !screen [query], !limits, exit\n"));
    
    while (true) {
        const query: string = await rl.question(chalk.green('lucifer@m5-air > '));
        
        if (query.toLowerCase() === 'exit') {
            showRateLimits();
            break;
        }
        
        if (query.toLowerCase() === '!limits') {
            showRateLimits();
            continue;
        }
        
        try {
            if (query.startsWith('!search')) {
                process.stdout.write(chalk.blue("Searching web with 2.5-Flash (1.5K RPD)..."));
                const result = await searchWeb(query.slice(8));
                console.log(`\n${chalk.white(result)}\n`);
            }
            else if (query.startsWith('!screen')) {
                process.stdout.write(chalk.magenta("Analyzing screen with 3.1-Lite (500 RPD)..."));
                const result = await seeScreen(query.slice(8));
                console.log(`\n${chalk.white(result)}\n`);
            }
            else {
                trackRequest('gemini-3.1-flash-lite-preview');
                const response = await retryWithBackoff(async () => {
                    return ai.models.generateContent({
                        model: "gemini-3.1-flash-lite-preview",
                        contents: query
                    });
                });
                console.log(chalk.white(response.text || "") + '\n');
            }
        }
        catch (err: any) {
            console.log(chalk.red(`\nError: ${err.message}\n`));
        }
    }
    rl.close();
}

main().catch(console.error);