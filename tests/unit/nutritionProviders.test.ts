import { describe, it, expect } from 'vitest';
import {
  buildIngredientNutritionMatch,
  manualProvider,
  getProvider,
  NUTRITION_PROVIDERS,
} from '../../src/lib/nutritionProviders';
import type { NutritionSearchResult } from '../../src/lib/nutritionProviders';
import type { ParsedIngredientAmount } from '../../src/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeParsed(overrides: Partial<ParsedIngredientAmount> = {}): ParsedIngredientAmount {
  return {
    original: '200 g pasta',
    name: 'pasta',
    normalizedName: 'pasta',
    quantity: 200,
    unit: 'g',
    grams: 200,
    confidence: 0.9,
    ...overrides,
  };
}

function makeResult(overrides: Partial<NutritionSearchResult> = {}): NutritionSearchResult {
  return {
    id: 'manual-pasta-secca',
    name: 'Pasta secca',
    provider: 'manual',
    nutritionPer100g: { kcal: 350, proteinG: 12, carbsG: 70, fatG: 1.5 },
    confidence: 0.95,
    ...overrides,
  };
}

// ─── buildIngredientNutritionMatch ────────────────────────────────────────────

describe('buildIngredientNutritionMatch — result mapping', () => {
  it('maps ingredientName from parsed.original when present', () => {
    const match = buildIngredientNutritionMatch(makeParsed(), makeResult());
    expect(match.ingredientName).toBe('200 g pasta');
  });

  it('falls back to parsed.name when original is empty', () => {
    const match = buildIngredientNutritionMatch(
      makeParsed({ original: '', name: 'pasta' }),
      makeResult(),
    );
    expect(match.ingredientName).toBe('pasta');
  });

  it('maps normalizedName from parsed', () => {
    const match = buildIngredientNutritionMatch(makeParsed({ normalizedName: 'pasta secca' }), makeResult());
    expect(match.normalizedName).toBe('pasta secca');
  });

  it('maps quantity and unit from parsed', () => {
    const match = buildIngredientNutritionMatch(makeParsed({ quantity: 80, unit: 'g' }), makeResult());
    expect(match.quantity).toBe(80);
    expect(match.unit).toBe('g');
  });

  it('maps grams from parsed when available', () => {
    const match = buildIngredientNutritionMatch(makeParsed({ grams: 200 }), makeResult());
    expect(match.grams).toBe(200);
  });

  it('leaves grams undefined when parsed has no grams (e.g. tbsp ingredient)', () => {
    const match = buildIngredientNutritionMatch(
      makeParsed({ grams: undefined, unit: 'tbsp', quantity: 2 }),
      makeResult(),
    );
    expect(match.grams).toBeUndefined();
  });

  it('maps nutritionPer100g from result, not from parsed', () => {
    const nutrition = { kcal: 884, fatG: 100 };
    const match = buildIngredientNutritionMatch(makeParsed(), makeResult({ nutritionPer100g: nutrition }));
    expect(match.nutritionPer100g?.kcal).toBe(884);
    expect(match.nutritionPer100g?.fatG).toBe(100);
  });
});

describe('buildIngredientNutritionMatch — source and confidence propagation', () => {
  it('sets source.provider from result', () => {
    const match = buildIngredientNutritionMatch(makeParsed(), makeResult({ provider: 'usda' }));
    expect(match.source?.provider).toBe('usda');
  });

  it('propagates result.confidence into source.confidence', () => {
    const match = buildIngredientNutritionMatch(makeParsed(), makeResult({ confidence: 0.75 }));
    expect(match.source?.confidence).toBe(0.75);
  });

  it('sets source.externalId from result.id', () => {
    const match = buildIngredientNutritionMatch(makeParsed(), makeResult({ id: 'usda-12345' }));
    expect(match.source?.externalId).toBe('usda-12345');
  });

  it('sets source.externalUrl when result provides one', () => {
    const match = buildIngredientNutritionMatch(
      makeParsed(),
      makeResult({ externalUrl: 'https://example.com/food/123' }),
    );
    expect(match.source?.externalUrl).toBe('https://example.com/food/123');
  });

  it('sets source.externalUrl to undefined when result has none', () => {
    const match = buildIngredientNutritionMatch(makeParsed(), makeResult({ externalUrl: undefined }));
    expect(match.source?.externalUrl).toBeUndefined();
  });

  it('sets source.fetchedAt to a current ISO timestamp', () => {
    const before = new Date().toISOString();
    const match = buildIngredientNutritionMatch(makeParsed(), makeResult());
    const after = new Date().toISOString();
    expect(match.source?.fetchedAt).toBeDefined();
    expect(match.source!.fetchedAt! >= before).toBe(true);
    expect(match.source!.fetchedAt! <= after).toBe(true);
  });
});

