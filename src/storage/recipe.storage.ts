import fs from 'node:fs';
import path from 'node:path';
import { RecipeSchema } from '../schema/recipe.schema.js';
import type { Recipe } from '../schema/recipe.schema.js';
import { simpleGit } from 'simple-git';
import type { SimpleGit } from 'simple-git';
import chalk from 'chalk';
import MiniSearch from 'minisearch';
import { pipeline } from '@xenova/transformers';

export class RecipeStorage {
  private recipesDir: string;
  private indexFile: string;
  private vectorsFile: string;
  private git: SimpleGit;
  private miniSearch: MiniSearch;
  
  // Semantic RAG State
  private vectorStore: Record<string, number[]> = {};
  private extractor: any = null;
  private isSemanticReady: boolean = false;

  constructor(baseDir: string) {
    this.recipesDir = path.join(baseDir, 'recipes');
    this.indexFile = path.join(baseDir, '.gourmet-index.json');
    this.vectorsFile = path.join(baseDir, '.gourmet-vectors.json');
    
    if (!fs.existsSync(this.recipesDir)) {
      fs.mkdirSync(this.recipesDir, { recursive: true });
    }
    
    this.git = simpleGit(baseDir);
    this.miniSearch = new MiniSearch({
      fields: ['title', 'ingredients', 'instructions', 'tags'],
      storeFields: ['title']
    });
  }

  static async create(baseDir: string): Promise<RecipeStorage> {
    const storage = new RecipeStorage(baseDir);
    await storage.initGit();
    await storage.loadIndex();
    storage.loadVectors();
    await storage.initSemantic();
    return storage;
  }

