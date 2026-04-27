import type { IngredientNutrition, NutritionPer100g, RecipeNutrition } from '../types';
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

/**
 * Parse a per-100g nutrient value from a text input.
 *
 * Like parseGramsInput but allows zero (e.g. 0 kcal for water, 0g fiber for butter).
 * Returns undefined for empty input, negative values, or non-numeric text.
 */
export function parseNutrientInput(raw: string): number | undefined {
  const s = raw.trim().replace(',', '.');
  if (!s) return undefined;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

// ─── Override application ─────────────────────────────────────────────────────

/** Map from ingredientName to the new gram value (undefined = clear grams). */
export type GramsOverrides = Record<string, number | undefined>;

/**
 * Patch for per-100g nutrition values.  Each field is optional — present fields
 * replace the stored value; absent fields are not touched.  Set a field to
 * undefined explicitly to clear it (remove its contribution from the total).
 */
export type Per100gFieldPatch = Partial<NutritionPer100g>;

/** Map from ingredientName to a per-100g patch (undefined entry = skip ingredient). */
export type Per100gOverrides = Record<string, Per100gFieldPatch | undefined>;

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
        provider:   'manual' as const,
        userEdited: true,
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

/**
 * Apply both gram overrides and per-100g nutrition patches in a single pass,
 * recalculate RecipeNutrition, and return both without mutating the inputs.
 *
 * Rules per ingredient:
 *   - If its name appears in `gramsOverrides`: grams and gramsEstimated are updated.
 *   - If its name appears in `per100gOverrides`: the patch is merged onto the
 *     existing nutritionPer100g (fields present in the patch replace stored
 *     values; fields absent from the patch are preserved; a field set to undefined
 *     in the patch is cleared from the result).
 *   - If either override applies, source.provider is forced to 'manual'.
 *   - Ingredients in neither map are shallow-cloned only.
 *
 * The resulting RecipeNutrition always has status: 'manual'.
 */
export function applyNutritionOverrides(params: {
  ingredientNutrition: IngredientNutrition[];
  gramsOverrides: GramsOverrides;
  per100gOverrides: Per100gOverrides;
  ingredients: string[];
  servings?: string;
}): { ingredientNutrition: IngredientNutrition[]; nutrition: RecipeNutrition } {
  const { ingredientNutrition, gramsOverrides, per100gOverrides, ingredients, servings } = params;

  const updated: IngredientNutrition[] = ingredientNutrition.map(ing => {
    const hasGrams  = ing.ingredientName in gramsOverrides;
    const hasPer100 = (ing.ingredientName in per100gOverrides) &&
                      per100gOverrides[ing.ingredientName] !== undefined;

    if (!hasGrams && !hasPer100) {
      return { ...ing, nutritionPer100g: ing.nutritionPer100g ? { ...ing.nutritionPer100g } : undefined };
    }

    let newGrams          = ing.grams;
    let newGramsEstimated = ing.gramsEstimated;
    if (hasGrams) {
      newGrams          = gramsOverrides[ing.ingredientName];
      newGramsEstimated = newGrams !== undefined ? false : undefined;
    }

    let newPer100g: NutritionPer100g | undefined;
    if (hasPer100) {
      // Spread patch over existing; explicit undefined values in the patch clear
      // the corresponding fields (they become undefined in the merged object).
      newPer100g = { ...(ing.nutritionPer100g ?? {}), ...per100gOverrides[ing.ingredientName] };
    } else {
      newPer100g = ing.nutritionPer100g ? { ...ing.nutritionPer100g } : undefined;
    }

    return {
      ...ing,
      grams:            newGrams,
      gramsEstimated:   newGramsEstimated,
      source:           { ...(ing.source ?? {}), provider: 'manual' as const, userEdited: true },
      nutritionPer100g: newPer100g,
    };
  });

  const base = calculateRecipeNutrition({ ingredients, ingredientNutrition: updated, servings });
  const nutrition: RecipeNutrition = {
    ...base,
    status:      'manual',
    calculatedAt: base.calculatedAt ?? new Date().toISOString(),
  };

  return { ingredientNutrition: updated, nutrition };
}
