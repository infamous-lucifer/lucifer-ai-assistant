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

export function applyEditFileRange(fileText: string, startLine: number, endLine: number, newCode: string): { ok: true, content: string } | { ok: false, error: string } {
    let lines = fileText.split('\n');
    
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
        return { ok: false, error: `Error: Invalid line range (${startLine}-${endLine}). File has ${lines.length} lines.` };
    }

    // Splice array: remove (end - start + 1) lines at index (start - 1), insert new code
    lines.splice(startLine - 1, endLine - startLine + 1, newCode);
    
    return { ok: true, content: lines.join('\n') };
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

export function pruneHistory(history: any[], maxLength: number): any[] {
    if (history.length <= maxLength || history.length === 0) return history;
    
    const systemPrompt = history[0];
    let pruned = history.slice(-(maxLength - 1));

    // Ensure we don't start with an orphaned tool response
    // If the first message in our new slice is a 'tool' role, it means its 
    // preceding 'assistant' (the one that made the call) was pruned.
    while (pruned.length > 0 && pruned[0].role === 'tool') {
        pruned.shift();
    }

    return [systemPrompt, ...pruned];
}

export function getLogsToDelete(logs: string[], maxLogs: number): string[] {
    if (logs.length <= maxLogs) return [];
    return logs.slice(0, logs.length - maxLogs);
}
