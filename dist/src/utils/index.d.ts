import fs from 'node:fs';
import chalk from 'chalk';
export declare const deps: {
    fs: {
        existsSync: typeof fs.existsSync;
        readFileSync: typeof fs.readFileSync;
    };
};
export declare function isPathAllowed(filePath: string, allowedRoots: string[]): boolean;
export declare function resolveFilePath(filePath: string, allowedRoots: string[]): string;
export declare function isDangerousCommand(command: string, dangerPatterns: (string | RegExp)[]): boolean;
export declare function isSafeAutoApproveCommand(command: string): boolean;
export declare function safeParseArguments(rawArgs: string): any;
export declare function applySearchAndReplace(fileText: string, searchString: string, replaceString: string): {
    ok: true;
    content: string;
} | {
    ok: false;
    error: string;
};
export declare function showVisualDiff(oldText: string, newText: string, fileName: string): void;
export declare function highlightMarkdown(text: string): string;
export declare function truncateOutput(text: string, maxChars?: number): string;
export declare class Spinner {
    private message;
    private timer;
    private frames;
    private currentFrame;
    constructor(message: string);
    start(): void;
    stop(finalMessage?: string, color?: typeof chalk.Color): void;
}
export declare function pruneHistory(history: any[], maxLength: number): any[];
export declare function getLogsToDelete(logs: string[], maxLogs: number): string[];
//# sourceMappingURL=index.d.ts.map