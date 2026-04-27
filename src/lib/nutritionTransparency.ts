import type { IngredientNutrition, NutritionSource } from '../types';

export type ExcludedReason = 'no_match' | 'missing_grams' | 'missing_nutrition';

export type EstimatedIngredientInfo = {
  name: string;
  grams: number;
};

export type ExcludedIngredientInfo = {
  name: string;
  reason: ExcludedReason;
};

function isUsable(ing: IngredientNutrition): boolean {
  if (!ing.grams || ing.grams <= 0) return false;
  if (!ing.nutritionPer100g) return false;
  return Object.values(ing.nutritionPer100g).some(v => v !== undefined);
}

export function deriveEstimatedIngredients(
  ingredientNutrition: IngredientNutrition[],
): EstimatedIngredientInfo[] {
  return ingredientNutrition
    .filter(ing => ing.gramsEstimated === true && ing.grams !== undefined)
    .map(ing => ({ name: ing.ingredientName, grams: ing.grams! }));
}

export function deriveExcludedIngredients(
  ingredients: string[],
  ingredientNutrition: IngredientNutrition[],
): ExcludedIngredientInfo[] {
  return ingredients.flatMap(raw => {
    const entry = ingredientNutrition.find(ing => ing.ingredientName === raw);
    if (!entry) return [{ name: raw, reason: 'no_match' as ExcludedReason }];
    if (isUsable(entry)) return [];
    if (!entry.grams || entry.grams <= 0) return [{ name: raw, reason: 'missing_grams' as ExcludedReason }];
    return [{ name: raw, reason: 'missing_nutrition' as ExcludedReason }];
  });
}

const PROVIDER_NAMES: Record<string, string> = {
  manual:         'Manual',
  openfoodfacts:  'OpenFoodFacts',
  usda:           'USDA',
  unknown:        'Unknown',
};

export function deriveProviderNames(
  sources: NutritionSource[] | undefined,
): string[] {
  if (!sources || sources.length === 0) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const s of sources) {
    const name = PROVIDER_NAMES[s.provider] ?? s.provider;
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}
