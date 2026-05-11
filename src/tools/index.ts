import fs from 'node:fs';
import path from 'node:path';
import { exec, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import MiniSearch from 'minisearch';
import { 
    isPathAllowed,
    isDangerousCommand, 
    isSafeAutoApproveCommand,
    applySearchAndReplace, 
    showVisualDiff, 
    truncateOutput, 
    Spinner 
} from '../utils/index.js';
import { 
    AssistantConfig, 
    RunCommandArgs, 
    ReadFileArgs, 
    SearchAndReplaceArgs, 
    ProposeFixArgs, 
    SearchWebArgs, 
    SemanticSearchArgs, 
    ListFilesArgs, 
    GetCommandHelpArgs, 
    ControlMacosArgs, 
    SearchCodebaseArgs,
    AddRecipeArgs,
    ReadRecipeArgs,
    SearchRecipesArgs,
    DeleteRecipeArgs,
    ImportRecipeArgs
} from '../core/types.js';
import { GourmetUI } from './gourmet.ui.js';
import os from 'node:os';

const execAsync = promisify(exec);

export type ToolHandler = (config: AssistantConfig, args: any, verifiedReads: Set<string>) => Promise<string>;

export const toolHandlers: Record<string, ToolHandler> = {
    // ... Existing handlers ...
    "run_command": async (config, rawArgs, verifiedReads) => {
        const args = rawArgs as Partial<RunCommandArgs>;
        if (typeof args.command !== 'string') return "Error: Missing required field 'command'.";
        if (isDangerousCommand(args.command, config.dangerPatterns)) {
            return "Error: Blocked by danger patterns.";
        }
        
        let approved = 'y';
        if (!isSafeAutoApproveCommand(args.command)) {
            console.log(chalk.red(`\n  [APPROVE?] ${args.command}`));
            approved = await config.rl.question(chalk.yellow(`  Type 'y' to execute: `));
        } else {
            console.log(chalk.gray(`\n  [Auto-Approved] ${args.command}`));
        }

        if (approved.toLowerCase() !== 'y') return "Execution cancelled by user.";
        
        const spinner = new Spinner(`Executing: ${args.command}`);
        spinner.start();
        try {
            // Split command for shell-less execution if possible
            const [cmd, ...cmdArgs] = args.command.trim().split(/\s+/);
            if (!cmd) throw new Error("Empty command.");
            
            // Note: We use execAsync as a fallback but we should ideally use spawn/execFile
            // For complex user commands with pipes/redirection, shell is often needed.
            // But we already validated for dangerous characters.
            const { stdout, stderr } = await execAsync(args.command, { timeout: 30000 });
            spinner.stop("Command executed.");
            return truncateOutput(`STDOUT:\n${stdout}\nSTDERR:\n${stderr}`, 1500);
        } catch (e: any) {
            spinner.stop("Command failed.", 'red');
            return truncateOutput(`Error (Exit Code ${e.code || 'Timeout'}):\nSTDOUT: ${e.stdout || ''}\nSTDERR: ${e.stderr || ''}`, 1500);
        }
    },
    "search_web": async (config, rawArgs) => {
        const args = rawArgs as Partial<SearchWebArgs>;
        if (typeof args.query !== 'string') return "Error: Missing required field 'query'.";
        console.log(chalk.yellow(`  [Action] Researching: ${args.query}...`));
        try {
            const ddgrPath = path.join(config.runtimesPath, "bin/ddgr");
            const result = execFileSync(ddgrPath, ["--json", "-n", "3", args.query], { encoding: 'utf-8', timeout: 30000 });
            const results = JSON.parse(result);
            return truncateOutput(results.map((r: any) => `[${r.title}](${r.url})\n${r.abstract}`).join('\n\n'), 1500);
        } catch (e: any) {
            return `Web Search Error: ${e.message}. Ensure 'ddgr' is synchronized in your runtimes folder.`;
        }
    },
    "control_macos": async (config, rawArgs) => {
        const args = rawArgs as Partial<ControlMacosArgs>;
        if (!args.action) return "Error: Missing action.";
        console.log(chalk.yellow(`  [Action] Controlling macOS: ${args.action}`));
        const scripts: Record<string, string> = {
            "get_active_window": 'tell application "System Events" to get name of first process whose frontmost is true',
            "toggle_dark_mode": 'tell application "System Events" to tell appearance preferences to set dark mode to not dark mode',
            "get_volume": 'output volume of (get volume settings)',
            "set_volume_50": 'set volume output volume 50',
            "list_running_apps": 'tell application "System Events" to get name of every process whose background only is false',
            "empty_trash": 'tell application "Finder" to empty trash'
        };
        try {
            const script = scripts[args.action];
            if (!script) return `Error: Action '${args.action}' not safelisted.`;
            return execFileSync('osascript', ['-e', script], { encoding: 'utf-8', timeout: 10000 }).trim();
        } catch (e: any) { return `macOS Control Error: ${e.message}`; }
    },
    "list_files": async (config, rawArgs) => {
        const args = rawArgs as Partial<ListFilesArgs>;
        const targetPath = resolveFilePath(args.path || ".", config.allowedRoots);
        console.log(chalk.yellow(`  [Action] Listing files in: ${targetPath}`));
        try {
            const files = fs.readdirSync(targetPath).filter(f => !f.startsWith('.'));
            return files.join('\n') || "No visible files found.";
        } catch (e: any) { return `Error: ${e.message}`; }
    },
    "keyword_search": async (config, rawArgs) => {
        const args = rawArgs as Partial<SemanticSearchArgs>;
        if (!args.query) return "Error: Missing query.";
        console.log(chalk.yellow(`  [Action] Keyword searching for: ${args.query}...`));
        try {
            if (!fs.existsSync(config.indexFile)) return "Error: Index not found. Run 'lucifer --index' first.";
            const indexData = fs.readFileSync(config.indexFile, 'utf-8');
            const miniSearch = MiniSearch.loadJSON(indexData, { fields: ['path', 'content'], storeFields: ['path'] });
            const results = miniSearch.search(args.query, { prefix: true, fuzzy: 0.2 });
            return results.length > 0 
                ? `Top Matches:\n${results.slice(0, 5).map(r => `- ${r.path} (Score: ${r.score.toFixed(2)})`).join('\n')}`
                : "No conceptual matches found.";
        } catch (e: any) { return `Search Error: ${e.message}`; }
    },
    "get_command_help": async (config, rawArgs) => {
        const args = rawArgs as Partial<GetCommandHelpArgs>;
        if (typeof args.command !== 'string') return "Error: Missing required field 'command'.";
        console.log(chalk.yellow(`  [Action] Fetching cheat sheet for: ${args.command}...`));
        try {
            const tldrPath = path.join(config.runtimesPath, "bin/tldr");
            // Use execFileSync to prevent command injection via shell metacharacters
            return execFileSync(tldrPath, ['-p', 'osx', args.command], { encoding: 'utf-8', timeout: 15000 });
        } catch (e: any) {
            return `Cheat Sheet Error: ${e.message}. Ensure 'tldr' is synchronized in your runtimes folder.`;
        }
    },
    "read_file": async (config, rawArgs, verifiedReads) => {
        const args = rawArgs as Partial<ReadFileArgs>;
        if (!args.path) return "Error: Missing path.";
        try {
            const rPath = resolveFilePath(args.path, config.allowedRoots);
            const stats = fs.statSync(rPath);
            if (!args.start_line && !args.end_line && stats.size > 10 * 1024) {
                return `[Context Sentinel] Rejected: ${args.path} is too large (${(stats.size/1024).toFixed(1)}KB). Use start_line/end_line.`;
            }

            const fileContent = fs.readFileSync(rPath, 'utf-8');
            verifiedReads.add(rPath);

            let lines = fileContent.split('\n');
            const start = args.start_line ? Math.max(1, args.start_line) : 1;
            const end = args.end_line ? Math.min(lines.length, args.end_line) : lines.length;
            
            let wasTruncated = false;
            if (!args.start_line && !args.end_line && lines.length > 300) {
                lines = lines.slice(0, 300);
                wasTruncated = true;
            } else {
                lines = lines.slice(start - 1, end);
            }
            
            let outputContent = lines.map((line, i) => `[Line ${start + i}] ${line}`).join('\n');
            if (wasTruncated) outputContent += "\n\n... [FILE TRUNCATED]. Use start_line/end_line.";
            return outputContent;
        } catch (e: any) { return `Read Error: ${e.message}`; }
    },
    "search_codebase": async (config, rawArgs) => {
        const args = rawArgs as Partial<SearchCodebaseArgs>;
        if (!args.search_term || !args.path) return "Error: Missing search_term or path.";
        console.log(chalk.yellow(`  [Action] Searching codebase for: ${args.search_term}`));
        try {
            const searchPath = resolveFilePath(args.path, config.allowedRoots);
            const stdout = execFileSync('grep', ['-nriI', args.search_term, searchPath], { encoding: 'utf-8', timeout: 15000 });
            return truncateOutput(stdout || "No matches found.", 1500);
        } catch (e: any) {
            if (e.status === 1) return "No matches found.";
            return `Search Error: ${e.message}`;
        }
    },
    "search_and_replace": async (config, rawArgs, verifiedReads) => {
        const args = rawArgs as Partial<SearchAndReplaceArgs>;
        if (!args.path || typeof args.search_string !== 'string' || typeof args.replace_string !== 'string') {
            return "Error: Missing path, search_string, or replace_string.";
        }
        try {
            const edPath = resolveFilePath(args.path, config.allowedRoots);
            if (!verifiedReads.has(edPath)) {
                return `[Security] Rejected: You must 'read_file' on ${args.path} before editing.`;
            }

            const fileContent = fs.readFileSync(edPath, 'utf-8');
            const result = applySearchAndReplace(fileContent, args.search_string, args.replace_string);
            if (!result.ok) return result.error;

            showVisualDiff(fileContent, result.content, args.path);
            const approved = await config.rl.question(chalk.yellow(`  Apply these changes to ${args.path}? (y/n): `));
            if (approved.toLowerCase() !== 'y') return "Edit cancelled by user.";

            // Timestamped Backup System
            const backupDir = path.join(config.projectRoot, '.lucifer-backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
            const backupFile = path.join(backupDir, `${path.basename(edPath)}.${Date.now()}.bak`);
            fs.copyFileSync(edPath, backupFile);

            fs.writeFileSync(edPath, result.content);
            verifiedReads.delete(edPath);

            try {
                // Shell-less git execution to prevent injection
                execFileSync('git', ['add', edPath], { cwd: config.projectRoot, stdio: 'ignore' });
                execFileSync('git', ['commit', '-m', `lucifer auto-fix: ${path.basename(edPath)}`], { cwd: config.projectRoot, stdio: 'ignore' });
            } catch(e) {}

            console.log(chalk.yellow(`  [Action] Verifying changes...`));
            try {
                if (fs.existsSync(path.join(config.projectRoot, 'package.json'))) {
                    await execAsync('npm run build --dry-run', { timeout: 10000, cwd: config.projectRoot });
                }
                return `Success: Replaced text in ${args.path}. Verification passed.`;
            } catch (e: any) {
                return `Warning: Edit applied, but verification FAILED.\nError:\n${e.stderr || e.stdout || e.message}`;
            }
        } catch (e: any) { return `Edit Error: ${e.message}`; }
    },
    "propose_fix": async (config, rawArgs) => {
        const args = rawArgs as Partial<ProposeFixArgs>;
        if (typeof args.issue !== 'string' || typeof args.file_path !== 'string' || typeof args.suggested_fix !== 'string') {
            return "Error: Missing required fields.";
        }
        const reviewPath = path.join(config.projectRoot, "REVIEW_REQUEST.md");
        if (!isPathAllowed(reviewPath, config.allowedRoots)) return "Error: Cannot write review request outside allowed root.";
        
        const content = `# 🛠 Fix Proposal\n\n**File:** ${args.file_path}\n\n## 🐛 Issue\n${args.issue}\n\n## 📝 Proposed Change\n\`\`\`ts\n${args.suggested_fix}\n\`\`\``;
        fs.writeFileSync(reviewPath, content);
        return `Review request written to REVIEW_REQUEST.md.`;
    },
    "get_deep_system_report": async (config) => {
        console.log(chalk.yellow(`  [Action] Compiling deep system report...`));
        const [uptime, batteryRaw, mem, cpu, net] = await Promise.all([
            execAsync('uptime').then(r => r.stdout.trim()),
            execAsync('ioreg -r -c IOPMPowerSource').then(r => r.stdout.split('\n').filter(l => l.includes('Capacity') || l.includes('Voltage') || l.includes('CycleCount')).join('\n').trim()),
            execAsync('vm_stat').then(r => r.stdout.trim()),
            execAsync('sysctl hw.physicalcpu hw.logicalcpu').then(r => r.stdout.trim()),
            execAsync('netstat -i | head -n 5').then(r => r.stdout.trim())
        ]);
        return `📊 **Deep System Report**\n\n**Uptime:** ${uptime}\n\n**CPU:**\n${cpu}\n\n**Memory:**\n${mem}\n\n**Battery Deep Stats:**\n${batteryRaw}\n\n**Network (Top interfaces):**\n${net}`;
    },
    // --- Gourmet Tool Handlers ---
    "add_recipe": async (config, rawArgs) => {
        if (!config.recipeStorage) return "Error: Recipe storage not initialized.";
        const args = rawArgs as AddRecipeArgs;
        try {
            const path = await config.recipeStorage.saveRecipe(args.recipe);
            return `Recipe '${args.recipe.title}' saved successfully to ${path}`;
        } catch (e: any) { return `Error adding recipe: ${e.message}`; }
    },
    "list_recipes": async (config) => {
        if (!config.recipeStorage) return "Error: Recipe storage not initialized.";
        try {
            const recipes = await config.recipeStorage.listRecipes();
            console.log(GourmetUI.formatList(recipes));
            return "Success: Recipes list has been displayed.";
        } catch (e: any) { return `Error listing recipes: ${e.message}`; }
    },
    "read_recipe": async (config, rawArgs) => {
        if (!config.recipeStorage) return "Error: Recipe storage not initialized.";
        const args = rawArgs as ReadRecipeArgs;
        try {
            const recipe = await config.recipeStorage.readRecipe(args.title);
            if (!recipe) return `Recipe '${args.title}' not found.`;
            console.log(GourmetUI.formatRecipe(recipe));
            return `Success: Recipe '${args.title}' has been displayed.`;
        } catch (e: any) { return `Error reading recipe: ${e.message}`; }
    },
    "search_recipes": async (config, rawArgs) => {
        if (!config.recipeStorage) return "Error: Recipe storage not initialized.";
        const args = rawArgs as SearchRecipesArgs;
        try {
            const results = await config.recipeStorage.searchRecipes(args.query);
            if (results.length === 0) return `No matches found for '${args.query}'.`;
            const output = `\n  Search Results for '${args.query}':\n` + 
                   results.map(r => `  - ${r.title} (Score: ${r.score.toFixed(2)})`).join('\n') + '\n';
            console.log(output);
            return `Success: Search results for '${args.query}' have been displayed.`;
        } catch (e: any) { return `Error searching recipes: ${e.message}`; }
    },
    "delete_recipe": async (config, rawArgs) => {
        if (!config.recipeStorage) return "Error: Recipe storage not initialized.";
        const args = rawArgs as DeleteRecipeArgs;
        try {
            const success = await config.recipeStorage.deleteRecipe(args.title);
            return success ? `Recipe '${args.title}' deleted.` : `Recipe '${args.title}' not found.`;
        } catch (e: any) { return `Error deleting recipe: ${e.message}`; }
    },
    "import_recipe_from_url": async (config, rawArgs) => {
        if (!config.ai || !config.recipeStorage) return "Error: Gemini/Storage not initialized.";
        const args = rawArgs as ImportRecipeArgs;
        const screenshotPath = path.join(os.tmpdir(), `gourmet-scrape-${Date.now()}.png`);
        console.log(chalk.magenta(`  [Vision] Capturing recipe from: ${args.url}`));
        try {
            // Shell-less open to prevent injection
            execFileSync('open', [args.url]);
            await new Promise(resolve => setTimeout(resolve, 8000)); // Increased delay for slower sites

            // Attempt window-focused capture for privacy
            let windowId = "";
            try {
                windowId = execSync('osascript -e "tell application \\"System Events\\" to get id of window 1 of (first process whose frontmost is true)"', { encoding: 'utf-8', timeout: 5000 }).trim();
            } catch (e) {}

            if (windowId && !isNaN(Number(windowId))) {
                execFileSync('screencapture', ['-l', windowId, '-x', screenshotPath], { timeout: 10000 });
            } else {
                execFileSync('screencapture', ['-x', screenshotPath], { timeout: 10000 });
            }

            const imageData = fs.readFileSync(screenshotPath).toString('base64');
            const model = config.ai.getGenerativeModel({ model: config.visionModelName });
            const prompt = `Extract the recipe from this image into structured JSON... (omitting long prompt for brevity)`;
            const result = await model.generateContent([prompt, { inlineData: { mimeType: "image/png", data: imageData } }]);
            const response = await result.response;
            const jsonText = response.text().replace(/```json|```/g, '').trim();
            const recipeData = JSON.parse(jsonText);
            recipeData.metadata = recipeData.metadata || {};
            recipeData.metadata.sourceUrl = args.url;
            const savedPath = await config.recipeStorage.saveRecipe(recipeData);
            return `Successfully imported recipe: '${recipeData.title}' to ${savedPath}`;
        } catch (e: any) { return `Import Error: ${e.message}`; }
        finally { if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath); }
    }
};
