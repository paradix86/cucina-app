import type { IngredientNutrition, RecipeNutrition } from '../types';
import { calculateRecipeNutrition } from './nutrition';

// ─── Input parsing ────────────────────────────────────────────────────────────

/**
 * Parse a gram value from a text input.
 *
 * Accepts both dot and comma as decimal separator ("10.5", "10,5" → 10.5).
 * Returns undefined for empty input, zero, negative values, or non-numeric text.
 */
export function parseGramsInput(raw: string): number | undefined {
  const s = raw.trim().replace(',', '.');
  if (!s) return undefined;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

// ─── Override application ─────────────────────────────────────────────────────

/** Map from ingredientName to the new gram value (undefined = clear grams). */
export type GramsOverrides = Record<string, number | undefined>;

/**
 * Apply user-supplied gram overrides to an IngredientNutrition array,
 * recalculate RecipeNutrition, and return both without mutating the inputs.
 *
 * For every ingredient whose name appears in `overrides`:
 *   - `grams` is replaced with the new value
 *   - `gramsEstimated` is set to false (the value is now user-supplied)
 *   - `source.provider` is forced to 'manual'
 *   - existing `nutritionPer100g` is preserved
 *
 * The resulting RecipeNutrition always has `status: 'manual'` to signal that
 * the numbers were edited by the user.
 */
export function applyGramsOverrides(params: {
  ingredientNutrition: IngredientNutrition[];
  overrides: GramsOverrides;
  ingredients: string[];
  servings?: string;
}): { ingredientNutrition: IngredientNutrition[]; nutrition: RecipeNutrition } {
  const { ingredientNutrition, overrides, ingredients, servings } = params;

  const updated: IngredientNutrition[] = ingredientNutrition.map(ing => {
    if (!(ing.ingredientName in overrides)) {
      return { ...ing, nutritionPer100g: ing.nutritionPer100g ? { ...ing.nutritionPer100g } : undefined };
    }
    const newGrams = overrides[ing.ingredientName];
    return {
      ...ing,
      grams:          newGrams,
      gramsEstimated: newGrams !== undefined ? false : undefined,
      source: {
        ...(ing.source ?? {}),
        provider: 'manual' as const,
      },
      nutritionPer100g: ing.nutritionPer100g ? { ...ing.nutritionPer100g } : undefined,
    };
  });

  const base = calculateRecipeNutrition({ ingredients, ingredientNutrition: updated, servings });
  const nutrition: RecipeNutrition = {
    ...base,
    status: 'manual',
    calculatedAt: base.calculatedAt ?? new Date().toISOString(),
  };

  return { ingredientNutrition: updated, nutrition };
}
