import { describe, it, expect } from 'vitest';
import {
  deriveEstimatedIngredients,
  deriveExcludedIngredients,
  deriveProviderNames,
} from '../../src/lib/nutritionTransparency';
import type { IngredientNutrition, NutritionSource } from '../../src/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeIngNutrition(overrides: Partial<IngredientNutrition> = {}): IngredientNutrition {
  return {
    ingredientName: '200 g pasta',
    normalizedName: 'pasta',
    quantity: 200,
    unit: 'g',
    grams: 200,
    gramsEstimated: undefined,
    nutritionPer100g: { kcal: 350, proteinG: 12, carbsG: 70, fatG: 1.5 },
    source: { provider: 'manual', confidence: 0.95 },
    ...overrides,
  };
}

function makeSource(provider: NutritionSource['provider']): NutritionSource {
  return { provider, confidence: 0.9 };
}

// ─── deriveEstimatedIngredients ───────────────────────────────────────────────

describe('deriveEstimatedIngredients', () => {
  it('returns empty array when no gramsEstimated entries', () => {
    const entries = [makeIngNutrition(), makeIngNutrition({ ingredientName: '50 g riso', normalizedName: 'riso' })];
    expect(deriveEstimatedIngredients(entries)).toEqual([]);
  });

  it('returns entry when gramsEstimated is true', () => {
    const entries = [
      makeIngNutrition({ ingredientName: '1 cucchiaio olio', grams: 10, gramsEstimated: true }),
    ];
    const result = deriveEstimatedIngredients(entries);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('1 cucchiaio olio');
    expect(result[0].grams).toBe(10);
  });

  it('excludes entries where gramsEstimated is false', () => {
    const entries = [makeIngNutrition({ gramsEstimated: false })];
    expect(deriveEstimatedIngredients(entries)).toEqual([]);
  });

  it('excludes entries where gramsEstimated is undefined', () => {
    const entries = [makeIngNutrition({ gramsEstimated: undefined })];
    expect(deriveEstimatedIngredients(entries)).toEqual([]);
  });

  it('returns multiple estimated entries', () => {
    const entries = [
      makeIngNutrition({ ingredientName: '1 cucchiaio olio', grams: 10, gramsEstimated: true }),
      makeIngNutrition({ ingredientName: '200 g pasta', grams: 200 }),
      makeIngNutrition({ ingredientName: '2 uova', grams: 120, gramsEstimated: true }),
    ];
    const result = deriveEstimatedIngredients(entries);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.name)).toEqual(['1 cucchiaio olio', '2 uova']);
  });

  it('returns empty array for empty input', () => {
    expect(deriveEstimatedIngredients([])).toEqual([]);
  });
});

// ─── deriveExcludedIngredients ────────────────────────────────────────────────

describe('deriveExcludedIngredients — no_match', () => {
  it('marks ingredient as no_match when it has no entry', () => {
    const result = deriveExcludedIngredients(['100 g sconosciuto'], []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('100 g sconosciuto');
    expect(result[0].reason).toBe('no_match');
  });

  it('marks multiple unmatched ingredients', () => {
    const result = deriveExcludedIngredients(['100 g a', '50 g b'], []);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.reason === 'no_match')).toBe(true);
  });
});

describe('deriveExcludedIngredients — usable entries not excluded', () => {
  it('does not exclude a fully usable ingredient', () => {
    const entries = [makeIngNutrition({ ingredientName: '200 g pasta' })];
    const result = deriveExcludedIngredients(['200 g pasta'], entries);
    expect(result).toHaveLength(0);
  });

  it('does not exclude any of multiple usable entries', () => {
    const entries = [
      makeIngNutrition({ ingredientName: '200 g pasta' }),
      makeIngNutrition({ ingredientName: '50 g parmigiano' }),
    ];
    const result = deriveExcludedIngredients(['200 g pasta', '50 g parmigiano'], entries);
    expect(result).toHaveLength(0);
  });
});

