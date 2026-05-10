import path from 'node:path';
import fs from 'node:fs';

export const deps = {
    fs: {
        existsSync: fs.existsSync,
        readFileSync: fs.readFileSync,
    }
};

export const DANGER_PATTERNS = [
    /rm\s+-rf?\s+[~\/]/,
    /curl[^|]*\|.*sh/,
    /wget[^|]*\|.*sh/,
    /dd\s+if=\/dev\//,
    /mkfs/,
    /:.*\{.*:.*\|.*:.*&.*\}/,
    />\s*\/dev\/(disk|sda|nvme)/,
    /chmod\s+-R\s+[67]77\s+\//,
];

export function isPathAllowed(filePath: string, allowedRoots: string[]): boolean {
    const resolved = path.resolve(filePath);
    return allowedRoots.some(root => {
        const resolvedRoot = path.resolve(root);
        return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
    });
}

export function resolveFilePath(filePath: string, projectRoot: string, runtimesPath: string): string {
    const candidates = [
        filePath,
        path.join(projectRoot, filePath),
        path.join(runtimesPath, filePath),
    ];
    
    const allowedRoots = [projectRoot, runtimesPath];
    
    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (deps.fs.existsSync(resolved) && isPathAllowed(resolved, allowedRoots)) return resolved;
    }
    throw new Error(`File not found or outside allowed directories: ${filePath}`);
}

export function isDangerousCommand(command: string): boolean {
    return DANGER_PATTERNS.some(p => p.test(command));
}

export function applyReplaceInFile(fileText: string, oldString: string, newString: string): { ok: true, content: string } | { ok: false, error: string } {
    const occurrences = fileText.split(oldString).length - 1;
    if (occurrences === 0) return { ok: false, error: "Error: Text not found." };
    if (occurrences > 1) return { ok: false, error: `Error: '${oldString}' found ${occurrences} times. Provide a more specific string to ensure a surgical edit.` };
    
    return { ok: true, content: fileText.replace(oldString, newString) };
}

export function pruneHistory(history: any[], maxLength: number): any[] {
    if (history.length <= maxLength) return history;
    if (history.length === 0) return [];
    return [history[0], ...history.slice(-(maxLength - 1))];
}

export function getLogsToDelete(logs: string[], maxLogs: number): string[] {
    if (logs.length <= maxLogs) return [];
    return logs.slice(0, logs.length - maxLogs);
}
