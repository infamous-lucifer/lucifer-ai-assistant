import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import chalk from 'chalk';
import { execSync, execFileSync } from 'node:child_process';
import MiniSearch from 'minisearch';
import type { AssistantConfig } from './core/types.js';
import https from 'node:https';

export async function syncDependencies(config: AssistantConfig, manifest: any) {
    const deps = manifest.dependencies || [];
    for (const dep of deps) {
        const binaryPath = path.join(config.runtimesPath, dep.binary);
        if (!fs.existsSync(binaryPath)) {
            process.stdout.write(chalk.yellow(`  [Sync] Installing tool: ${dep.name}...`));
            const tmpPath = `${binaryPath}.tmp`;
            try {
                if (!fs.existsSync(path.dirname(binaryPath))) fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
                
                // Use native Node.js for downloading instead of shell curl
                await new Promise((resolve, reject) => {
                    const file = fs.createWriteStream(tmpPath);
                    https.get(dep.source, (response) => {
                        if (response.statusCode !== 200) {
                            reject(new Error(`Failed to download: ${response.statusCode}`));
                            return;
                        }
                        response.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            resolve(true);
                        });
                    }).on('error', (err) => {
                        fs.unlink(tmpPath, () => {});
                        reject(err);
                    });
                });

                fs.chmodSync(tmpPath, 0o755);
                
                if (dep.sha256) {
                    const content = fs.readFileSync(tmpPath);
                    const hash = crypto.createHash('sha256').update(content).digest('hex');
                    if (hash !== dep.sha256) {
                        fs.unlinkSync(tmpPath);
                        throw new Error(`Hash mismatch! Expected ${dep.sha256}, got ${hash}`);
                    }
                }
                fs.renameSync(tmpPath, binaryPath);
                console.log(chalk.green(" Done."));
            } catch (e: any) { 
                if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                console.log(chalk.red(`\n✘ Failed to install ${dep.name}: ${e.message}`)); 
            }
        }
    }
}

export async function buildIndex(config: AssistantConfig) {
    console.log(chalk.magenta("  [Index] Building local codebase index..."));
    const miniSearch = new MiniSearch({
        fields: ['path', 'content'], 
        storeFields: ['path']
    });

    // Use execFileSync to prevent shell injection via PROJECT_ROOT
    const args = [config.projectRoot, '-maxdepth', '3', '-not', '-path', '*/.*', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/dist/*', '-type', 'f'];
    const files = execFileSync('find', args, { encoding: 'utf-8', timeout: 30000 }).split('\n').filter(Boolean);
    
    const documents = files.map((f, i) => {
        try {
            const stats = fs.statSync(f);
            if (stats.size > 100 * 1024) return null;
            if (/\.(png|jpg|jpeg|gif|pdf|zip|tar|gz|exe|dll|so|o|db|sqlite|bin)$/i.test(f)) return null;

            return { id: i, path: path.relative(config.projectRoot, f), content: fs.readFileSync(f, 'utf-8') };
        } catch (e) { return null; }
    }).filter(Boolean);

    miniSearch.addAll(documents as any);
    fs.writeFileSync(config.indexFile, JSON.stringify(miniSearch.toJSON()));
    console.log(chalk.green(`  [Index] Success. Indexed ${documents.length} files.`));
}

export async function runStatusCheck(config: AssistantConfig, configFile: string) {
    console.log(chalk.cyan('\n=== LUCIFER STATUS ===\n'));
    const keyExists = fs.existsSync(configFile) && fs.readFileSync(configFile, 'utf-8').includes('API_KEY=');
    if (keyExists) {
        console.log(chalk.green('✔ API Key found 🔑'));
    } else {
        console.log(chalk.red('✘ API Key missing'));
    }

    try {
        const lmsPath = path.join(process.env.HOME || '', '.lmstudio/bin/lms');
        const status = execSync(`${lmsPath} status`, { encoding: 'utf-8', timeout: 5000 });
        if (!status.includes('Server: OFF')) {
            console.log(chalk.green('✔ LM Studio server running'));
        } else {
            console.log(chalk.yellow('⚠ LM Studio server OFF'));
        }
    } catch {
        console.log(chalk.red('✘ LM Studio not found'));
    }

    console.log(fs.existsSync(config.backupFile) ? chalk.green('✔ Rollback backup available') : chalk.gray('– No backup yet'));
    console.log(fs.existsSync(config.runtimesPath) ? chalk.green(`✔ Runtimes folder found`) : chalk.yellow(`⚠ Runtimes folder missing`));
    console.log('');
}

export function installDaemon(config: AssistantConfig) {
    const plistPath = path.join(os.homedir(), 'Library/LaunchAgents/com.lucifer.assistant.plist');
    const luciferBin = execSync('which lucifer', { encoding: 'utf-8' }).trim();
    
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lucifer.assistant</string>
    <key>ProgramArguments</key>
    <array>
        <string>${luciferBin}</string>
        <string>--status</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>${path.join(config.logsDir, 'daemon.err.log')}</string>
    <key>StandardOutPath</key>
    <string>${path.join(config.logsDir, 'daemon.out.log')}</string>
</dict>
</plist>`;

    try {
        if (!fs.existsSync(path.dirname(plistPath))) fs.mkdirSync(path.dirname(plistPath), { recursive: true });
        fs.writeFileSync(plistPath, plistContent);
        execSync(`launchctl load ${plistPath}`);
        console.log(chalk.green(`✔ Daemon installed and loaded: ${plistPath}`));
    } catch (e: any) {
        console.log(chalk.red(`✘ Failed to install daemon: ${e.message}`));
    }
}