describe('deriveExcludedIngredients — missing_grams', () => {
  it('marks entry with grams=undefined as missing_grams', () => {
    const entries = [makeIngNutrition({ ingredientName: 'sale q.b.', grams: undefined })];
    const result = deriveExcludedIngredients(['sale q.b.'], entries);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('missing_grams');
  });

  it('marks entry with grams=0 as missing_grams', () => {
    const entries = [makeIngNutrition({ ingredientName: '1 pezzo pomodoro', grams: 0 })];
    const result = deriveExcludedIngredients(['1 pezzo pomodoro'], entries);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('missing_grams');
  });
});

describe('deriveExcludedIngredients — missing_nutrition', () => {
  it('marks entry with grams but no nutritionPer100g as missing_nutrition', () => {
    const entries = [makeIngNutrition({ ingredientName: '50 g x', nutritionPer100g: undefined })];
    const result = deriveExcludedIngredients(['50 g x'], entries);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('missing_nutrition');
  });

  it('marks entry with grams but empty nutritionPer100g as missing_nutrition', () => {
    const entries = [makeIngNutrition({ ingredientName: '50 g x', nutritionPer100g: {} })];
    const result = deriveExcludedIngredients(['50 g x'], entries);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('missing_nutrition');
  });
});

describe('deriveExcludedIngredients — mixed recipe', () => {
  it('handles a mix of matched, excluded, and unmatched', () => {
    const entries = [
      makeIngNutrition({ ingredientName: '200 g pasta' }),
      makeIngNutrition({ ingredientName: 'sale q.b.', grams: undefined }),
    ];
    const ingredients = ['200 g pasta', 'sale q.b.', '100 g sconosciuto'];
    const result = deriveExcludedIngredients(ingredients, entries);

    expect(result).toHaveLength(2);
    expect(result.find(r => r.name === 'sale q.b.')?.reason).toBe('missing_grams');
    expect(result.find(r => r.name === '100 g sconosciuto')?.reason).toBe('no_match');
  });

  it('returns empty for fully matched recipe', () => {
    const entries = [
      makeIngNutrition({ ingredientName: '200 g pasta' }),
      makeIngNutrition({ ingredientName: '50 g parmigiano' }),
    ];
    const result = deriveExcludedIngredients(['200 g pasta', '50 g parmigiano'], entries);
    expect(result).toHaveLength(0);
  });

  it('handles empty ingredients list', () => {
    expect(deriveExcludedIngredients([], [])).toEqual([]);
  });
});

// ─── deriveProviderNames ──────────────────────────────────────────────────────

describe('deriveProviderNames', () => {
  it('returns empty array for undefined sources', () => {
    expect(deriveProviderNames(undefined)).toEqual([]);
  });

  it('returns empty array for empty sources array', () => {
    expect(deriveProviderNames([])).toEqual([]);
  });

  it('returns display name for manual provider', () => {
    const result = deriveProviderNames([makeSource('manual')]);
    expect(result).toEqual(['Manual']);
  });

  it('returns display name for openfoodfacts provider', () => {
    const result = deriveProviderNames([makeSource('openfoodfacts')]);
    expect(result).toEqual(['OpenFoodFacts']);
  });

  it('deduplicates repeated providers', () => {
    const sources = [makeSource('manual'), makeSource('manual'), makeSource('manual')];
    const result = deriveProviderNames(sources);
    expect(result).toEqual(['Manual']);
  });

  it('returns multiple unique providers in order of first appearance', () => {
    const sources = [makeSource('manual'), makeSource('openfoodfacts'), makeSource('manual')];
    const result = deriveProviderNames(sources);
    expect(result).toEqual(['Manual', 'OpenFoodFacts']);
  });

  it('handles unknown provider id gracefully', () => {
    const result = deriveProviderNames([{ provider: 'unknown' }]);
    expect(result).toEqual(['Unknown']);
  });
});
