import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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