import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { AssistantConfig } from '../core/types.js';
import { highlightMarkdown } from './index.js';

export async function seeScreen(config: AssistantConfig, query: string): Promise<string> {
    if (!config.ai) return "Error: Gemini AI not initialized.";
    const screenshotPath = path.join(os.tmpdir(), `lucifer-screen-${Date.now()}.png`);
    try {
        execSync(`screencapture -x ${screenshotPath}`, { timeout: 10000 });
        const imageData = fs.readFileSync(screenshotPath).toString('base64');
        const model = config.ai.getGenerativeModel({ model: config.visionModelName });
        const result = await model.generateContent([
            query || "What is on my screen?",
            {
                inlineData: {
                    mimeType: "image/png",
                    data: imageData
                }
            }
        ]);
        const response = await result.response;
        return response.text() || "No analysis generated.";
    } catch (e: any) {
        return `Vision Error: ${e.message}`;
    } finally {
        if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
    }
}
