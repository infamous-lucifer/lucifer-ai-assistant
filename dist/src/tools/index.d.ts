import type { AssistantConfig } from '../core/types.js';
export type ToolHandler = (config: AssistantConfig, args: any, verifiedReads: Set<string>) => Promise<string>;
export declare const toolHandlers: Record<string, ToolHandler>;
//# sourceMappingURL=index.d.ts.map