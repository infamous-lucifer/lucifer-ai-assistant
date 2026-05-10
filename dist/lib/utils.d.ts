import fs from 'node:fs';
export declare const deps: {
    fs: {
        existsSync: typeof fs.existsSync;
        readFileSync: typeof fs.readFileSync;
    };
};
export declare function isPathAllowed(filePath: string, allowedRoots: string[]): boolean;
export declare function resolveFilePath(filePath: string, allowedRoots: string[]): string;
export declare function isDangerousCommand(command: string, dangerPatterns: (string | RegExp)[]): boolean;
export declare function applyReplaceInFile(fileText: string, oldString: string, newString: string): {
    ok: true;
    content: string;
} | {
    ok: false;
    error: string;
};
export declare function pruneHistory(history: any[], maxLength: number): any[];
export declare function getLogsToDelete(logs: string[], maxLogs: number): string[];
//# sourceMappingURL=utils.d.ts.map