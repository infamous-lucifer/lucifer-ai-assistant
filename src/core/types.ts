import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import * as readline from 'node:readline/promises';
import { RecipeStorage } from '../storage/recipe.storage.js';

export interface RunCommandArgs { command: string; }
export interface ReadFileArgs { path: string; start_line?: number; end_line?: number; }
export interface SearchAndReplaceArgs { path: string; search_string: string; replace_string: string; }
export interface ProposeFixArgs { issue: string; file_path: string; suggested_fix: string; }
export interface SearchWebArgs { query: string; }
export interface SemanticSearchArgs { query: string; }
export interface ListFilesArgs { path?: string; }
export interface GetCommandHelpArgs { command: string; }
export interface ControlMacosArgs { action: "get_active_window" | "toggle_dark_mode" | "get_volume" | "set_volume_50" | "list_running_apps" | "empty_trash"; }
export interface SearchCodebaseArgs { search_term: string; path: string; }

// --- Gourmet Tool Args ---
export interface AddRecipeArgs { recipe: any; }
export interface SearchRecipesArgs { query: string; }
export interface ReadRecipeArgs { title: string; }
export interface DeleteRecipeArgs { title: string; }
export interface ImportRecipeArgs { url: string; }

export interface AssistantConfig {
    ai: GoogleGenAI | undefined;
    localAI: OpenAI | undefined;
    rl: readline.Interface;
    projectRoot: string;
    runtimesPath: string;
    logsDir: string;
    indexFile: string;
    backupFile: string;
    allowedRoots: string[];
    dangerPatterns: (string | RegExp)[];
    recipeStorage?: RecipeStorage;
}
