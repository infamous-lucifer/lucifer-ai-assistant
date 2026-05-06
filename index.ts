#!/usr/bin/env npx ts-node
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
const envPath = path.join(__dirname, '.env');

async function showFirstRunInstructions() {
  console.clear();
  const title = chalk.bold.white.bgBlue(' LUCIFER SETUP ');
  const border = '═'.repeat(68);

  console.log(`\n${chalk.blue(border)}`);
  console.log(`║${title.padEnd(68)}║`);
  console.log(`╠${chalk.blue(border)}╣`);
  console.log(chalk.white(`║ Welcome! This is your first time running Lucifer.                        ║`));
  console.log(chalk.white(`║                                                                    ║`));
  console.log(chalk.white(`║ 1) Open Google AI Studio and create an API key for Gemini models.   ║`));
  console.log(chalk.white(`║ 2) Use the free tier if available, then copy the full API key.      ║`));
  console.log(chalk.white(`║ 3) Paste the key below and press Enter.                             ║`));
  console.log(chalk.white(`╠${chalk.blue(border)}╣`));
  console.log(chalk.white(`║ Recommended model access: Gemini 2.5 Flash, Gemini 3.1 Flash Lite   ║`));
  console.log(chalk.white(`║ This tool will store your key locally in a .env file for you.       ║`));
  console.log(chalk.white(`╚${chalk.blue(border)}\n`));
}

function saveEnv(apiKey: string) {
  const content = `API_KEY=${apiKey.trim()}\n`;
  fs.writeFileSync(envPath, content, { encoding: 'utf-8', mode: 0o600 });
}

async function getApiKeyFromUser(): Promise<string> {
  await showFirstRunInstructions();
  const prompt = chalk.green('Paste your Google Gemini API key here: ');
  const inputKey = await rl.question(prompt);
  const apiKey = inputKey.trim();

  if (!apiKey) {
    console.log(chalk.red('\nNo API key entered. Please run the program again and paste your key.'));
    process.exit(1);
  }

  saveEnv(apiKey);
  console.log(chalk.green('\nAPI key saved to .env successfully. Starting Lucifer...\n'));
  return apiKey;
}

async function loadApiKey(): Promise<string> {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    if (process.env.API_KEY) {
      return process.env.API_KEY;
    }
  }

  return await getApiKeyFromUser();
}

const rl = readline.createInterface({ input, output });

// --- Rate Limit Tracking ---
const RATE_LIMIT_LOG = path.join(process.cwd(), '.rate-limits.json');

interface RateLimitData {
  date: string;
  models: {
    [model: string]: number;
  };
}

function loadRateLimitData(): RateLimitData {
  const today = new Date().toISOString().split('T')[0] as string;
  
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

function saveRateLimitData(data: RateLimitData) {
  fs.writeFileSync(RATE_LIMIT_LOG, JSON.stringify(data, null, 2));
}

function trackRequest(model: string | undefined) {
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
let cachedScreenHash: string | null = null;
let cachedScreenData: string | null = null;

async function getCachedScreenCapture(): Promise<string> {
  const screenshotPath = path.join(process.cwd(), 'screen.png');
  
  // Cross-platform screenshot command
  const platform = process.platform;
  let captureCommand: string;
  
  if (platform === 'darwin') {
    // macOS
    captureCommand = `screencapture -x ${screenshotPath}`;
  } else if (platform === 'linux') {
    // Linux (try scrot first, fallback to import)
    captureCommand = `scrot -z ${screenshotPath} || import -window root ${screenshotPath}`;
  } else if (platform === 'win32') {
    // Windows (requires nircmd or PowerShell)
    captureCommand = `nircmd.exe savescreenshot ${screenshotPath} || powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{PRTSC}'); Start-Sleep -Milliseconds 100; $img = [System.Windows.Forms.Clipboard]::GetImage(); $img.Save('${screenshotPath}')"`;
  } else {
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
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
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
let ai: GoogleGenAI;

async function searchWeb(query: string) {
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
async function seeScreen(query: string) {
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
  const apiKey = await loadApiKey();
  ai = new GoogleGenAI({ apiKey });

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
        
      } else if (query.startsWith('!screen')) {
        process.stdout.write(chalk.magenta("Analyzing screen with 3.1-Lite (500 RPD)..."));
        const result = await seeScreen(query.slice(8));
        console.log(`\n${chalk.white(result)}\n`);
        
      } else {
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
    } catch (err: any) {
      console.log(chalk.red(`\nError: ${err.message}\n`));
    }
  }
  rl.close();
}

main().catch(console.error);