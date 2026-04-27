import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeNutritionPer100g,
  normalizeNutritionSource,
  normalizeIngredientNutrition,
  normalizeIngredientNutritionArray,
  normalizeRecipeNutrition,
  parseIngredientAmount,
  parseServings,
  scaleNutritionBlock,
  addNutritionBlocks,
  calculateRecipeNutrition,
} from '../../src/lib/nutrition';
import {
  addRecipe,
  loadRecipeBook,
  resetStorageAdapter,
  waitForStorageBootstrap,
} from '../../src/lib/storage';
import { CucinaDexieDb } from '../../src/lib/persistence/dexieDb';

// ─── Test infrastructure ──────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

async function clearDexieDb(): Promise<void> {
  const db = new CucinaDexieDb();
  await db.delete();
  db.close();
}

beforeEach(async () => {
  globalThis.localStorage = localStorageMock as unknown as Storage;
  localStorageMock.clear();
  resetStorageAdapter();
  await clearDexieDb();
});

afterEach(async () => {
  vi.clearAllMocks();
  await waitForStorageBootstrap().catch(() => undefined);
  resetStorageAdapter();
  await clearDexieDb();
});

// ─── normalizeNutritionPer100g ────────────────────────────────────────────────

describe('normalizeNutritionPer100g', () => {
  it('returns undefined for null/undefined/non-object inputs', () => {
    expect(normalizeNutritionPer100g(null)).toBeUndefined();
    expect(normalizeNutritionPer100g(undefined)).toBeUndefined();
    expect(normalizeNutritionPer100g('200')).toBeUndefined();
    expect(normalizeNutritionPer100g(42)).toBeUndefined();
  });

  it('returns an empty object for an empty input object', () => {
    const result = normalizeNutritionPer100g({});
    expect(result).toBeDefined();
    expect(result?.kcal).toBeUndefined();
  });

  it('preserves valid non-negative numeric fields', () => {
    const result = normalizeNutritionPer100g({ kcal: 250, proteinG: 12.5, fatG: 0 });
    expect(result?.kcal).toBe(250);
    expect(result?.proteinG).toBe(12.5);
    expect(result?.fatG).toBe(0);
  });

  it('drops negative values', () => {
    const result = normalizeNutritionPer100g({ kcal: -10, carbsG: 30 });
    expect(result?.kcal).toBeUndefined();
    expect(result?.carbsG).toBe(30);
  });

  it('drops NaN and Infinity', () => {
    const result = normalizeNutritionPer100g({ kcal: NaN, proteinG: Infinity, fatG: 5 });
    expect(result?.kcal).toBeUndefined();
    expect(result?.proteinG).toBeUndefined();
    expect(result?.fatG).toBe(5);
  });

  it('drops non-numeric strings, coerces numeric strings', () => {
    const result = normalizeNutritionPer100g({ kcal: 'high', proteinG: '15' });
    expect(result?.kcal).toBeUndefined();
    expect(result?.proteinG).toBe(15);
  });

  it('normalizes all 17 nutrient fields from a complete object', () => {
    const input = {
      kcal: 200, proteinG: 10, carbsG: 25, sugarsG: 8, fatG: 6,
      saturatedFatG: 2, fiberG: 3, saltG: 0.5, sodiumMg: 200,
      calciumMg: 120, ironMg: 2, potassiumMg: 300, magnesiumMg: 40,
      zincMg: 1, vitaminCMg: 15, vitaminDMcg: 5, vitaminB12Mcg: 1.5,
    };
    const result = normalizeNutritionPer100g(input);
    expect(result?.kcal).toBe(200);
    expect(result?.vitaminB12Mcg).toBe(1.5);
    expect(result?.sodiumMg).toBe(200);
  });

  it('ignores unknown extra fields without throwing', () => {
    expect(() => normalizeNutritionPer100g({ kcal: 100, unknownField: 'x' })).not.toThrow();
  });
});

// ─── normalizeNutritionSource ─────────────────────────────────────────────────