describe('buildIngredientNutritionMatch — robustness', () => {
  it('does not throw when nutritionPer100g is empty', () => {
    expect(() =>
      buildIngredientNutritionMatch(makeParsed(), makeResult({ nutritionPer100g: {} })),
    ).not.toThrow();
  });

  it('handles parsed ingredient with no quantity or unit', () => {
    const match = buildIngredientNutritionMatch(
      makeParsed({ quantity: undefined, unit: undefined, grams: undefined }),
      makeResult(),
    );
    expect(match.quantity).toBeUndefined();
    expect(match.unit).toBeUndefined();
    expect(match.grams).toBeUndefined();
    expect(match.ingredientName).toBeDefined();
  });

  it('handles result confidence of 0 without throwing', () => {
    expect(() =>
      buildIngredientNutritionMatch(makeParsed(), makeResult({ confidence: 0 })),
    ).not.toThrow();
  });
});

// ─── manualProvider metadata ──────────────────────────────────────────────────

describe('manualProvider — metadata', () => {
  it('has provider = "manual"', () => {
    expect(manualProvider.provider).toBe('manual');
  });

  it('has a non-empty displayName', () => {
    expect(manualProvider.displayName).toBeTruthy();
    expect(typeof manualProvider.displayName).toBe('string');
  });

  it('exposes a search function', () => {
    expect(typeof manualProvider.search).toBe('function');
  });
});

// ─── manualProvider search ────────────────────────────────────────────────────

describe('manualProvider — search', () => {
  it('returns results for a known ingredient', async () => {
    const results = await manualProvider.search({ query: 'pasta' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].provider).toBe('manual');
    expect(results[0].nutritionPer100g.kcal).toBeDefined();
  });

  it('returns results for an alias form of a known ingredient', async () => {
    const results = await manualProvider.search({ query: 'spaghetti' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Pasta secca');
  });

  it('returns empty array for an unknown ingredient', async () => {
    const results = await manualProvider.search({ query: 'durian esotico raro' });
    expect(results).toEqual([]);
  });

  it('returns empty array for an empty query', async () => {
    const results = await manualProvider.search({ query: '' });
    expect(results).toEqual([]);
  });

  it('respects maxResults limit', async () => {
    const results = await manualProvider.search({ query: 'a', maxResults: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('results are sorted by confidence descending', async () => {
    const results = await manualProvider.search({ query: 'olio' });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });

  it('exact match has higher confidence than partial match', async () => {
    const [first, ...rest] = await manualProvider.search({ query: 'pasta' });
    for (const r of rest) {
      expect(first.confidence).toBeGreaterThanOrEqual(r.confidence);
    }
  });

  it('uses normalizedQuery when provided, preferring it over query', async () => {
    const results = await manualProvider.search({ query: 'RISO', normalizedQuery: 'riso' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Riso');
  });

  it('returns confidence in 0–1 range for every result', async () => {
    const queries = ['pasta', 'olio', 'latte', 'sale', 'uova'];
    for (const q of queries) {
      const results = await manualProvider.search({ query: q });
      for (const r of results) {
        expect(r.confidence).toBeGreaterThan(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it('result id is unique within a single response', async () => {
    const results = await manualProvider.search({ query: 'a', maxResults: 10 });
    const ids = results.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each result includes nutritionPer100g with at least one field', async () => {
    const results = await manualProvider.search({ query: 'pasta' });
    for (const r of results) {
      const hasAny = Object.values(r.nutritionPer100g).some(v => v !== undefined);
      expect(hasAny).toBe(true);
    }
  });

  it('sale result omits kcal (non-caloric ingredient)', async () => {
    const results = await manualProvider.search({ query: 'sale' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].nutritionPer100g.kcal).toBeUndefined();
    expect(results[0].nutritionPer100g.saltG).toBe(100);
  });
});

// ─── Provider registry ────────────────────────────────────────────────────────

describe('NUTRITION_PROVIDERS registry', () => {
  it('contains at least one provider', () => {
    expect(NUTRITION_PROVIDERS.length).toBeGreaterThan(0);
  });

  it('contains the manual provider', () => {
    expect(NUTRITION_PROVIDERS.some(p => p.provider === 'manual')).toBe(true);
  });

  it('all providers have unique provider identifiers', () => {
    const ids = NUTRITION_PROVIDERS.map(p => p.provider);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getProvider', () => {
  it('returns the manual provider by id', () => {
    const p = getProvider('manual');
    expect(p).toBeDefined();
    expect(p?.provider).toBe('manual');
  });

  it('returns openfoodfacts provider now that it is registered', () => {
    const p = getProvider('openfoodfacts');
    expect(p).toBeDefined();
    expect(p?.provider).toBe('openfoodfacts');
  });

  it('returns undefined for providers not yet registered', () => {
    expect(getProvider('usda')).toBeUndefined();
  });

  it('returns undefined for "unknown"', () => {
    expect(getProvider('unknown')).toBeUndefined();
  });
});
