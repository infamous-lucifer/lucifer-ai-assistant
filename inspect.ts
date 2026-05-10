import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'node:path';
import os from 'node:os';

const CONFIG_FILE = path.join(os.homedir(), '.lucifer-env');
dotenv.config({ path: CONFIG_FILE });

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error(`API_KEY missing in ${CONFIG_FILE}. Run "lucifer --setup" first.`);
}

const ai = new GoogleGenAI({ apiKey });

async function listMyModels() {
    try {
        console.log("Fetching your available models...");
        
        // This returns a Pager object
        const response = await ai.models.list();

        console.log("\n--- YOUR AUTHORIZED MODELS ---");
        
        // Pager objects in the 2026 SDK are async iterators
        for await (const model of response) {
            console.log(`> ${model.name}`);
        }
    } catch (error) {
        console.error("Failed to fetch models.");
        console.error(error);
    }
}

listMyModels();