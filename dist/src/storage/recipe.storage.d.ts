import type { Recipe } from '../schema/recipe.schema.js';
export declare class RecipeStorage {
    private recipesDir;
    private indexFile;
    private vectorsFile;
    private git;
    private miniSearch;
    private vectorStore;
    private extractor;
    private isSemanticReady;
    constructor(baseDir: string);
    static create(baseDir: string): Promise<RecipeStorage>;
    private initSemantic;
    private getEmbedding;
    private cosineSimilarity;
    private loadVectors;
    private saveVectors;
    private initGit;
    private loadIndex;
    buildIndex(): Promise<void>;
    private saveIndex;
    searchRecipes(query: string): Promise<{
        title: any;
        score: number;
    }[]>;
    private getFilePath;
    saveRecipe(recipe: Recipe): Promise<string>;
    listRecipes(): Promise<string[]>;
    readRecipe(title: string): Promise<Recipe | null>;
    deleteRecipe(title: string): Promise<boolean>;
    private serializeRecipe;
    private deserializeRecipe;
}
//# sourceMappingURL=recipe.storage.d.ts.map