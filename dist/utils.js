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
export function isPathAllowed(filePath, allowedRoots) {
    const resolved = path.resolve(filePath);
    return allowedRoots.some(root => {
        const resolvedRoot = path.resolve(root);
        return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
    });
}
export function resolveFilePath(filePath, allowedRoots) {
    const candidates = [
        filePath,
        ...allowedRoots.map(root => path.join(root, filePath))
    ];
    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (deps.fs.existsSync(resolved) && isPathAllowed(resolved, allowedRoots))
            return resolved;
    }
    throw new Error(`File not found or outside allowed directories: ${filePath}`);
}
export function isDangerousCommand(command, dangerPatterns) {
    return dangerPatterns.some(p => {
        const regex = typeof p === 'string' ? new RegExp(p) : p;
        return regex.test(command);
    });
}
export function applySearchAndReplace(fileText, searchString, replaceString) {
    if (!fileText.includes(searchString)) {
        return { ok: false, error: `Error: The exact search string was not found in the file. Make sure you match the indentation and whitespace perfectly.` };
    }
    const newContent = fileText.replace(searchString, replaceString);
    return { ok: true, content: newContent };
}
export function showVisualDiff(oldText, newText, fileName) {
    const changes = diff.diffLines(oldText, newText);
    console.log(chalk.cyan(`\n--- ${fileName} (Changes)`));
    changes.forEach((part) => {
        const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.gray;
        const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
        if (part.added || part.removed) {
            process.stdout.write(color(part.value.split('\n').map(l => l ? prefix + l : l).join('\n')));
        }
        else {
            // Show only first and last line of unchanged blocks if they are long
            const lines = part.value.split('\n').filter(l => l.trim() !== '');
            if (lines.length > 4) {
                process.stdout.write(chalk.gray(`  ${lines[0]}\n`));
                process.stdout.write(chalk.gray(`  ... (${lines.length - 2} lines unchanged) ...\n`));
                process.stdout.write(chalk.gray(`  ${lines[lines.length - 1]}\n`));
            }
            else {
                process.stdout.write(chalk.gray(part.value.split('\n').map(l => l ? prefix + l : l).join('\n')));
            }
        }
    });
    console.log(chalk.cyan('\n--- END DIFF ---\n'));
}
export function highlightMarkdown(text) {
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
export function truncateOutput(text, maxChars = 2000) {
    if (text.length <= maxChars)
        return text;
    const half = Math.floor((maxChars - 50) / 2);
    return `${text.substring(0, half)}\n\n... [TRUNCATED ${text.length - maxChars} CHARACTERS] ...\n\n${text.substring(text.length - half)}`;
}
export class Spinner {
    constructor(message) {
        this.message = message;
        this.timer = null;
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.currentFrame = 0;
    }
    start() {
        process.stdout.write(chalk.gray(`  ${this.frames[0]} ${this.message}`));
        this.timer = setInterval(() => {
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
            process.stdout.write(`\r  ${chalk.cyan(this.frames[this.currentFrame])} ${chalk.gray(this.message)}`);
        }, 80);
    }
    stop(finalMessage, color = 'green') {
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
export function pruneHistory(history, maxLength) {
    if (history.length === 0)
        return [];
    if (history.length <= maxLength)
        return history;
    const systemPrompt = history[0];
    let pruned = history.slice(-(maxLength - 1));
    // Ensure we don't start with an orphaned tool response
    while (pruned.length > 0 && pruned[0].role === 'tool') {
        pruned.shift();
    }
    return [systemPrompt, ...pruned];
}
export function getLogsToDelete(logs, maxLogs) {
    if (logs.length <= maxLogs)
        return [];
    return logs.slice(0, logs.length - maxLogs);
}
//# sourceMappingURL=utils.js.map