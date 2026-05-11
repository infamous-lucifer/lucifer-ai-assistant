import path from 'node:path';
import fs from 'node:fs';
import * as diff from 'diff';
import chalk from 'chalk';

export const deps = {
    fs: {
        existsSync: fs.existsSync,
        readFileSync: fs.readFileSync,
    }
};

export function isPathAllowed(filePath: string, allowedRoots: string[]): boolean {
    const resolved = path.resolve(filePath);
    return allowedRoots.some(root => {
        const resolvedRoot = path.resolve(root);
        return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
    });
}

export function resolveFilePath(filePath: string, allowedRoots: string[]): string {
    const candidates = [
        filePath,
        ...allowedRoots.map(root => path.join(root, filePath))
    ];
    
    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (deps.fs.existsSync(resolved) && isPathAllowed(resolved, allowedRoots)) return resolved;
    }
    throw new Error(`File not found or outside allowed directories: ${filePath}`);
}

export function isDangerousCommand(command: string, dangerPatterns: (string | RegExp)[]): boolean {
    return dangerPatterns.some(p => {
        const regex = typeof p === 'string' ? new RegExp(p) : p;
        return regex.test(command);
    });
}

export function isSafeAutoApproveCommand(command: string): boolean {
    const hasDangerousChars = /[&|;><$`\n]/.test(command);
    const safeCommandRegex = /^(ls|cat\s+[^&|;><$`\n]+|pwd|git status|git diff|git log|uptime|vm_stat|sysctl|netstat|ioreg)$/;
    return !hasDangerousChars && safeCommandRegex.test(command.trim());
}

export function safeParseArguments(rawArgs: string): any {
    try {
        return JSON.parse(rawArgs);
    } catch {
        // Fault-tolerant parsing for local AI hallucinations
        let cleaned = rawArgs.replace(/```json/g, '').replace(/```/g, '').trim();
        // Repair common JSON errors like trailing commas
        cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
        try {
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }
}

export function applySearchAndReplace(fileText: string, searchString: string, replaceString: string): { ok: true, content: string } | { ok: false, error: string } {
    const occurrences = fileText.split(searchString).length - 1;
    if (occurrences === 0) {
        return { ok: false, error: `Error: The exact search string was not found in the file. Make sure you match the indentation and whitespace perfectly.` };
    }
    if (occurrences > 1) {
        return { ok: false, error: `Error: Search string is NOT unique. Found ${occurrences} occurrences. Please provide more surrounding context to make the search string unique.` };
    }
    const newContent = fileText.replace(searchString, replaceString);
    return { ok: true, content: newContent };
}

export function showVisualDiff(oldText: string, newText: string, fileName: string) {
    const changes = diff.diffLines(oldText, newText);
    console.log(chalk.cyan(`\n--- ${fileName} (Changes)`));
    changes.forEach((part) => {
        const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.gray;
        const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
        if (part.added || part.removed) {
            process.stdout.write(color(part.value.split('\n').map(l => l ? prefix + l : l).join('\n')));
        } else {
            // Show only first and last line of unchanged blocks if they are long
            const lines = part.value.split('\n').filter(l => l.trim() !== '');
            if (lines.length > 4) {
                process.stdout.write(chalk.gray(`  ${lines[0]}\n`));
                process.stdout.write(chalk.gray(`  ... (${lines.length - 2} lines unchanged) ...\n`));
                process.stdout.write(chalk.gray(`  ${lines[lines.length - 1]}\n`));
            } else {
                process.stdout.write(chalk.gray(part.value.split('\n').map(l => l ? prefix + l : l).join('\n')));
            }
        }
    });
    console.log(chalk.cyan('\n--- END DIFF ---\n'));
}

export function highlightMarkdown(text: string): string {
    // Highlight code blocks
    let highlighted = text.replace(/```([\s\S]*?)```/g, (match, code) => {
        return chalk.bgBlack.gray(match);
    });
    // Highlight inline code
    highlighted = highlighted.replace(/`([^`]+)`/g, (match, code) => {
        return chalk.yellow(match);
    });
    // Highlight bold text
    highlighted = highlighted.replace(/\*\*([^*]+)\*\*/g, (match, content) => {
        return chalk.bold.cyan(content);
    });
    return highlighted;
}

export function truncateOutput(text: string, maxChars: number = 2000): string {
    if (text.length <= maxChars) return text;
    const half = Math.floor((maxChars - 50) / 2);
    return `${text.substring(0, half)}\n\n... [TRUNCATED ${text.length - maxChars} CHARACTERS] ...\n\n${text.substring(text.length - half)}`;
}

export class Spinner {
    private timer: NodeJS.Timeout | null = null;
    private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private currentFrame = 0;

    constructor(private message: string) {}

    start() {
        process.stdout.write(chalk.gray(`  ${this.frames[0]} ${this.message}`));
        this.timer = setInterval(() => {
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
            process.stdout.write(`\r  ${chalk.cyan(this.frames[this.currentFrame])} ${chalk.gray(this.message)}`);
        }, 80);
    }

    stop(finalMessage?: string, color: typeof chalk.Color = 'green') {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
        if (finalMessage) {
            console.log(`  ${chalk[color]('✔')} ${chalk.gray(finalMessage)}`);
        }
    }
}

export function pruneHistory(history: any[], maxLength: number): any[] {
    if (history.length === 0) return [];
    if (history.length <= maxLength) return history;
    
    const systemPrompt = history[0];
    let pruned = history.slice(-(maxLength - 1));

    // Ensure we don't start with an orphaned tool response
    while (pruned.length > 0 && pruned[0].role === 'tool') {
        pruned.shift();
    }

    return [systemPrompt, ...pruned];
}

export function getLogsToDelete(logs: string[], maxLogs: number): string[] {
    if (logs.length <= maxLogs) return [];
    return logs.slice(0, logs.length - maxLogs);
}