describe('normalizeNutritionSource', () => {
  it('returns undefined for null/undefined/non-object inputs', () => {
    expect(normalizeNutritionSource(null)).toBeUndefined();
    expect(normalizeNutritionSource(undefined)).toBeUndefined();
    expect(normalizeNutritionSource('openfoodfacts')).toBeUndefined();
  });

  it('accepts all valid providers', () => {
    for (const p of ['openfoodfacts', 'usda', 'manual', 'unknown'] as const) {
      expect(normalizeNutritionSource({ provider: p })?.provider).toBe(p);
    }
  });

  it('coerces unknown provider to "unknown"', () => {
    expect(normalizeNutritionSource({ provider: 'myapi' })?.provider).toBe('unknown');
    expect(normalizeNutritionSource({ provider: null })?.provider).toBe('unknown');
    expect(normalizeNutritionSource({})?.provider).toBe('unknown');
  });

  it('preserves valid confidence in 0–1 range', () => {
    expect(normalizeNutritionSource({ provider: 'usda', confidence: 0.9 })?.confidence).toBe(0.9);
    expect(normalizeNutritionSource({ provider: 'usda', confidence: 0 })?.confidence).toBe(0);
    expect(normalizeNutritionSource({ provider: 'usda', confidence: 1 })?.confidence).toBe(1);
  });

  it('drops confidence outside 0–1 range', () => {
    expect(normalizeNutritionSource({ provider: 'usda', confidence: 1.5 })?.confidence).toBeUndefined();
    expect(normalizeNutritionSource({ provider: 'usda', confidence: -0.1 })?.confidence).toBeUndefined();
    expect(normalizeNutritionSource({ provider: 'usda', confidence: NaN })?.confidence).toBeUndefined();
  });

  it('preserves valid string fields', () => {
    const src = normalizeNutritionSource({
      provider: 'openfoodfacts',
      externalId: '1234',
      externalUrl: 'https://world.openfoodfacts.org/product/1234',
      fetchedAt: '2025-01-01T00:00:00.000Z',
    });
    expect(src?.externalId).toBe('1234');
    expect(src?.externalUrl).toContain('openfoodfacts');
    expect(src?.fetchedAt).toBe('2025-01-01T00:00:00.000Z');
  });
});

// ─── normalizeIngredientNutrition ─────────────────────────────────────────────

describe('normalizeIngredientNutrition', () => {
  it('returns undefined for null/undefined/non-object inputs', () => {
    expect(normalizeIngredientNutrition(null)).toBeUndefined();
    expect(normalizeIngredientNutrition(undefined)).toBeUndefined();
    expect(normalizeIngredientNutrition('pasta')).toBeUndefined();
  });

  it('returns undefined when ingredientName is missing or empty', () => {
    expect(normalizeIngredientNutrition({})).toBeUndefined();
    expect(normalizeIngredientNutrition({ ingredientName: '' })).toBeUndefined();
    expect(normalizeIngredientNutrition({ ingredientName: 42 })).toBeUndefined();
  });

  it('preserves a minimal valid entry with just ingredientName', () => {
    const result = normalizeIngredientNutrition({ ingredientName: 'pasta' });
    expect(result?.ingredientName).toBe('pasta');
    expect(result?.quantity).toBeUndefined();
    expect(result?.grams).toBeUndefined();
  });

  it('normalizes quantity and grams, drops negatives and NaN', () => {
    const good = normalizeIngredientNutrition({ ingredientName: 'chicken', quantity: 150, grams: 150 });
    expect(good?.quantity).toBe(150);
    expect(good?.grams).toBe(150);

    const bad = normalizeIngredientNutrition({ ingredientName: 'salt', quantity: -5, grams: NaN });
    expect(bad?.quantity).toBeUndefined();
    expect(bad?.grams).toBeUndefined();
  });

  it('recursively normalizes nested nutritionPer100g', () => {
    const result = normalizeIngredientNutrition({
      ingredientName: 'olive oil',
      nutritionPer100g: { kcal: 884, fatG: 100, proteinG: -1 },
    });
    expect(result?.nutritionPer100g?.kcal).toBe(884);
    expect(result?.nutritionPer100g?.fatG).toBe(100);
    expect(result?.nutritionPer100g?.proteinG).toBeUndefined();
  });

  it('recursively normalizes nested source with invalid provider', () => {
    const result = normalizeIngredientNutrition({
      ingredientName: 'tomato',
      source: { provider: 'badprovider', confidence: 0.95 },
    });
    expect(result?.source?.provider).toBe('unknown');
    expect(result?.source?.confidence).toBe(0.95);
  });

  it('preserves gramsEstimated: true', () => {
    const result = normalizeIngredientNutrition({ ingredientName: 'olio', grams: 10, gramsEstimated: true });
    expect(result?.gramsEstimated).toBe(true);
  });

  it('preserves gramsEstimated: false', () => {
    const result = normalizeIngredientNutrition({ ingredientName: 'pasta', grams: 200, gramsEstimated: false });
    expect(result?.gramsEstimated).toBe(false);
  });

  it('gramsEstimated is undefined when absent in stored data (backward compat)', () => {
    const result = normalizeIngredientNutrition({ ingredientName: 'pasta', grams: 200 });
    expect(result?.gramsEstimated).toBeUndefined();
  });

  it('drops non-boolean gramsEstimated values', () => {
    const result = normalizeIngredientNutrition({ ingredientName: 'pasta', gramsEstimated: 'yes' });
    expect(result?.gramsEstimated).toBeUndefined();
  });
});

