import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { execSync, execFileSync } from 'node:child_process';
import type { AssistantConfig } from '../core/types.js';
import { Assistant } from '../core/assistant.js';
import { 
    truncateOutput, 
    resolveFilePath 
} from '../utils/index.js';
import { toolHandlers } from '../tools/index.js';
import { seeScreen } from '../utils/vision.js';

import { syncDependencies, runStatusCheck, buildIndex } from '../setup.js';
import { RecipeStorage } from '../storage/recipe.storage.js';

export async function startRepl(config: AssistantConfig, manifest: any, isEvolving: boolean, logsDir: string) {
    const assistant = new Assistant(config, manifest);
    const SESSION_ID = new Date().toISOString().replace(/[:.]/g, '-');
    const LOG_FILE = path.join(logsDir, `session-${SESSION_ID}.md`);
    const CONFIG_FILE = path.join(os.homedir(), '.lucifer-env');
    fs.writeFileSync(LOG_FILE, `# Lucifer Session — ${new Date().toLocaleString()}\n\n**Mode:** ${isEvolving ? 'Evolution' : 'Normal'}\n\n---\n\n`);

    console.log('\n' + chalk.cyan('─'.repeat(50)) + '\n');
    console.log(chalk.cyan(`=== LUCIFER-HYBRID v9.3 (HARDENED) ===`));
    console.log(chalk.gray(`Logic: Qwen 2.5 | Vision: Gemini 2.0`));
    console.log(chalk.gray(`Status: Architecture Decoupled | Security Hardened\n`));

    if (isEvolving) {
        console.log(chalk.magenta("  [Evolution] Running deterministic health checks..."));
        let outdatedData = "";
        try { outdatedData = execFileSync('npm', ['outdated', '--json'], { encoding: 'utf-8', timeout: 30000 }); } catch (e: any) { outdatedData = e.stdout?.toString() || "{}"; }
        const outdatedJson = JSON.parse(outdatedData || "{}");
        const packages = Object.keys(outdatedJson);
        if (packages.length === 0) {
            console.log(chalk.green("  [Evolution] System up to date."));
            return;
        }
        assistant.addSystemContext(`System Audit Complete. The following dependencies are outdated: ${packages.join(', ')}. Use 'propose_fix' to write a REVIEW_REQUEST.md.`);
        await assistant.chat("Please analyze the outdated dependencies and propose a fix.", LOG_FILE);
    }

    while (true) {
        try {
            const query = await config.rl.question(chalk.green(`lucifer@m5 > `));
            if (['exit', 'quit'].includes(query.toLowerCase())) break;
            if (!query.trim()) continue;

            // Handle special commands (!fix, !search, etc.)
            if (query === '!report') {
                process.stdout.write(chalk.blue("Generating Deep System Report...\n"));
                const handler = toolHandlers["get_deep_system_report"];
                const result = await handler(config, {}, new Set());
                console.log(`\n${chalk.white(result)}\n`);
                await assistant.chat(`User executed '!report'. Result was displayed. You may now comment on system health if necessary.`, LOG_FILE);
                continue;
            }

            if (query === '!test') {
                console.log(chalk.blue("Running project test suite...\n"));
                try {
                    const result = execSync('npm test', { encoding: 'utf-8', cwd: config.projectRoot });
                    console.log(result);
                    await assistant.chat(`User executed '!test'. Result:\n${result}`, LOG_FILE);
                } catch (e: any) {
                    const error = e.stdout?.toString() || e.message;
                    console.log(error);
                    await assistant.chat(`User executed '!test'. Result: FAILED\n${error}`, LOG_FILE);
                }
                continue;
            }

            if (query === '!status') {
                await runStatusCheck(config, CONFIG_FILE);
                continue;
            }

            if (query === '!lms') {
                const lmsPath = path.join(os.homedir(), '.lmstudio/bin/lms');
                console.log(chalk.blue("Checking LM Studio Status...\n"));
                try {
                    const status = execFileSync(lmsPath, ['status'], { encoding: 'utf-8', timeout: 5000 });
                    console.log(status);
                    assistant.addSystemContext(`User executed '!lms'. Status:\n${status}`);
                } catch (e: any) {
                    console.log(chalk.red("Error running lms command."));
                }
                continue;
            }

            if (query.startsWith('!tldr')) {
                const cmdName = query.replace('!tldr', '').trim();
                if (!cmdName) continue;
                process.stdout.write(chalk.blue(`Fetching cheat sheet for: ${cmdName}...\n`));
                const handler = toolHandlers["get_command_help"];
                const result = await handler(config, { command: cmdName }, new Set());
                console.log(`\n${chalk.white(result)}\n`);
                await assistant.chat(`User executed '!tldr ${cmdName}'. Cheat sheet was displayed.`, LOG_FILE);
                continue;
            }

            if (query === '!recipes') {
                const handler = toolHandlers["list_recipes"];
                await handler(config, {}, new Set());
                continue;
            }

            if (query.startsWith('!recipe')) {
                const title = query.replace('!recipe', '').trim();
                if (!title) continue;
                const handler = toolHandlers["read_recipe"];
                await handler(config, { title }, new Set());
                continue;
            }

            if (query.startsWith('!fix')) {
                const issue = query.replace('!fix', '').trim();
                if (!issue) continue;
                console.log(chalk.magenta(`\n  [Pipeline] Starting guided fix for: ${issue}`));
                const searchResult = await assistant.executeTool("keyword_search", { query: issue });
                const topFiles = searchResult.split('\n').filter(l => l.startsWith('- ')).map(l => l.replace('- ', '').split(' (')[0]);
                let context = "";
                for (const file of topFiles.slice(0, 2)) {
                    context += `\n--- FILE: ${file} ---\n${await assistant.executeTool("read_file", { path: file })}\n`;
                }
                await assistant.chat(`[GUIDED FIX MODE]\nISSUE: ${issue}\nCONTEXT:${context}\n\nTASK: Output ONLY the 'search_and_replace' JSON payload.`, LOG_FILE);
                continue;
            }

            if (query.startsWith('!search')) {
                const q = query.replace('!search', '').trim();
                if (!q) continue;
                const handler = toolHandlers["search_web"];
                if (!handler) {
                    console.log(chalk.red("Error: Search tool not found."));
                    continue;
                }
                const result = await handler(config, { query: q }, new Set());
                console.log(`\n${chalk.white(result)}\n`);
                await assistant.chat(`User executed '!search ${q}'. Result:\n${truncateOutput(result, 1000)}`, LOG_FILE);
                continue;
            }

            if (query.startsWith('!read')) {
                const p = query.replace('!read', '').trim();
                if (!p) continue;
                try {
                    const rPath = resolveFilePath(p, config.allowedRoots);
                    const content = fs.readFileSync(rPath, 'utf-8');
                    if (content.split('\n').length > 100) execFileSync('less', [], { input: content, stdio: ['pipe', 'inherit', 'inherit'] });
                    else console.log(`\n${chalk.white(content)}\n`);
                    await assistant.chat(`User executed '!read ${p}'. File content has been displayed to the user.`, LOG_FILE);
                } catch (e: any) { console.log(chalk.red(`Error: ${e.message}`)); }
                continue;
            }

            if (query.startsWith('!screen')) {
                const q = query.replace('!screen', '').trim();
                const result = await seeScreen(config, q);
                console.log(`\n${chalk.white(result)}\n`);
                await assistant.chat(`User executed '!screen ${q}'. Analysis:\n${result}`, LOG_FILE);
                continue;
            }

            if (query.startsWith('!clip')) {
                const q = query.replace('!clip', '').trim();
                const clipboardContent = execFileSync('pbpaste', [], { encoding: 'utf-8', timeout: 5000 });
                const safeContent = clipboardContent.replace(/<\/untrusted_clipboard_content>/g, '');
                await assistant.chat(`${q || 'Analyze clipboard'}:\n\n<untrusted_clipboard_content>\n${safeContent}\n</untrusted_clipboard_content>`, LOG_FILE);
                continue;
            }

            await assistant.chat(query, LOG_FILE);
        } catch (err: any) {
            console.log(chalk.red(`\nError: ${err.message}\n`));
        }
    }
}
