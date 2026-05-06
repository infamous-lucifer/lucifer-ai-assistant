#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
const apiKey = process.env.API_KEY;
if (!apiKey) {
    throw new Error("API_KEY environment variable is required. Check the .env file in the project folder.");
}
const ai = new GoogleGenAI({ apiKey });
const rl = readline.createInterface({ input, output });
// --- Rate Limit Tracking ---
const RATE_LIMIT_LOG = path.join(process.cwd(), '.rate-limits.json');
function loadRateLimitData() {
    const today = new Date().toISOString().split('T')[0];
    if (fs.existsSync(RATE_LIMIT_LOG)) {
        const data = JSON.parse(fs.readFileSync(RATE_LIMIT_LOG, 'utf-8'));
        // Reset if different day
        if (data.date !== today) {
            return { date: today, models: {} };
        }
        return data;
    }
    return { date: today, models: {} };
}
function saveRateLimitData(data) {
    fs.writeFileSync(RATE_LIMIT_LOG, JSON.stringify(data, null, 2));
}
function trackRequest(model) {
    if (!model) {
        console.log(chalk.yellow("  [Warning: No model specified]"));
        return;
    }
    const data = loadRateLimitData();
    data.models[model] = (data.models[model] || 0) + 1;
    saveRateLimitData(data);
    console.log(chalk.gray(`  [${model}: ${data.models[model]} req today]`));
}
function showRateLimits() {
    const data = loadRateLimitData();
    console.log(chalk.cyan('\n--- Rate Limit Usage ---'));
    Object.entries(data.models).forEach(([model, count]) => {
        const limit = model === 'gemini-2.5-flash' ? 1500 : 500;
        const percentage = Math.round((count / limit) * 100);
        const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
        console.log(chalk.gray(`${model}: ${bar} ${count}/${limit} (${percentage}%)`));
    });
    console.log();
}
// --- Screen Capture Caching ---
let cachedScreenHash = null;
let cachedScreenData = null;
async function getCachedScreenCapture() {
    const screenshotPath = path.join(process.cwd(), 'screen.png');
    // Cross-platform screenshot command
    const platform = process.platform;
    let captureCommand;
    if (platform === 'darwin') {
        // macOS
        captureCommand = `screencapture -x ${screenshotPath}`;
    }
    else if (platform === 'linux') {
        // Linux (try scrot first, fallback to import)
        captureCommand = `scrot -z ${screenshotPath} || import -window root ${screenshotPath}`;
    }
    else if (platform === 'win32') {
        // Windows (requires nircmd or PowerShell)
        captureCommand = `nircmd.exe savescreenshot ${screenshotPath} || powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{PRTSC}'); Start-Sleep -Milliseconds 100; $img = [System.Windows.Forms.Clipboard]::GetImage(); $img.Save('${screenshotPath}')"`;
    }
    else {
        throw new Error(`Unsupported platform: ${platform}. Please implement screenshot capture for your OS.`);
    }
    execSync(captureCommand);
    const data = fs.readFileSync(screenshotPath);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    // Check if screen changed
    if (hash === cachedScreenHash && cachedScreenData) {
        console.log(chalk.yellow('  [Using cached screenshot]'));
        fs.unlinkSync(screenshotPath);
        return cachedScreenData;
    }
    // Cache new screenshot
    cachedScreenHash = hash;
    cachedScreenData = data.toString('base64');
    fs.unlinkSync(screenshotPath);
    return cachedScreenData;
}
// --- Retry Logic with Exponential Backoff ---
async function retryWithBackoff(fn, maxRetries = 3, initialDelayMs = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            // Check if it's a rate limit error
            if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
                if (attempt < maxRetries) {
                    const delayMs = initialDelayMs * Math.pow(2, attempt);
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
// 1. Search: Uses 2.5 Flash because it has 1,500 Search Grounding limits
async function searchWeb(query) {
    return retryWithBackoff(async () => {
        trackRequest('gemini-2.5-flash');
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: query,
            config: { tools: [{ googleSearch: {} }] }
        });
        return response.text;
    });
}
// 2. Vision: Uses 3.1 Flash Lite (500 RPD) instead of Computer Use (0 RPD)
async function seeScreen(query) {
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
        return response.text;
    });
}
// --- The Main Logic ---
async function main() {
    console.clear();
    console.log(chalk.cyan("=== LUCIFER: LIMIT-OPTIMIZED ASSISTANT ==="));
    console.log(chalk.gray("Mode: Multi-Model (Lite for Chat, 2.5 for Search)"));
    console.log(chalk.gray("Features: Rate Limit Tracking, Screen Caching, Retry Logic"));
    console.log(chalk.gray("Commands: !search <query>, !screen [query], !limits, exit\n"));
    while (true) {
        const query = await rl.question(chalk.green('lucifer@m5-air > '));
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
                // Default Chat: Uses 3.1 Flash Lite
                trackRequest('gemini-3.1-flash-lite-preview');
                const response = await retryWithBackoff(async () => {
                    return ai.models.generateContent({
                        model: "gemini-3.1-flash-lite-preview",
                        contents: query
                    });
                });
                console.log(chalk.white(response.text) + '\n');
            }
        }
        catch (err) {
            console.log(chalk.red(`\nError: ${err.message}\n`));
        }
    }
    rl.close();
}
main().catch(console.error);
//# sourceMappingURL=index.js.map