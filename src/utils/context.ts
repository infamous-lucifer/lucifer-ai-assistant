import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export const deps = {
    fs: {
        existsSync: fs.existsSync,
        readFileSync: fs.readFileSync,
        readdirSync: fs.readdirSync,
    },
    execSync: execSync
};

export interface ProjectContext {
    name?: string;
    description?: string;
    gitRemote?: string;
    primaryLanguages: string[];
    type: 'code' | 'docs' | 'mixed' | 'unknown';
}

export async function getProjectContext(projectRoot: string): Promise<string> {
    const context: ProjectContext = {
        primaryLanguages: [],
        type: 'unknown'
    };

    // 1. Sniffer: package.json / lucifer-manifest.json
    try {
        const pkgPath = path.join(projectRoot, 'package.json');
        const manifestPath = path.join(projectRoot, 'lucifer-manifest.json');

        if (deps.fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(deps.fs.readFileSync(pkgPath, 'utf-8'));
            context.name = pkg.name;
            context.description = pkg.description;
        } else if (deps.fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(deps.fs.readFileSync(manifestPath, 'utf-8'));
            context.name = manifest.name;
            context.description = manifest.description;
        }
    } catch (e) {
        // Ignore parsing errors
    }

    // 2. Git Hook
    try {
        const remote = deps.execSync('git config --get remote.origin.url', { cwd: projectRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (remote) context.gitRemote = remote;
    } catch (e) {
        // Not a git repo or no remote
    }

    // 3. Extension Heuristic
    try {
        const files = deps.fs.readdirSync(projectRoot).slice(0, 50);
        const extensions: Record<string, number> = {};
        let codeCount = 0;
        let docCount = 0;

        const codeExts = new Set(['.ts', '.js', '.py', '.go', '.rs', '.cpp', '.c', '.java', '.rb', '.php', '.swift']);
        const docExts = new Set(['.md', '.txt', '.pdf', '.docx', '.odt', '.rtf']);

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (!ext) continue;
            extensions[ext] = (extensions[ext] || 0) + 1;
            if (codeExts.has(ext)) codeCount++;
            if (docExts.has(ext)) docCount++;
        }

        const totalHandled = codeCount + docCount;
        if (totalHandled > 0) {
            if (codeCount / totalHandled > 0.6) context.type = 'code';
            else if (docCount / totalHandled > 0.6) context.type = 'docs';
            else context.type = 'mixed';
        }

        context.primaryLanguages = Object.entries(extensions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([ext]) => ext);

    } catch (e) {
        // Ignore readdir errors
    }

    // Format the context string
    let info = `[SYSTEM AWARENESS]
Context: ${context.type === 'code' ? 'Software codebase' : context.type === 'docs' ? 'Document/Writing directory' : 'General directory'}.
`;
    if (context.name) info += `Project Name: ${context.name}\n`;
    if (context.description) info += `Description: ${context.description}\n`;
    if (context.gitRemote) info += `Git Remote: ${context.gitRemote}\n`;
    if (context.primaryLanguages.length > 0) info += `Primary Extensions: ${context.primaryLanguages.join(', ')}\n`;

    return info;
}
