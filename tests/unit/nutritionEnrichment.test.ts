import { describe, it, expect } from 'vitest';
import { enrichRecipeNutrition, enrichRecipeNutritionWithProviders } from '../../src/lib/nutritionEnrichment';
import { manualProvider } from '../../src/lib/nutritionProviders';
import type { NutritionProviderClient, NutritionSearchResult } from '../../src/lib/nutritionProviders';
import type { Recipe } from '../../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecipe(overrides: Partial<Recipe> & { ingredients: string[] }): Recipe {
  return {
    id: 'test-recipe',
    name: 'Test Recipe',
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

// ─── Complete recipe ──────────────────────────────────────────────────────────

describe('enrichRecipeNutrition — complete recipe', () => {
  it('matches all ingredients that have grams and produces status=complete', async () => {
    const recipe = makeRecipe({
      ingredients: ['200 g pasta', '50 g parmigiano', '15 g olio'],
    });
    const { ingredientNutrition, nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(3);
    expect(nutrition.status).toBe('complete');
    expect(nutrition.perRecipe?.kcal).toBeGreaterThan(0);
    expect(nutrition.calculatedAt).toBeDefined();
  });

  it('preserves ingredientName from original string', async () => {
    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition[0].ingredientName).toBe('200 g pasta');
  });

  it('preserves grams from parser', async () => {
    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition[0].grams).toBe(200);
    expect(ingredientNutrition[0].quantity).toBe(200);
    expect(ingredientNutrition[0].unit).toBe('g');
  });

  it('calculates per-serving nutrition when servings provided', async () => {
    const recipe = makeRecipe({
      ingredients: ['200 g pasta'],
      servings:    '2',
    });
    const { nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(nutrition.servingsUsed).toBe(2);
    expect(nutrition.perServing?.kcal).toBeGreaterThan(0);
    expect(nutrition.perServing?.kcal).toBeLessThan(nutrition.perRecipe?.kcal ?? Infinity);
  });

  it('perServing is approximately half of perRecipe for 2 servings', async () => {
    const recipe = makeRecipe({
      ingredients: ['200 g pasta'],
      servings:    '2',
    });
    const { nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(nutrition.perServing!.kcal!).toBeCloseTo(nutrition.perRecipe!.kcal! / 2, 1);
  });

  it('each matched entry has a source with provider=manual and confidence>=0.7', async () => {
    const recipe = makeRecipe({ ingredients: ['200 g pasta', '100 g riso'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    for (const entry of ingredientNutrition) {
      expect(entry.source?.provider).toBe('manual');
      expect(entry.source?.confidence).toBeGreaterThanOrEqual(0.7);
      expect(entry.source?.fetchedAt).toBeDefined();
    }
  });
});

// ─── Servings parsing ─────────────────────────────────────────────────────────

describe('enrichRecipeNutrition — servings string', () => {
  it('parses "4 persone" into servingsUsed=4', async () => {
    const recipe = makeRecipe({
      ingredients: ['200 g pasta'],
      servings:    '4 persone',
    });
    const { nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(nutrition.servingsUsed).toBe(4);
    expect(nutrition.perServing?.kcal).toBeCloseTo(nutrition.perRecipe!.kcal! / 4, 1);
  });

  it('leaves perServing undefined when servings is absent', async () => {
    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const { nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(nutrition.servingsUsed).toBeUndefined();
    expect(nutrition.perServing).toBeUndefined();
  });

  it('leaves perServing undefined when servings is unparseable', async () => {
    const recipe = makeRecipe({
      ingredients: ['200 g pasta'],
      servings:    'quanto basta',
    });
    const { nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(nutrition.perServing).toBeUndefined();
  });
});

// ─── Partial recipe ───────────────────────────────────────────────────────────

describe('enrichRecipeNutrition — partial match', () => {
  it('skips unrecognised ingredients and marks status=partial', async () => {
    const recipe = makeRecipe({
      ingredients: ['200 g pasta', '100 g durian esotico rarissimo'],
    });
    const { ingredientNutrition, nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].ingredientName).toBe('200 g pasta');
    expect(nutrition.status).toBe('partial');
  });

  it('still computes perRecipe from matched ingredients', async () => {
    const recipe = makeRecipe({
      ingredients: ['200 g pasta', '100 g frutto sconosciuto'],
    });
    const { nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(nutrition.perRecipe?.kcal).toBeGreaterThan(0);
  });
});

// ─── No matches ───────────────────────────────────────────────────────────────

describe('enrichRecipeNutrition — no matches', () => {
  it('returns empty ingredientNutrition and status=missing', async () => {
    const recipe = makeRecipe({
      ingredients: ['100 g frutto esotico', '50 g spezia sconosciuta'],
    });
    const { ingredientNutrition, nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(0);
    expect(nutrition.status).toBe('missing');
    expect(nutrition.perRecipe).toBeUndefined();
  });

  it('returns empty ingredientNutrition for empty ingredients array', async () => {
    const recipe = makeRecipe({ ingredients: [] });
    const { ingredientNutrition, nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(0);
    expect(nutrition.status).toBe('missing');
  });
});

// ─── Dirty ingredient strings ─────────────────────────────────────────────────

describe('enrichRecipeNutrition — dirty ingredient strings', () => {
  it('handles compact unit notation "200g riso"', async () => {
    const recipe = makeRecipe({ ingredients: ['200g riso'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].grams).toBe(200);
  });

  it('handles comma decimal "1,5 kg patate"', async () => {
    const recipe = makeRecipe({ ingredients: ['1,5 kg patate'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].grams).toBe(1500);
  });

  it('handles countable "2 uova" — grams estimated from piece override', async () => {
    const recipe = makeRecipe({ ingredients: ['2 uova'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].quantity).toBe(2);
    expect(ingredientNutrition[0].unit).toBe('piece');
    expect(ingredientNutrition[0].grams).toBe(120); // 2 × 60g from UNIT_GRAM_CONVERSIONS
  });

  it('handles extra whitespace', async () => {
    const recipe = makeRecipe({ ingredients: ['  200  g   pasta  '] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].grams).toBe(200);
  });

  it('handles q.b. ingredients — matched but no grams', async () => {
    const recipe = makeRecipe({ ingredients: ['sale q.b.', '200 g pasta'] });
    const { ingredientNutrition, nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    const sale = ingredientNutrition.find(e => e.normalizedName?.includes('sale'));
    const pasta = ingredientNutrition.find(e => e.normalizedName === 'pasta');

    expect(sale).toBeDefined();
    expect(sale?.grams).toBeUndefined();
    expect(pasta?.grams).toBe(200);
    // sale matched but has no grams → not usable for calculation → partial
    expect(nutrition.status).toBe('partial');
  });

  it('handles alias spellings like "spaghetti"', async () => {
    const recipe = makeRecipe({ ingredients: ['100 g spaghetti'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].nutritionPer100g?.kcal).toBeGreaterThan(0);
  });
});

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('enrichRecipeNutrition — immutability', () => {
  it('does not mutate recipe.ingredients', async () => {
    const recipe = makeRecipe({ ingredients: ['200 g pasta', '50 g parmigiano'] });
    const originalIngredients = [...recipe.ingredients];
    await enrichRecipeNutrition(recipe, manualProvider);

    expect(recipe.ingredients).toEqual(originalIngredients);
  });

  it('does not attach ingredientNutrition to the original recipe object', async () => {
    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    expect((recipe as Record<string, unknown>)['ingredientNutrition']).toBeUndefined();
    await enrichRecipeNutrition(recipe, manualProvider);

    expect((recipe as Record<string, unknown>)['ingredientNutrition']).toBeUndefined();
  });

  it('does not attach nutrition to the original recipe object', async () => {
    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    expect(recipe.nutrition).toBeUndefined();
    await enrichRecipeNutrition(recipe, manualProvider);

    expect(recipe.nutrition).toBeUndefined();
  });

  it('returned ingredientNutrition is a new array not shared with recipe', async () => {
    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    ingredientNutrition.push({ ingredientName: 'injected' });
    expect(recipe.ingredients).toHaveLength(1);
  });
});

// ─── minConfidence option ─────────────────────────────────────────────────────

describe('enrichRecipeNutrition — minConfidence option', () => {
  it('uses default 0.7 when option is omitted', async () => {
    // "riso" exact alias → confidence 0.95, should match
    const recipe = makeRecipe({ ingredients: ['100 g riso'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);
    expect(ingredientNutrition).toHaveLength(1);
  });

  it('minConfidence=0 accepts all results including low-confidence ones', async () => {
    // A partial substring like "pat" should score lower than 0.7 but above 0
    // Use a stub that always returns confidence 0.5
    const lowConfProvider = {
      provider: 'manual' as const,
      displayName: 'LowConf',
      async search() {
        return [{
          id: 'stub-1', name: 'Patate', provider: 'manual' as const,
          nutritionPer100g: { kcal: 77 }, confidence: 0.5,
        }];
      },
    };

    const recipe = makeRecipe({ ingredients: ['200 g patate'] });

    const withDefault = await enrichRecipeNutrition(recipe, lowConfProvider);
    expect(withDefault.ingredientNutrition).toHaveLength(0); // 0.5 < 0.7 → rejected

    const withZero = await enrichRecipeNutrition(recipe, lowConfProvider, { minConfidence: 0 });
    expect(withZero.ingredientNutrition).toHaveLength(1);    // 0.5 >= 0 → accepted
  });

  it('minConfidence=1.0 rejects everything below perfect', async () => {
    // manualProvider returns 0.95 for exact alias match, not 1.0
    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(
      recipe, manualProvider, { minConfidence: 1.0 },
    );
    expect(ingredientNutrition).toHaveLength(0);
  });

  it('minConfidence=0.8 rejects partial-substring matches but accepts exact ones', async () => {
    // "pasta" is an exact alias → 0.95, passes 0.8
    const recipe1 = makeRecipe({ ingredients: ['200 g pasta'] });
    const r1 = await enrichRecipeNutrition(recipe1, manualProvider, { minConfidence: 0.8 });
    expect(r1.ingredientNutrition).toHaveLength(1);

    // Stub that returns 0.75 — above 0.7 default but below 0.8
    const midConfProvider = {
      provider: 'manual' as const,
      displayName: 'Mid',
      async search() {
        return [{
          id: 'stub-2', name: 'Pasta secca', provider: 'manual' as const,
          nutritionPer100g: { kcal: 350 }, confidence: 0.75,
        }];
      },
    };
    const recipe2 = makeRecipe({ ingredients: ['200 g pasta'] });
    const r2default = await enrichRecipeNutrition(recipe2, midConfProvider);
    expect(r2default.ingredientNutrition).toHaveLength(1);  // 0.75 >= 0.7

    const r2strict = await enrichRecipeNutrition(recipe2, midConfProvider, { minConfidence: 0.8 });
    expect(r2strict.ingredientNutrition).toHaveLength(0);   // 0.75 < 0.8
  });
});

// ─── tbsp / tsp / piece — grams now estimated ────────────────────────────────

describe('enrichRecipeNutrition — volume/count units with estimated grams', () => {
  it('tbsp ingredient is matched and grams estimated from conversion table', async () => {
    const recipe = makeRecipe({ ingredients: ['1 cucchiaio olio'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].unit).toBe('tbsp');
    expect(ingredientNutrition[0].grams).toBe(10); // 1 × 10g olio override
    expect(ingredientNutrition[0].nutritionPer100g?.kcal).toBeGreaterThan(0);
  });

  it('tsp ingredient is matched and grams estimated from conversion table', async () => {
    const recipe = makeRecipe({ ingredients: ['2 cucchiaini zucchero'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].unit).toBe('tsp');
    expect(ingredientNutrition[0].grams).toBe(8); // 2 × 4g zucchero override
  });

  it('tbsp ingredient contributes to perRecipe kcal via estimated grams', async () => {
    const recipe = makeRecipe({
      ingredients: ['200 g pasta', '1 cucchiaio olio'],
    });
    const { nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    // pasta: 350 kcal/100g × 200g = 700 kcal
    // olio: ~884 kcal/100g × 10g = 88.4 kcal
    const pastaKcal = 700;
    expect(nutrition.perRecipe?.kcal).toBeGreaterThan(pastaKcal);
  });

  it('recipe with only tbsp/tsp ingredients is complete when all have estimated grams', async () => {
    const recipe = makeRecipe({
      ingredients: ['1 cucchiaio olio', '1 cucchiaino sale'],
    });
    const { nutrition } = await enrichRecipeNutrition(recipe, manualProvider);

    // Both matched and both have estimated grams → all usable → complete
    expect(nutrition.status).toBe('complete');
  });
});

// ─── Provider error resilience ────────────────────────────────────────────────

describe('enrichRecipeNutrition — provider error resilience', () => {
  it('skips an ingredient if provider.search throws, continuing with the rest', async () => {
    let callCount = 0;
    const flakyProvider = {
      provider: 'manual' as const,
      displayName: 'Flaky',
      async search(q: { query: string }) {
        callCount++;
        if (q.query === 'pasta') throw new Error('network error');
        return manualProvider.search(q);
      },
    };

    const recipe = makeRecipe({ ingredients: ['200 g pasta', '50 g parmigiano'] });
    const { ingredientNutrition } = await enrichRecipeNutrition(recipe, flakyProvider);

    expect(callCount).toBe(2);
    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].normalizedName).toBe('parmigiano');
  });

  it('returns status=missing when all provider calls throw', async () => {
    const alwaysThrows = {
      provider: 'manual' as const,
      displayName: 'Broken',
      async search() { throw new Error('unavailable'); },
    };

    const recipe = makeRecipe({ ingredients: ['200 g pasta', '100 g riso'] });
    const { ingredientNutrition, nutrition } = await enrichRecipeNutrition(recipe, alwaysThrows);

    expect(ingredientNutrition).toHaveLength(0);
    expect(nutrition.status).toBe('missing');
  });
});

// ─── enrichRecipeNutritionWithProviders ───────────────────────────────────────

// Stub helpers — no real network calls.
function stubProvider(
  id: string,
  providerTag: 'manual' | 'openfoodfacts',
  knownIngredients: Record<string, NutritionSearchResult>,
  opts: { throws?: boolean; confidence?: number } = {},
): NutritionProviderClient {
  return {
    provider:    providerTag,
    displayName: id,
    async search(q) {
      if (opts.throws) throw new Error(`${id} unavailable`);
      const hit = knownIngredients[q.normalizedQuery ?? q.query ?? ''];
      if (!hit) return [];
      const conf = opts.confidence ?? hit.confidence;
      return [{ ...hit, confidence: conf }];
    },
  };
}

const pastaResult: NutritionSearchResult = {
  id: 'pasta-1', name: 'Pasta', provider: 'manual',
  nutritionPer100g: { kcal: 350, proteinG: 12 }, confidence: 0.95,
};
const risottoResult: NutritionSearchResult = {
  id: 'riso-off', name: 'Riso', provider: 'openfoodfacts',
  nutritionPer100g: { kcal: 360, proteinG: 7 }, confidence: 0.85,
};

describe('enrichRecipeNutritionWithProviders — provider ordering', () => {
  it('uses the first provider when it succeeds', async () => {
    const first  = stubProvider('first',  'manual',        { pasta: pastaResult });
    const second = stubProvider('second', 'openfoodfacts', {});

    let secondCalled = false;
    const trackingSecond: NutritionProviderClient = {
      ...second,
      async search(q) {
        secondCalled = true;
        return second.search(q);
      },
    };

    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [first, trackingSecond],
    );

    expect(ingredientNutrition).toHaveLength(1);
    expect(secondCalled).toBe(false);
  });

  it('falls back to the second provider when the first returns nothing above threshold', async () => {
    const emptyFirst  = stubProvider('empty',  'manual',        {});
    const second      = stubProvider('second', 'openfoodfacts', { pasta: { ...pastaResult, provider: 'openfoodfacts' } });

    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [emptyFirst, second],
    );

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].source?.provider).toBe('openfoodfacts');
  });

  it('falls back to the second provider when the first throws', async () => {
    const throwingFirst = stubProvider('broken', 'manual',        {}, { throws: true });
    const second        = stubProvider('good',   'openfoodfacts', { pasta: { ...pastaResult, provider: 'openfoodfacts' } });

    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [throwingFirst, second],
    );

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].source?.provider).toBe('openfoodfacts');
  });

  it('records source.provider per ingredient reflecting actual provider used', async () => {
    // First provider knows pasta, not riso. Second provider knows riso, not pasta.
    const first  = stubProvider('first',  'manual',        { pasta: pastaResult });
    const second = stubProvider('second', 'openfoodfacts', { riso: risottoResult });

    const recipe = makeRecipe({ ingredients: ['200 g pasta', '100 g riso'] });
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [first, second],
    );

    expect(ingredientNutrition).toHaveLength(2);
    const pastaEntry = ingredientNutrition.find(e => e.normalizedName === 'pasta');
    const risoEntry  = ingredientNutrition.find(e => e.normalizedName === 'riso');

    expect(pastaEntry?.source?.provider).toBe('manual');
    expect(risoEntry?.source?.provider).toBe('openfoodfacts');
  });

  it('skips ingredient when all providers fail', async () => {
    const broken1 = stubProvider('b1', 'manual',        {}, { throws: true });
    const broken2 = stubProvider('b2', 'openfoodfacts', {}, { throws: true });

    const recipe = makeRecipe({ ingredients: ['200 g pasta', '100 g riso'] });
    const { ingredientNutrition, nutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [broken1, broken2],
    );

    expect(ingredientNutrition).toHaveLength(0);
    expect(nutrition.status).toBe('missing');
  });

  it('skips ingredient when all providers return nothing above threshold', async () => {
    const low1 = stubProvider('low1', 'manual',        { pasta: pastaResult }, { confidence: 0.3 });
    const low2 = stubProvider('low2', 'openfoodfacts', { pasta: pastaResult }, { confidence: 0.4 });

    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [low1, low2],
    );

    expect(ingredientNutrition).toHaveLength(0);
  });

  it('handles empty providers list — all ingredients skipped', async () => {
    const recipe = makeRecipe({ ingredients: ['200 g pasta', '100 g riso'] });
    const { ingredientNutrition, nutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [],
    );

    expect(ingredientNutrition).toHaveLength(0);
    expect(nutrition.status).toBe('missing');
  });

  it('minConfidence option is respected across all providers', async () => {
    // confidence 0.6 is above default 0.7? No — 0.6 < 0.7 → rejected by default
    const provider = stubProvider('p', 'manual', { pasta: pastaResult }, { confidence: 0.6 });

    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });

    const defaultResult = await enrichRecipeNutritionWithProviders(recipe, [provider]);
    expect(defaultResult.ingredientNutrition).toHaveLength(0); // 0.6 < 0.7

    const relaxedResult = await enrichRecipeNutritionWithProviders(
      recipe, [provider], { minConfidence: 0.5 },
    );
    expect(relaxedResult.ingredientNutrition).toHaveLength(1); // 0.6 >= 0.5
  });

  it('with a single provider behaves identically to enrichRecipeNutrition', async () => {
    const recipe = makeRecipe({
      ingredients: ['200 g pasta', '50 g parmigiano'],
      servings:    '2',
    });

    const single = await enrichRecipeNutrition(recipe, manualProvider);
    const multi  = await enrichRecipeNutritionWithProviders(recipe, [manualProvider]);

    expect(multi.ingredientNutrition).toHaveLength(single.ingredientNutrition.length);
    expect(multi.nutrition.status).toBe(single.nutrition.status);
    expect(multi.nutrition.perServing?.kcal).toBeCloseTo(single.nutrition.perServing?.kcal ?? 0, 1);
  });

  it('does not mutate the recipe', async () => {
    const first  = stubProvider('first',  'manual',        { pasta: pastaResult });
    const recipe = makeRecipe({ ingredients: ['200 g pasta'] });
    const originalIngredients = [...recipe.ingredients];

    await enrichRecipeNutritionWithProviders(recipe, [first]);

    expect(recipe.ingredients).toEqual(originalIngredients);
    expect(recipe.nutrition).toBeUndefined();
  });

  it('mixed: first provider covers some, second covers the rest', async () => {
    const manualKnows = stubProvider('manual', 'manual', {
      pasta: pastaResult,
    });
    const offKnows = stubProvider('off', 'openfoodfacts', {
      riso: risottoResult,
    });

    const recipe = makeRecipe({
      ingredients: ['200 g pasta', '100 g riso', '50 g invisibile'],
    });
    const { ingredientNutrition, nutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [manualKnows, offKnows],
    );

    expect(ingredientNutrition).toHaveLength(2);
    expect(nutrition.status).toBe('partial');   // invisibile not matched
    expect(nutrition.perRecipe?.kcal).toBeGreaterThan(0);
  });
});
