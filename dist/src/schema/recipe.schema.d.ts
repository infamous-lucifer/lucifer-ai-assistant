import { z } from 'zod';
export declare const IngredientSchema: z.ZodObject<{
    item: z.ZodString;
    amount: z.ZodOptional<z.ZodString>;
    unit: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const RecipeSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    ingredients: z.ZodArray<z.ZodObject<{
        item: z.ZodString;
        amount: z.ZodOptional<z.ZodString>;
        unit: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    instructions: z.ZodArray<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        prepTime: z.ZodOptional<z.ZodString>;
        cookTime: z.ZodOptional<z.ZodString>;
        servings: z.ZodOptional<z.ZodNumber>;
        sourceUrl: z.ZodOptional<z.ZodString>;
        author: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
//# sourceMappingURL=recipe.schema.d.ts.map