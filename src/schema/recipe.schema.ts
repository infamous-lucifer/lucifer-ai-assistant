import { z } from 'zod';

export const IngredientSchema = z.object({
  item: z.string(),
  amount: z.string().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

export const RecipeSchema = z.object({
  id: z.string().optional(), // File name or UUID
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  ingredients: z.array(IngredientSchema),
  instructions: z.array(z.string()),
  metadata: z.object({
    prepTime: z.string().optional(),
    cookTime: z.string().optional(),
    servings: z.number().optional(),
    sourceUrl: z.string().url().optional(),
    author: z.string().optional(),
  }).optional(),
});

export type Recipe = z.infer<typeof RecipeSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
