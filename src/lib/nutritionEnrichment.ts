import type { IngredientNutrition, Recipe, RecipeNutrition } from '../types';
import { parseIngredientAmount, calculateRecipeNutrition } from './nutrition';
import { buildIngredientNutritionMatch } from './nutritionProviders';
import type { NutritionProviderClient } from './nutritionProviders';

export type NutritionEnrichmentOptions = {
  minConfidence?: number;  // default 0.7
};

const DEFAULT_MIN_CONFIDENCE = 0.7;

export async function enrichRecipeNutrition(
  recipe: Recipe,
  provider: NutritionProviderClient,
  options?: NutritionEnrichmentOptions,
): Promise<{
  ingredientNutrition: IngredientNutrition[];
  nutrition: RecipeNutrition;
}> {
  const minConfidence = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const ingredientNutrition: IngredientNutrition[] = [];

  for (const raw of recipe.ingredients) {
    const parsed = parseIngredientAmount(raw);
    const queryText = parsed.normalizedName ?? parsed.name;
    if (!queryText) continue;

    let results;
    try {
      results = await provider.search({
        query:           queryText,
        normalizedQuery: parsed.normalizedName,
        maxResults:      5,
      });
    } catch {
      continue;
    }

    // Results are sorted descending by confidence; take first above threshold.
    const best = results.find(r => r.confidence >= minConfidence);
    if (!best) continue;

    ingredientNutrition.push(buildIngredientNutritionMatch(parsed, best));
  }

  const nutrition = calculateRecipeNutrition({
    ingredients:         recipe.ingredients,
    ingredientNutrition,
    servings:            recipe.servings,
  });

  return { ingredientNutrition, nutrition };
}