  private async initSemantic() {
    try {
      console.log(chalk.gray(`  [RAG] Initializing local semantic embeddings...`));
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.isSemanticReady = true;
      console.log(chalk.green(`  [RAG] Semantic Engine Ready.`));
    } catch (e) {
      console.warn(chalk.yellow(`  [RAG] Warning: Failed to load neural engine. Falling back to Lexical Search (MiniSearch).`));
      this.isSemanticReady = false;
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.isSemanticReady || !this.extractor) return [];
    try {
      const output = await this.extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (e) {
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const valA = a[i] ?? 0;
      const valB = b[i] ?? 0;
      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private loadVectors() {
    if (fs.existsSync(this.vectorsFile)) {
      try {
        this.vectorStore = JSON.parse(fs.readFileSync(this.vectorsFile, 'utf-8'));
      } catch (e) {
        this.vectorStore = {};
      }
    }
  }

  private saveVectors() {
    fs.writeFileSync(this.vectorsFile, JSON.stringify(this.vectorStore));
  }

  private async initGit() {
    try {
      if (!fs.existsSync(path.join(this.recipesDir, '../.git'))) {
        await this.git.init();
        await this.git.addConfig('user.name', 'Lucifer-Gourmet');
        await this.git.addConfig('user.email', 'lucifer@m5.local');
      }
    } catch (e) {
      console.error(chalk.red('Failed to initialize Git storage:'), e);
    }
  }

  private loadIndex() {
    if (fs.existsSync(this.indexFile)) {
      try {
        const indexData = fs.readFileSync(this.indexFile, 'utf-8');
        this.miniSearch = MiniSearch.loadJSON(indexData, {
          fields: ['title', 'ingredients', 'instructions', 'tags'],
          storeFields: ['title']
        });
      } catch (e) {
        this.buildIndex();
      }
    } else {
      this.buildIndex();
    }
  }

  async buildIndex() {
    this.miniSearch.removeAll();
    const files = fs.readdirSync(this.recipesDir).filter(f => f.endsWith('.md'));
    const docs = [];
    for (const file of files) {
      const recipe = await this.readRecipe(file.replace('.md', ''));
      if (recipe) {
        const textContent = `${recipe.title} ${recipe.ingredients.map(i => i.item).join(' ')} ${recipe.tags.join(' ')}`;
        
        docs.push({
          id: recipe.title,
          title: recipe.title,
          ingredients: recipe.ingredients.map(i => i.item).join(' '),
          instructions: recipe.instructions.join(' '),
          tags: recipe.tags.join(' ')
        });

        if (this.isSemanticReady) {
          const vector = await this.getEmbedding(textContent);
          if (vector.length > 0) this.vectorStore[recipe.title] = vector;
        }
      }
    }
    this.miniSearch.addAll(docs);
    this.saveIndex();
    this.saveVectors();
  }

  private saveIndex() {
    fs.writeFileSync(this.indexFile, JSON.stringify(this.miniSearch.toJSON()));
  }

  async searchRecipes(query: string) {
    if (this.isSemanticReady) {
      const queryVector = await this.getEmbedding(query);
      if (queryVector.length > 0) {
        const results = [];
        for (const [title, vector] of Object.entries(this.vectorStore)) {
          const score = this.cosineSimilarity(queryVector, vector);
          if (score > 0.2) {
            results.push({ title, score });
          }
        }
        if (results.length > 0) {
          return results.sort((a, b) => b.score - a.score).slice(0, 5);
        }
      }
    }

    return this.miniSearch.search(query, { prefix: true, fuzzy: 0.2 }).map(res => ({
      title: res.title,
      score: res.score
    }));
  }

  private getFilePath(title: string): string {
    const fileName = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
    return path.join(this.recipesDir, fileName);
  }

  async saveRecipe(recipe: Recipe): Promise<string> {
    const validated = RecipeSchema.parse(recipe);
    const filePath = this.getFilePath(validated.title);
    
    const content = this.serializeRecipe(validated);
    fs.writeFileSync(filePath, content);

    try { this.miniSearch.discard(validated.title); } catch {}
    this.miniSearch.add({
      id: validated.title,
      title: validated.title,
      ingredients: validated.ingredients.map(i => i.item).join(' '),
      instructions: validated.instructions.join(' '),
      tags: validated.tags.join(' ')
    });
    this.saveIndex();

    if (this.isSemanticReady) {
      const textContent = `${validated.title} ${validated.ingredients.map(i => i.item).join(' ')} ${validated.tags.join(' ')}`;
      const vector = await this.getEmbedding(textContent);
      if (vector.length > 0) {
        this.vectorStore[validated.title] = vector;
        this.saveVectors();
      }
    }

    try {
      await this.git.add(filePath);
      await this.git.commit(`Add/Update recipe: ${validated.title}`);
    } catch (e) {}

    return filePath;
  }

  async listRecipes(): Promise<string[]> {
    if (!fs.existsSync(this.recipesDir)) return [];
    return fs.readdirSync(this.recipesDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
  }

  async readRecipe(title: string): Promise<Recipe | null> {
    const filePath = this.getFilePath(title);
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.deserializeRecipe(content);
  }

  async deleteRecipe(title: string): Promise<boolean> {
    const filePath = this.getFilePath(title);
    if (!fs.existsSync(filePath)) return false;

    fs.unlinkSync(filePath);
    this.miniSearch.discard(title);
    this.saveIndex();
    delete this.vectorStore[title];
    this.saveVectors();

    try {
      await this.git.add(filePath);
      await this.git.commit(`Delete recipe: ${title}`);
    } catch (e) {}

    return true;
  }

  private serializeRecipe(recipe: Recipe): string {
    let md = `# ${recipe.title}\n\n`;
    if (recipe.description) md += `${recipe.description}\n\n`;
    md += `## Tags\n${recipe.tags.join(', ')}\n\n`;
    md += `## Ingredients\n`;
    recipe.ingredients.forEach(i => {
      md += `- ${i.amount || ''} ${i.unit || ''} ${i.item}${i.notes ? ` (${i.notes})` : ''}\n`;
    });
    md += `\n## Instructions\n`;
    recipe.instructions.forEach((step, idx) => {
      md += `${idx + 1}. ${step}\n`;
    });
    if (recipe.metadata) {
      md += `\n## Metadata\n`;
      if (recipe.metadata.prepTime) md += `- Prep Time: ${recipe.metadata.prepTime}\n`;
      if (recipe.metadata.cookTime) md += `- Cook Time: ${recipe.metadata.cookTime}\n`;
      if (recipe.metadata.servings) md += `- Servings: ${recipe.metadata.servings}\n`;
      if (recipe.metadata.sourceUrl) md += `- Source: ${recipe.metadata.sourceUrl}\n`;
    }
    return md;
  }

  private deserializeRecipe(content: string): Recipe {
    const lines = content.split('\n');
    const recipe: any = {
      title: lines[0]?.replace('# ', '').trim() || 'Untitled',
      tags: [],
      ingredients: [],
      instructions: [],
      metadata: {}
    };

    let currentSection = '';
    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      if (rawLine === undefined) continue;
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '').toLowerCase();
        continue;
      }

      if (currentSection === 'tags') {
        recipe.tags = line.split(',').map(t => t.trim()).filter(Boolean);
      } else if (currentSection === 'ingredients' && line.startsWith('- ')) {
        const ingredientContent = line.replace('- ', '').trim();
        const notesMatch = ingredientContent.match(/\((.*)\)/);
        const notes = notesMatch ? notesMatch[1] : undefined;
        const mainPart = ingredientContent.replace(/\(.*\)/, '').trim();
        
        const parts = mainPart.split(/\s+/);
        const firstPart = parts[0];
        if (firstPart && parts.length >= 3 && /^[\d\/\.]+$/.test(firstPart)) {
          recipe.ingredients.push({ amount: firstPart, unit: parts[1], item: parts.slice(2).join(' '), notes });
        } else if (firstPart && parts.length >= 2 && /^[\d\/\.]+$/.test(firstPart)) {
          recipe.ingredients.push({ amount: firstPart, item: parts.slice(1).join(' '), notes });
        } else {
          recipe.ingredients.push({ item: mainPart, notes });
        }
      } else if (currentSection === 'instructions' && /^\d+\./.test(line)) {
        recipe.instructions.push(line.replace(/^\d+\.\s+/, ''));
      } else if (currentSection === 'metadata' && line.startsWith('- ')) {
        const [key, ...valParts] = line.replace('- ', '').split(':');
        if (key) {
          const value = valParts.join(':').trim();
          const k = key.trim().toLowerCase();
          if (k.includes('prep')) recipe.metadata.prepTime = value;
          if (k.includes('cook')) recipe.metadata.cookTime = value;
          if (k.includes('servings')) recipe.metadata.servings = parseInt(value);
          if (k.includes('source')) recipe.metadata.sourceUrl = value;
        }
      } else if (!currentSection && i < 10 && !line.startsWith('#')) {
        recipe.description = (recipe.description || '') + line + ' ';
      }
    }
    if (recipe.description) recipe.description = recipe.description.trim();
    return recipe as Recipe;
  }
}
