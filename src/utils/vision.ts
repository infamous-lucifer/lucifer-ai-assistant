import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import type { AssistantConfig } from '../core/types.js';
import { highlightMarkdown } from './index.js';
import crypto from 'node:crypto';
import chalk from 'chalk';

export async function seeScreen(config: AssistantConfig, query: string): Promise<string> {
    if (!config.ai) return "Error: Gemini AI not initialized.";
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const screenshotPath = path.join(os.tmpdir(), `lucifer-screen-${randomSuffix}.png`);
    try {
        console.log(chalk.gray("  [Vision] Capturing frontmost window..."));
        // Attempt to get the window ID of the frontmost application
        let windowId = "";
        try {
            windowId = execFileSync('osascript', ['-e', 'tell application "System Events" to get id of window 1 of (first process whose frontmost is true)'], { encoding: 'utf-8', timeout: 5000 }).trim();
        } catch (e) {}

        if (windowId && !isNaN(Number(windowId))) {
            execFileSync('screencapture', ['-l', windowId, '-x', screenshotPath], { timeout: 10000 });
        } else {
            // Fallback to interactive window selection if ID fails, or just the main screen if in non-interactive mode
            // For now, we use -x to avoid the capture sound and just capture the main display as a fallback
            execFileSync('screencapture', ['-x', screenshotPath], { timeout: 10000 });
        }

        const imageData = fs.readFileSync(screenshotPath).toString('base64');
        const result = await config.ai.models.generateContent({
            model: config.visionModelName,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: query || "What is on my screen?" },
                        { inlineData: { mimeType: "image/png", data: imageData } }
                    ]
                }
            ]
        });
        return result.text || "No analysis generated.";
    } catch (e: any) {
        return `Vision Error: ${e.message}`;
    } finally {
        if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
    }
}
