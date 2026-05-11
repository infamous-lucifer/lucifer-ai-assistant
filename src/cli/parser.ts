import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { AssistantConfig } from '../core/types.js';
import { highlightMarkdown, Spinner } from '../utils/index.js';
import { toolHandlers } from '../tools/index.js';
import { stdin } from 'node:process';
import { seeScreen } from '../utils/vision.js';

const execAsync = promisify(exec);

export async function handleOneShot(config: AssistantConfig, args: string[]) {
    const isPiped = !stdin.isTTY;
    const isJsonMode = args.includes('--json');
    const isCommandMode = args.includes('--command') || args.includes('-c');
    
    let visionQuery: string | undefined;
    let searchQuery: string | undefined;
    const visionIdx = args.indexOf('--vision');
    const searchIdx = args.indexOf('--search');
    
    if (visionIdx !== -1) visionQuery = args[visionIdx + 1] || "";
    if (searchIdx !== -1) searchQuery = args[searchIdx + 1] || "";

    const positionalArgs = args.filter((a, i) => {
        if (a.startsWith('-')) return false;
        if (i > 0 && ['--vision', '--search'].includes(args[i-1] || "")) return false;
        return true;
    });
    const oneShotQuery = positionalArgs.join(' ');

    let pipedData = "";
    if (isPiped) {
        const chunks = [];
        for await (const chunk of stdin) chunks.push(chunk);
        pipedData = Buffer.concat(chunks).toString('utf-8');
    }

    let fullPrompt = `${oneShotQuery}${pipedData ? '\n\nCONTEXT:\n' + pipedData : ''}`;
    
    if (visionQuery !== undefined) {
        console.log(chalk.magenta("  [Vision] Analyzing screen..."));
        const result = await seeScreen(config, visionQuery);
        console.log(`\n${highlightMarkdown(result)}\n`);
        return;
    }

    if (searchQuery) {
        console.log(chalk.blue(`  [Search] Researching: ${searchQuery}...`));
        const result = await toolHandlers["search_web"](config, { query: searchQuery }, new Set());
        console.log(`\n${highlightMarkdown(result)}\n`);
        return;
    }

    if (isJsonMode) fullPrompt += "\n\nRespond ONLY in valid JSON format.";
    if (isCommandMode) fullPrompt += "\n\nRespond ONLY with the single most appropriate macOS terminal command to achieve this. Do not include markdown blocks or explanations.";

    const spinner = new Spinner("Lucifer is processing...");
    spinner.start();
    
    try {
        if (!config.localAI) throw new Error("Local AI not initialized.");
        const response = await config.localAI.chat.completions.create({
            model: config.modelName,
            messages: [{ role: "user", content: fullPrompt }],
            stream: false
        });
        spinner.stop();
        
        const rawOutput = response.choices[0]?.message?.content || "";
        const output = highlightMarkdown(rawOutput);
        console.log(`\n${output}\n`);

        if (isCommandMode) {
            const command = rawOutput.trim().replace(/^`+|`+$/g, '');
            const approved = await config.rl.question(chalk.yellow(`  Execute this command? (y/n/explain): `));
            if (approved.toLowerCase() === 'y') {
                const { stdout, stderr } = await execAsync(command);
                if (stdout) console.log(chalk.gray(stdout));
                if (stderr) console.error(chalk.red(stderr));
            } else if (approved.toLowerCase() === 'e' || approved.toLowerCase() === 'explain') {
                const explanation = await config.localAI.chat.completions.create({
                    model: config.modelName,
                    messages: [{ role: "user", content: `Explain exactly what this macOS command does: ${command}` }]
                });
                console.log(`\n${highlightMarkdown(explanation.choices[0]?.message?.content || "")}\n`);
            }
        }
    } catch (e: any) {
        spinner.stop("Failed.", 'red');
        console.error(chalk.red(`Error: ${e.message}`));
        process.exit(1);
    }
}
