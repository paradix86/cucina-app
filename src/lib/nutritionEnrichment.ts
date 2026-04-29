import type { IngredientNutrition, Recipe, RecipeNutrition } from '../types';
import { parseIngredientAmount, calculateRecipeNutrition, estimateGrams } from './nutrition';
import { buildIngredientNutritionMatch } from './nutritionProviders';
import type { NutritionProviderClient, NutritionSearchResult } from './nutritionProviders';
import { buildNutritionSearchQueries } from './ingredientMatching';

export type NutritionEnrichmentOptions = {
  minConfidence?: number;  // default 0.7
  language?: string;
};

const DEFAULT_MIN_CONFIDENCE = 0.7;

// Confidence boost applied when an alias-derived query (index > 0 in the query
// list) produces a match.  The alias mapping is authoritative, so a match via
// an alias is slightly more reliable than a generic substring hit would suggest.
const ALIAS_CONFIDENCE_BOOST = 0.05;

// Try providers in order for each ingredient.  The first provider that returns
// a result above minConfidence wins for that ingredient; subsequent providers
// are not consulted for it.  If every provider fails or returns nothing above
// threshold, the ingredient is silently skipped.
//
// For each provider, multiple search queries may be attempted in the order
// produced by buildNutritionSearchQueries():
//   1. The primary normalised name
//   2. Alias-derived base names (e.g. 'olio extravergine di oliva' → 'olio')
//
// A provider network error aborts the remaining queries for that provider and
// falls through to the next provider.  Empty results advance to the next query.
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
  const language = options?.language;
  const ingredientNutrition: IngredientNutrition[] = [];

  // Build a lookup of user-edited entries keyed by ingredientName.
  // ingredientName equals the raw ingredient string in production data
  // (set by buildIngredientNutritionMatch via parsed.original). A short-name
  // fallback via parsed.name handles older seed data.
  const userEditedMap = new Map<string, IngredientNutrition>();
  for (const ing of recipe.ingredientNutrition ?? []) {
    if (ing.source?.userEdited === true) {
      userEditedMap.set(ing.ingredientName, ing);
    }
  }

  for (const raw of recipe.ingredients) {
    const parsed = parseIngredientAmount(raw);

    // Preserve user-edited entries: skip provider lookup and reuse the stored entry.
    // Primary key is the raw ingredient string; fall back to parsed.name for
    // entries created before the full-string convention was established.
    const userEntry = userEditedMap.get(raw) ?? (parsed.name ? userEditedMap.get(parsed.name) : undefined);
    if (userEntry) {
      ingredientNutrition.push({
        ...userEntry,
        nutritionPer100g: userEntry.nutritionPer100g ? { ...userEntry.nutritionPer100g } : undefined,
      });
      continue;
    }

    const queries = buildNutritionSearchQueries(parsed.normalizedName, parsed.name);
    if (queries.length === 0) continue;

    let ingredientMatched = false;

    for (const provider of providers) {
      if (ingredientMatched) break;

      for (let qi = 0; qi < queries.length; qi++) {
        const queryText = queries[qi];
        const isAliasQuery = qi > 0;

        let results: NutritionSearchResult[];
        try {
          results = await provider.search({
            query:           queryText,
            normalizedQuery: queryText,
            maxResults:      5,
            ...(language !== undefined && { language }),
          });
        } catch {
          break;  // provider failed entirely; try the next provider
        }

        // Results are sorted descending by confidence; take first above threshold.
        let best = results.find(r => r.confidence >= minConfidence);
        if (!best) continue;  // nothing above threshold for this query; try the next query

        // Apply a small confidence boost when the match came via an alias query:
        // the alias mapping is explicit and reliable, so the effective confidence
        // is slightly higher than the raw provider score.
        if (isAliasQuery) {
          best = { ...best, confidence: Math.min(1.0, best.confidence + ALIAS_CONFIDENCE_BOOST) };
        }

        const match = buildIngredientNutritionMatch(parsed, best);
        if (match.grams === undefined) {
          const estimated = estimateGrams(parsed);
          if (estimated !== undefined) {
            ingredientNutrition.push({ ...match, grams: estimated, gramsEstimated: true });
          } else {
            // Ingredient matched nutritionally but gram amount unavailable.
            // Push it so transparency helpers can report it as missing_grams.
            ingredientNutrition.push(match);
          }
        } else {
          ingredientNutrition.push(match);
        }
        ingredientMatched = true;
        break;
      }
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
