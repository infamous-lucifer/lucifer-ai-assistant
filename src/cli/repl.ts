import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { AssistantConfig } from '../core/types.js';
import { Assistant } from '../core/assistant.js';
import { 
    truncateOutput, 
    resolveFilePath 
} from '../utils/index.js';
import { toolHandlers } from '../tools/index.js';
import { seeScreen } from '../utils/vision.js';

export async function startRepl(config: AssistantConfig, manifest: any, isEvolving: boolean, logsDir: string) {
    const assistant = new Assistant(config, manifest);
    const SESSION_ID = new Date().toISOString().replace(/[:.]/g, '-');
    const LOG_FILE = path.join(logsDir, `session-${SESSION_ID}.md`);
    fs.writeFileSync(LOG_FILE, `# Lucifer Session — ${new Date().toLocaleString()}\n\n**Mode:** ${isEvolving ? 'Evolution' : 'Normal'}\n\n---\n\n`);

    console.log('\n' + chalk.cyan('─'.repeat(50)) + '\n');
    console.log(chalk.cyan(`=== LUCIFER-HYBRID v9.3 (HARDENED) ===`));
    console.log(chalk.gray(`Logic: Qwen 2.5 | Vision: Gemini 2.0`));
    console.log(chalk.gray(`Status: Architecture Decoupled | Security Hardened\n`));

    if (isEvolving) {
        console.log(chalk.magenta("  [Evolution] Running deterministic health checks..."));
        let outdatedData = "";
        try { outdatedData = execSync('npm outdated --json', { encoding: 'utf-8', timeout: 30000 }); } catch (e: any) { outdatedData = e.stdout?.toString() || "{}"; }
        const outdatedJson = JSON.parse(outdatedData || "{}");
        const packages = Object.keys(outdatedJson);
        if (packages.length === 0) {
            console.log(chalk.green("  [Evolution] System up to date."));
            return;
        }
        assistant.addSystemContext(`System Audit Complete. The following dependencies are outdated: ${packages.join(', ')}. Use 'propose_fix' to write a REVIEW_REQUEST.md.`);
    }

    while (true) {
        try {
            const query = await config.rl.question(chalk.green(`lucifer@m5 > `));
            if (['exit', 'quit'].includes(query.toLowerCase())) break;
            if (!query.trim()) continue;

            // Handle special commands (!fix, !search, etc.)
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
                assistant.addSystemContext(`[GUIDED FIX MODE]\nISSUE: ${issue}\nCONTEXT:${context}\n\nTASK: Output ONLY the 'search_and_replace' JSON payload.`);
                continue;
            }

            if (query.startsWith('!search')) {
                const q = query.replace('!search', '').trim();
                if (!q) continue;
                const result = await toolHandlers["search_web"](config, { query: q }, new Set());
                console.log(`\n${chalk.white(result)}\n`);
                assistant.addSystemContext(`User executed '!search ${q}'. Result:\n${truncateOutput(result, 1000)}`);
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
                    assistant.addSystemContext(`User executed '!read ${p}'.`);
                } catch (e: any) { console.log(chalk.red(`Error: ${e.message}`)); }
                continue;
            }

            if (query.startsWith('!screen')) {
                const result = await seeScreen(config, query.replace('!screen', '').trim());
                console.log(`\n${chalk.white(result)}\n`);
                assistant.addSystemContext(`User executed '!screen'. Analysis:\n${result}`);
                continue;
            }

            if (query.startsWith('!clip')) {
                const clipboardContent = execSync('pbpaste', { encoding: 'utf-8', timeout: 5000 });
                assistant.addSystemContext(`User executed '!clip'. CLIPBOARD CONTENT:\n<untrusted_clipboard_content>\n${clipboardContent}\n</untrusted_clipboard_content>`);
                continue;
            }

            await assistant.chat(query, LOG_FILE);
        } catch (err: any) {
            console.log(chalk.red(`\nError: ${err.message}\n`));
        }
    }
}
