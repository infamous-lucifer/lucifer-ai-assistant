import path from 'node:path';
import fs from 'node:fs';

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

export function applyReplaceInFile(fileText: string, oldString: string, newString: string): { ok: true, content: string } | { ok: false, error: string } {
    const occurrences = fileText.split(oldString).length - 1;
    if (occurrences === 0) return { ok: false, error: "Error: Text not found." };
    if (occurrences > 1) return { ok: false, error: `Error: '${oldString}' found ${occurrences} times. Provide a more specific string to ensure a surgical edit.` };
    
    return { ok: true, content: fileText.replace(oldString, newString) };
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
