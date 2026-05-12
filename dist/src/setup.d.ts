import type { AssistantConfig } from './core/types.js';
export declare function syncDependencies(config: AssistantConfig, manifest: any): Promise<void>;
export declare function buildIndex(config: AssistantConfig): Promise<void>;
export declare function runStatusCheck(config: AssistantConfig, configFile: string): Promise<void>;
export declare function installDaemon(config: AssistantConfig): void;
//# sourceMappingURL=setup.d.ts.map