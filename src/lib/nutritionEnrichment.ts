import type { IngredientNutrition, Recipe, RecipeNutrition } from '../types';
import { parseIngredientAmount, calculateRecipeNutrition, estimateGrams } from './nutrition';
import { buildIngredientNutritionMatch } from './nutritionProviders';
import type { NutritionProviderClient } from './nutritionProviders';

export type NutritionEnrichmentOptions = {
  minConfidence?: number;  // default 0.7
};

const DEFAULT_MIN_CONFIDENCE = 0.7;

// Try providers in order for each ingredient.  The first provider that returns
// a result above minConfidence wins for that ingredient; subsequent providers
// are not consulted for it.  If every provider fails or returns nothing above
// threshold, the ingredient is silently skipped.
//
// source.provider on each returned IngredientNutrition reflects which provider
// actually supplied the data, so callers can tell manual from openfoodfacts etc.
export async function enrichRecipeNutritionWithProviders(
  recipe: Recipe,
  providers: NutritionProviderClient[],
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

    for (const provider of providers) {
      let results;
      try {
        results = await provider.search({
          query:           queryText,
          normalizedQuery: parsed.normalizedName,
          maxResults:      5,
        });
      } catch {
        continue;  // this provider failed; try the next one
      }

      // Results are sorted descending by confidence; take first above threshold.
      const best = results.find(r => r.confidence >= minConfidence);
      if (!best) continue;  // nothing useful from this provider; try the next one

      const match = buildIngredientNutritionMatch(parsed, best);
      if (match.grams === undefined) {
        const estimated = estimateGrams(parsed);
        if (estimated !== undefined) {
          ingredientNutrition.push({ ...match, grams: estimated, gramsEstimated: true });
          break;
        }
      }
      ingredientNutrition.push(match);
      break;  // matched — do not consult further providers for this ingredient
    }
  }

  const nutrition = calculateRecipeNutrition({
    ingredients:         recipe.ingredients,
    ingredientNutrition,
    servings:            recipe.servings,
  });

  return { ingredientNutrition, nutrition };
}

// Single-provider convenience wrapper kept for backward compatibility.
export async function enrichRecipeNutrition(
  recipe: Recipe,
  provider: NutritionProviderClient,
  options?: NutritionEnrichmentOptions,
): Promise<{
  ingredientNutrition: IngredientNutrition[];
  nutrition: RecipeNutrition;
}> {
  return enrichRecipeNutritionWithProviders(recipe, [provider], options);
}