// ─── normalizeIngredientNutritionArray ────────────────────────────────────────

describe('normalizeIngredientNutritionArray', () => {
  it('returns empty array for null/undefined/non-array inputs', () => {
    expect(normalizeIngredientNutritionArray(null)).toEqual([]);
    expect(normalizeIngredientNutritionArray(undefined)).toEqual([]);
    expect(normalizeIngredientNutritionArray('pasta')).toEqual([]);
    expect(normalizeIngredientNutritionArray({})).toEqual([]);
  });

  it('returns empty array for an empty array input', () => {
    expect(normalizeIngredientNutritionArray([])).toEqual([]);
  });

  it('filters out invalid entries and keeps valid ones', () => {
    const result = normalizeIngredientNutritionArray([
      { ingredientName: 'pasta', grams: 80 },
      null,
      { ingredientName: '' },
      42,
      { ingredientName: 'olive oil', grams: 15 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]?.ingredientName).toBe('pasta');
    expect(result[1]?.ingredientName).toBe('olive oil');
  });
});

// ─── normalizeRecipeNutrition ─────────────────────────────────────────────────

describe('normalizeRecipeNutrition', () => {
  it('returns { status: "missing" } for null/undefined/non-object inputs', () => {
    expect(normalizeRecipeNutrition(null)).toEqual({ status: 'missing' });
    expect(normalizeRecipeNutrition(undefined)).toEqual({ status: 'missing' });
    expect(normalizeRecipeNutrition('partial')).toEqual({ status: 'missing' });
  });

  it('returns { status: "missing" } for an empty object', () => {
    expect(normalizeRecipeNutrition({})).toEqual({ status: 'missing' });
  });

  it('accepts all valid status values', () => {
    for (const s of ['missing', 'partial', 'complete', 'manual'] as const) {
      expect(normalizeRecipeNutrition({ status: s }).status).toBe(s);
    }
  });

  it('coerces invalid status to "missing"', () => {
    expect(normalizeRecipeNutrition({ status: 'unknown' }).status).toBe('missing');
    expect(normalizeRecipeNutrition({ status: null }).status).toBe('missing');
    expect(normalizeRecipeNutrition({ status: 42 }).status).toBe('missing');
  });

  it('preserves valid servingsUsed and drops non-positive values', () => {
    expect(normalizeRecipeNutrition({ status: 'complete', servingsUsed: 4 }).servingsUsed).toBe(4);
    expect(normalizeRecipeNutrition({ status: 'complete', servingsUsed: 0 }).servingsUsed).toBeUndefined();
    expect(normalizeRecipeNutrition({ status: 'complete', servingsUsed: -1 }).servingsUsed).toBeUndefined();
    expect(normalizeRecipeNutrition({ status: 'complete', servingsUsed: NaN }).servingsUsed).toBeUndefined();
  });

  it('normalizes perServing recursively and drops negative fields', () => {
    const result = normalizeRecipeNutrition({
      status: 'complete',
      perServing: { kcal: 450, fatG: -2 },
    });
    expect(result.perServing?.kcal).toBe(450);
    expect(result.perServing?.fatG).toBeUndefined();
  });

  it('normalizes sources array and drops invalid entries', () => {
    const result = normalizeRecipeNutrition({
      status: 'partial',
      sources: [
        { provider: 'usda', confidence: 0.8 },
        null,
        { provider: 'badprovider' },
      ],
    });
    expect(result.sources).toHaveLength(2);
    expect(result.sources?.[0]?.provider).toBe('usda');
    expect(result.sources?.[1]?.provider).toBe('unknown');
  });

  it('sets sources to undefined when sources array is empty after filtering', () => {
    expect(normalizeRecipeNutrition({ status: 'partial', sources: [] }).sources).toBeUndefined();
  });

  it('preserves calculatedAt ISO string and drops non-string values', () => {
    const ts = '2025-06-01T12:00:00.000Z';
    expect(normalizeRecipeNutrition({ status: 'complete', calculatedAt: ts }).calculatedAt).toBe(ts);
    expect(normalizeRecipeNutrition({ status: 'complete', calculatedAt: 12345 }).calculatedAt).toBeUndefined();
  });
});

// ─── Integration: recipe round-trip through normalizeStoredRecipe ─────────────

const BASE = { id: 'nut-base', name: 'Test Recipe', ingredients: ['100 g pasta'], steps: ['Cook'] };

describe('recipe nutrition normalization via storage round-trip', () => {
  it('old recipe without nutrition fields gets default { status: "missing" } and []', () => {
    addRecipe({ ...BASE, id: 'nut-1' });
    const saved = loadRecipeBook().find(r => r.id === 'nut-1');
    expect(saved?.nutrition).toEqual({ status: 'missing' });
    expect(saved?.ingredientNutrition).toEqual([]);
  });

  it('recipe with valid complete nutrition is preserved', () => {
    addRecipe({
      ...BASE, id: 'nut-2',
      nutrition: {
        status: 'complete', servingsUsed: 2,
        perServing: { kcal: 300, proteinG: 12 },
        calculatedAt: '2025-01-01T00:00:00.000Z',
      },
    });
    const saved = loadRecipeBook().find(r => r.id === 'nut-2');
    expect(saved?.nutrition?.status).toBe('complete');
    expect(saved?.nutrition?.servingsUsed).toBe(2);
    expect(saved?.nutrition?.perServing?.kcal).toBe(300);
  });

  it('recipe with invalid nutrition status is normalized to "missing"', () => {
    addRecipe({ ...BASE, id: 'nut-3', nutrition: { status: 'bogus' } as never });
    const saved = loadRecipeBook().find(r => r.id === 'nut-3');
    expect(saved?.nutrition?.status).toBe('missing');
  });

  it('negative kcal value is dropped during normalization', () => {
    addRecipe({ ...BASE, id: 'nut-4', nutrition: { status: 'manual', perServing: { kcal: -200, carbsG: 50 } } });
    const saved = loadRecipeBook().find(r => r.id === 'nut-4');
    expect(saved?.nutrition?.perServing?.kcal).toBeUndefined();
    expect(saved?.nutrition?.perServing?.carbsG).toBe(50);
  });

  it('ingredientNutrition with mixed valid/invalid entries is filtered', () => {
    addRecipe({
      ...BASE, id: 'nut-5',
      ingredientNutrition: [
        { ingredientName: 'pasta', grams: 80, nutritionPer100g: { kcal: 350 } },
        { ingredientName: '' },
        null as never,
      ],
    });
    const saved = loadRecipeBook().find(r => r.id === 'nut-5');
    expect(saved?.ingredientNutrition).toHaveLength(1);
    expect(saved?.ingredientNutrition?.[0]?.ingredientName).toBe('pasta');
    expect(saved?.ingredientNutrition?.[0]?.nutritionPer100g?.kcal).toBe(350);
  });

  it('invalid provider in source is coerced to "unknown"', () => {
    addRecipe({
      ...BASE, id: 'nut-6',
      nutrition: { status: 'partial', sources: [{ provider: 'invalidprovider' } as never] },
    });
    const saved = loadRecipeBook().find(r => r.id === 'nut-6');
    expect(saved?.nutrition?.sources?.[0]?.provider).toBe('unknown');
  });
});

// ─── parseIngredientAmount ────────────────────────────────────────────────────

describe('parseIngredientAmount — dirty / edge inputs', () => {
  it('returns confidence 0.1 for empty string', () => {
    const r = parseIngredientAmount('');
    expect(r.confidence).toBe(0.1);
    expect(r.original).toBe('');
  });

  it('never throws on null or undefined coerced to string', () => {
    expect(() => parseIngredientAmount(null as never)).not.toThrow();
    expect(() => parseIngredientAmount(undefined as never)).not.toThrow();
  });

  it('handles extra whitespace gracefully', () => {
    const r = parseIngredientAmount('  200  g   riso  ');
    expect(r.quantity).toBe(200);
    expect(r.unit).toBe('g');
    expect(r.name).toBe('riso');
  });
});

describe('parseIngredientAmount — weight / volume (high confidence)', () => {
  it('"200 g riso" → qty=200, unit=g, grams=200, name=riso', () => {
    const r = parseIngredientAmount('200 g riso');
    expect(r.quantity).toBe(200);
    expect(r.unit).toBe('g');
    expect(r.grams).toBe(200);
    expect(r.name).toBe('riso');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"riso 200 g" → qty=200, unit=g, name=riso', () => {
    const r = parseIngredientAmount('riso 200 g');
    expect(r.quantity).toBe(200);
    expect(r.unit).toBe('g');
    expect(r.name).toBe('riso');
  });

  it('"200g riso" (compact, no space) → qty=200, unit=g', () => {
    const r = parseIngredientAmount('200g riso');
    expect(r.quantity).toBe(200);
    expect(r.unit).toBe('g');
    expect(r.grams).toBe(200);
  });

  it('"riso 200gr" (compact trailing, abbr unit) → qty=200, unit=g', () => {
    const r = parseIngredientAmount('riso 200gr');
    expect(r.quantity).toBe(200);
    expect(r.unit).toBe('g');
    expect(r.name).toBe('riso');
  });

  it('"250 ml latte" → qty=250, unit=ml', () => {
    const r = parseIngredientAmount('250 ml latte');
    expect(r.quantity).toBe(250);
    expect(r.unit).toBe('ml');
    expect(r.name).toBe('latte');
    expect(r.grams).toBeUndefined();
  });

  it('"latte 250 ml" → qty=250, unit=ml, name=latte', () => {
    const r = parseIngredientAmount('latte 250 ml');
    expect(r.quantity).toBe(250);
    expect(r.unit).toBe('ml');
    expect(r.name).toBe('latte');
  });

  it('"1,5 kg patate" (comma decimal) → qty=1.5, unit=kg, grams=1500', () => {
    const r = parseIngredientAmount('1,5 kg patate');
    expect(r.quantity).toBe(1.5);
    expect(r.unit).toBe('kg');
    expect(r.grams).toBe(1500);
    expect(r.name).toBe('patate');
  });

  it('"riso basmati 300 grammi" (full unit word) → unit=g', () => {
    const r = parseIngredientAmount('riso basmati 300 grammi');
    expect(r.unit).toBe('g');
    expect(r.quantity).toBe(300);
    expect(r.name).toBe('riso basmati');
  });

  it('normalizedName is lowercase', () => {
    const r = parseIngredientAmount('200 g Riso Basmati');
    expect(r.normalizedName).toBe('riso basmati');
    expect(r.name).toBe('Riso Basmati');
  });
});

describe('parseIngredientAmount — tbsp / tsp (medium confidence)', () => {
  it('"1 cucchiaio olio" → unit=tbsp, confidence~0.5', () => {
    const r = parseIngredientAmount('1 cucchiaio olio');
    expect(r.quantity).toBe(1);
    expect(r.unit).toBe('tbsp');
    expect(r.name).toBe('olio');
    expect(r.confidence).toBeCloseTo(0.5);
  });

  it('"olio 1 cucchiaio" (trailing) → unit=tbsp', () => {
    const r = parseIngredientAmount('olio 1 cucchiaio');
    expect(r.unit).toBe('tbsp');
    expect(r.name).toBe('olio');
  });

  it('"2 cucchiaini zucchero" → unit=tsp', () => {
    const r = parseIngredientAmount('2 cucchiaini zucchero');
    expect(r.unit).toBe('tsp');
    expect(r.quantity).toBe(2);
    expect(r.name).toBe('zucchero');
  });
});

describe('parseIngredientAmount — piece / pinch / countable', () => {
  it('"2 uova" → qty=2, unit=piece, name=uova', () => {
    const r = parseIngredientAmount('2 uova');
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe('piece');
    expect(r.name).toBe('uova');
    expect(r.confidence).toBeGreaterThanOrEqual(0.4);
  });

  it('"1 pizzico sale" → qty=1, unit=pinch, name=sale', () => {
    const r = parseIngredientAmount('1 pizzico sale');
    expect(r.quantity).toBe(1);
    expect(r.unit).toBe('pinch');
    expect(r.name).toBe('sale');
  });

  it('"mezza cipolla" → qty=0.5, unit=piece, name=cipolla', () => {
    const r = parseIngredientAmount('mezza cipolla');
    expect(r.quantity).toBe(0.5);
    expect(r.unit).toBe('piece');
    expect(r.name).toBe('cipolla');
  });

  it('"1/2 cipolla" → qty=0.5, name=cipolla', () => {
    const r = parseIngredientAmount('1/2 cipolla');
    expect(r.quantity).toBe(0.5);
    expect(r.name).toBe('cipolla');
  });
});

describe('parseIngredientAmount — q.b. and no-quantity (low confidence)', () => {
  it('"sale q.b." → confidence=0.1, name=sale, no quantity', () => {
    const r = parseIngredientAmount('sale q.b.');
    expect(r.confidence).toBe(0.1);
    expect(r.name).toBe('sale');
    expect(r.quantity).toBeUndefined();
  });

  it('"q.b. sale" → confidence=0.1, name=sale', () => {
    const r = parseIngredientAmount('q.b. sale');
    expect(r.confidence).toBe(0.1);
    expect(r.name).toBe('sale');
  });

  it('"olio extravergine di oliva" (no quantity) → name preserved, confidence=0.1', () => {
    const r = parseIngredientAmount('olio extravergine di oliva');
    expect(r.confidence).toBe(0.1);
    expect(r.name).toBe('olio extravergine di oliva');
    expect(r.quantity).toBeUndefined();
  });
});

describe('parseIngredientAmount — grams field', () => {
  it('g input sets grams equal to quantity', () => {
    expect(parseIngredientAmount('150 g carne').grams).toBe(150);
  });

  it('kg input sets grams = quantity * 1000', () => {
    expect(parseIngredientAmount('1 kg patate').grams).toBe(1000);
  });

  it('ml input leaves grams undefined', () => {
    expect(parseIngredientAmount('200 ml latte').grams).toBeUndefined();
  });

  it('tbsp input leaves grams undefined', () => {
    expect(parseIngredientAmount('1 cucchiaio olio').grams).toBeUndefined();
  });
});

// ─── parseServings ────────────────────────────────────────────────────────────

describe('parseServings', () => {
  it('handles number input', () => {
    expect(parseServings(4)).toBe(4);
    expect(parseServings(2.5)).toBe(2.5);
    expect(parseServings(0)).toBeUndefined();
    expect(parseServings(-1)).toBeUndefined();
  });

  it('parses clean numeric strings', () => {
    expect(parseServings('4')).toBe(4);
    expect(parseServings('2.5')).toBe(2.5);
    expect(parseServings('1,5')).toBe(1.5);
  });

  it('strips non-numeric suffix from strings', () => {
    expect(parseServings('4 persone')).toBe(4);
    expect(parseServings('6 porzioni')).toBe(6);
    expect(parseServings('2 persone')).toBe(2);
  });

  it('returns undefined for non-parseable or empty strings', () => {
    expect(parseServings('many')).toBeUndefined();
    expect(parseServings('')).toBeUndefined();
    expect(parseServings(undefined)).toBeUndefined();
  });
});

// ─── scaleNutritionBlock ──────────────────────────────────────────────────────

describe('scaleNutritionBlock', () => {
  it('scales all defined fields by factor', () => {
    const result = scaleNutritionBlock({ kcal: 350, proteinG: 12, fatG: 3 }, 0.5);
    expect(result.kcal).toBeCloseTo(175);
    expect(result.proteinG).toBeCloseTo(6);
    expect(result.fatG).toBeCloseTo(1.5);
  });

  it('leaves undefined fields absent in result', () => {
    const result = scaleNutritionBlock({ kcal: 100 }, 2);
    expect(result.kcal).toBeCloseTo(200);
    expect(result.proteinG).toBeUndefined();
    expect(result.carbsG).toBeUndefined();
  });

  it('returns empty object for empty input', () => {
    const result = scaleNutritionBlock({}, 10);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ─── addNutritionBlocks ───────────────────────────────────────────────────────

describe('addNutritionBlocks', () => {
  it('adds two blocks field by field', () => {
    const result = addNutritionBlocks({ kcal: 100, proteinG: 10 }, { kcal: 200, fatG: 5 });
    expect(result.kcal).toBeCloseTo(300);
    expect(result.proteinG).toBeCloseTo(10);
    expect(result.fatG).toBeCloseTo(5);
  });

  it('treats missing field in second block as zero contribution', () => {
    const result = addNutritionBlocks({ kcal: 50 }, { kcal: 50, carbsG: 20 });
    expect(result.kcal).toBeCloseTo(100);
    expect(result.carbsG).toBeCloseTo(20);
  });

  it('returns copy of first block when second block is empty', () => {
    const result = addNutritionBlocks({ kcal: 400, fatG: 10 }, {});
    expect(result.kcal).toBeCloseTo(400);
    expect(result.fatG).toBeCloseTo(10);
  });
});

// ─── calculateRecipeNutrition ─────────────────────────────────────────────────

describe('calculateRecipeNutrition', () => {
  it('returns missing when ingredientNutrition is empty', () => {
    const result = calculateRecipeNutrition({ ingredients: ['100 g pasta'], ingredientNutrition: [] });
    expect(result.status).toBe('missing');
    expect(result.perRecipe).toBeUndefined();
  });

  it('returns missing when no entry has valid grams', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['pasta'],
      ingredientNutrition: [{ ingredientName: 'pasta', nutritionPer100g: { kcal: 350 } }],
    });
    expect(result.status).toBe('missing');
  });

  it('returns missing when grams is zero', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['pasta'],
      ingredientNutrition: [{ ingredientName: 'pasta', grams: 0, nutritionPer100g: { kcal: 350 } }],
    });
    expect(result.status).toBe('missing');
  });

  it('returns missing when nutritionPer100g is absent', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['olio'],
      ingredientNutrition: [{ ingredientName: 'olio', grams: 15 }],
    });
    expect(result.status).toBe('missing');
  });

  it('computes perRecipe for a single ingredient', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta'],
      ingredientNutrition: [{
        ingredientName: 'pasta', grams: 100,
        nutritionPer100g: { kcal: 350, proteinG: 12 },
      }],
    });
    expect(result.status).toBe('complete');
    expect(result.perRecipe?.kcal).toBeCloseTo(350);
    expect(result.perRecipe?.proteinG).toBeCloseTo(12);
  });

  it('scales grams correctly — 50 g of 350 kcal/100g ingredient = 175 kcal', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['50 g formaggio'],
      ingredientNutrition: [{
        ingredientName: 'formaggio', grams: 50,
        nutritionPer100g: { kcal: 400, proteinG: 25 },
      }],
    });
    expect(result.perRecipe?.kcal).toBeCloseTo(200);
    expect(result.perRecipe?.proteinG).toBeCloseTo(12.5);
  });

  it('sums contributions from multiple ingredients', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta', '50 g formaggio'],
      ingredientNutrition: [
        { ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350, proteinG: 12 } },
        { ingredientName: 'formaggio', grams: 50, nutritionPer100g: { kcal: 400, proteinG: 25 } },
      ],
    });
    expect(result.perRecipe?.kcal).toBeCloseTo(550);   // 350 + 200
    expect(result.perRecipe?.proteinG).toBeCloseTo(24.5); // 12 + 12.5
    expect(result.status).toBe('complete');
  });

  it('computes perServing when numeric servings provided', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta'],
      ingredientNutrition: [{ ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350 } }],
      servings: 2,
    });
    expect(result.servingsUsed).toBe(2);
    expect(result.perServing?.kcal).toBeCloseTo(175);
  });

  it('parses servings from dirty string', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta'],
      ingredientNutrition: [{ ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350 } }],
      servings: '4 persone',
    });
    expect(result.servingsUsed).toBe(4);
    expect(result.perServing?.kcal).toBeCloseTo(87.5);
  });

  it('leaves perServing undefined when servings not parseable', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta'],
      ingredientNutrition: [{ ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350 } }],
      servings: 'molte',
    });
    expect(result.perServing).toBeUndefined();
    expect(result.servingsUsed).toBeUndefined();
  });

  it('marks status as partial when not all ingredients have usable nutrition', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta', '2 uova', 'sale q.b.'],
      ingredientNutrition: [{
        ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350 },
      }],
    });
    expect(result.status).toBe('partial');
  });

  it('marks status as complete when all ingredients covered', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta', '50 g formaggio'],
      ingredientNutrition: [
        { ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350 } },
        { ingredientName: 'formaggio', grams: 50, nutritionPer100g: { kcal: 400 } },
      ],
    });
    expect(result.status).toBe('complete');
  });

  it('includes micronutrients in totals', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['200 g spinaci'],
      ingredientNutrition: [{
        ingredientName: 'spinaci', grams: 200,
        nutritionPer100g: { kcal: 23, ironMg: 2.7, vitaminCMg: 28 },
      }],
    });
    expect(result.perRecipe?.ironMg).toBeCloseTo(5.4);
    expect(result.perRecipe?.vitaminCMg).toBeCloseTo(56);
  });

  it('skips entries without nutritionPer100g, treating them as partial', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['pasta', 'olio'],
      ingredientNutrition: [
        { ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350 } },
        { ingredientName: 'olio', grams: 15 },
      ],
    });
    expect(result.status).toBe('partial');
    expect(result.perRecipe?.kcal).toBeCloseTo(350);
  });

  it('sets calculatedAt to a current ISO timestamp', () => {
    const before = new Date().toISOString();
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta'],
      ingredientNutrition: [{ ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350 } }],
    });
    const after = new Date().toISOString();
    expect(result.calculatedAt).toBeDefined();
    expect(result.calculatedAt! >= before).toBe(true);
    expect(result.calculatedAt! <= after).toBe(true);
  });

  it('collects sources from ingredientNutrition entries', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta', '50 g olio'],
      ingredientNutrition: [
        {
          ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350 },
          source: { provider: 'usda', externalId: 'pasta-123' },
        },
        {
          ingredientName: 'olio', grams: 50, nutritionPer100g: { kcal: 884 },
          source: { provider: 'openfoodfacts' },
        },
      ],
    });
    expect(result.sources).toHaveLength(2);
    expect(result.sources?.[0]?.provider).toBe('usda');
    expect(result.sources?.[1]?.provider).toBe('openfoodfacts');
  });

  it('sets sources to undefined when no ingredientNutrition has a source', () => {
    const result = calculateRecipeNutrition({
      ingredients: ['100 g pasta'],
      ingredientNutrition: [{ ingredientName: 'pasta', grams: 100, nutritionPer100g: { kcal: 350 } }],
    });
    expect(result.sources).toBeUndefined();
  });
});
