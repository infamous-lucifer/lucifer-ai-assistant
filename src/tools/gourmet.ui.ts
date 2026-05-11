import chalk from 'chalk';
import Table from 'cli-table3';
import type { Recipe } from '../schema/recipe.schema.js';

export class GourmetUI {
  static formatRecipe(recipe: Recipe): string {
    let output = '\n';
    output += chalk.bgMagenta.white.bold(`  ${recipe.title.toUpperCase()}  `) + '\n';
    if (recipe.description) output += chalk.italic.gray(`  ${recipe.description}`) + '\n';
    output += '\n';

    if (recipe.metadata) {
      const meta = [];
      if (recipe.metadata.prepTime) meta.push(`${chalk.cyan('Prep:')} ${recipe.metadata.prepTime}`);
      if (recipe.metadata.cookTime) meta.push(`${chalk.cyan('Cook:')} ${recipe.metadata.cookTime}`);
      if (recipe.metadata.servings) meta.push(`${chalk.cyan('Serves:')} ${recipe.metadata.servings}`);
      if (meta.length > 0) output += `  ${meta.join(' | ')}\n\n`;
    }

    const table = new Table({
      head: [chalk.magenta('Qty'), chalk.magenta('Unit'), chalk.magenta('Ingredient'), chalk.magenta('Notes')],
      colWidths: [8, 10, 30, 25],
      wordWrap: true,
      style: { head: [], border: ['gray'] }
    }) as any;

    recipe.ingredients.forEach(ing => {
      table.push([ing.amount || '-', ing.unit || '-', chalk.bold(ing.item), ing.notes || '-']);
    });

    output += chalk.bold('  INGREDIENTS') + '\n';
    output += table.toString() + '\n\n';

    output += chalk.bold('  INSTRUCTIONS') + '\n';
    recipe.instructions.forEach((step, idx) => {
      output += `  ${chalk.magenta(idx + 1)}. ${step}\n`;
    });

    if (recipe.tags && recipe.tags.length > 0) {
      output += '\n  ' + chalk.gray(`Tags: ${recipe.tags.join(', ')}`) + '\n';
    }

    return output;
  }

  static formatList(titles: string[]): string {
    if (titles.length === 0) return chalk.yellow('  No recipes in your vault yet.');
    const table = new Table({
      head: [chalk.magenta('ID'), chalk.magenta('Recipe Name')],
      colWidths: [5, 40],
      style: { head: [], border: ['gray'] }
    }) as any;

    titles.forEach((title, idx) => {
      table.push([idx + 1, title]);
    });

    return `\n  ${chalk.bold('YOUR RECIPE VAULT')}\n${table.toString()}\n`;
  }
}
