import type { AssistantConfig } from './types.js';
export declare class Assistant {
    private config;
    private manifest;
    private history;
    private toolsUsed;
    private verifiedReads;
    constructor(config: AssistantConfig, manifest: any);
    executeTool(name: string, rawArgs: unknown): Promise<string>;
    chat(query: string, logFile?: string): Promise<string>;
    getToolsUsed(): string[];
    addSystemContext(content: string): void;
}
//# sourceMappingURL=assistant.d.ts.map