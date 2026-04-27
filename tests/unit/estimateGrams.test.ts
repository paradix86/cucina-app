import { describe, it, expect } from 'vitest';
import { estimateGrams } from '../../src/lib/nutrition';
import type { ParsedIngredientAmount } from '../../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function make(overrides: Partial<ParsedIngredientAmount> = {}): ParsedIngredientAmount {
  return {
    original: '1 cucchiaio olio',
    name: 'olio',
    normalizedName: 'olio',
    quantity: 1,
    unit: 'tbsp',
    grams: undefined,
    confidence: 0.5,
    ...overrides,
  };
}

// ─── Pass-through for existing grams ─────────────────────────────────────────

describe('estimateGrams — existing grams pass-through', () => {
  it('returns existing grams unchanged when already set', () => {
    expect(estimateGrams(make({ grams: 200 }))).toBe(200);
  });

  it('returns existing grams even when a unit override exists', () => {
    expect(estimateGrams(make({ unit: 'tbsp', grams: 99, normalizedName: 'olio' }))).toBe(99);
  });

  it('returns 0 grams unchanged (not treated as absent)', () => {
    expect(estimateGrams(make({ grams: 0 }))).toBe(0);
  });
});

// ─── tbsp conversions ─────────────────────────────────────────────────────────

describe('estimateGrams — tbsp', () => {
  it('1 tbsp olio → 10g (ingredient override)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'tbsp', normalizedName: 'olio' }))).toBe(10);
  });

  it('2 tbsp olio → 20g', () => {
    expect(estimateGrams(make({ quantity: 2, unit: 'tbsp', normalizedName: 'olio' }))).toBe(20);
  });

  it('1 tbsp zucchero → 12g (ingredient override)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'tbsp', normalizedName: 'zucchero' }))).toBe(12);
  });

  it('1 tbsp farina → 8g (ingredient override)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'tbsp', normalizedName: 'farina' }))).toBe(8);
  });

  it('1 tbsp unknown ingredient → 10g (unit default)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'tbsp', normalizedName: 'origano' }))).toBe(10);
  });

  it('3 tbsp unknown → 30g', () => {
    expect(estimateGrams(make({ quantity: 3, unit: 'tbsp', normalizedName: 'prezzemolo' }))).toBe(30);
  });
});

// ─── tsp conversions ──────────────────────────────────────────────────────────

describe('estimateGrams — tsp', () => {
  it('1 tsp zucchero → 4g (ingredient override)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'tsp', normalizedName: 'zucchero' }))).toBe(4);
  });

  it('1 tsp sale → 5g (ingredient override)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'tsp', normalizedName: 'sale' }))).toBe(5);
  });

  it('1 tsp unknown → 5g (unit default)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'tsp', normalizedName: 'vaniglia' }))).toBe(5);
  });

  it('2 tsp sale → 10g', () => {
    expect(estimateGrams(make({ quantity: 2, unit: 'tsp', normalizedName: 'sale' }))).toBe(10);
  });
});

// ─── piece conversions ────────────────────────────────────────────────────────

describe('estimateGrams — piece', () => {
  it('1 uovo → 60g', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'piece', normalizedName: 'uovo' }))).toBe(60);
  });

  it('2 uova → 120g', () => {
    expect(estimateGrams(make({ quantity: 2, unit: 'piece', normalizedName: 'uova' }))).toBe(120);
  });

  it('1 cipolla → 100g', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'piece', normalizedName: 'cipolla' }))).toBe(100);
  });

  it('unknown piece ingredient → undefined (no default for piece)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'piece', normalizedName: 'pomodoro' }))).toBeUndefined();
  });
});

// ─── pinch conversions ────────────────────────────────────────────────────────

describe('estimateGrams — pinch', () => {
  it('1 pinch → 1g (default)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'pinch', normalizedName: 'sale' }))).toBe(1);
  });

  it('2 pinch → 2g', () => {
    expect(estimateGrams(make({ quantity: 2, unit: 'pinch', normalizedName: 'pepe' }))).toBe(2);
  });
});

// ─── Unknown / unhandled units ────────────────────────────────────────────────

describe('estimateGrams — unknown unit', () => {
  it('returns undefined for unit not in table', () => {
    expect(estimateGrams(make({ unit: 'cup', normalizedName: 'riso' }))).toBeUndefined();
  });

  it('returns undefined when unit is undefined', () => {
    expect(estimateGrams(make({ unit: undefined, quantity: 100 }))).toBeUndefined();
  });

  it('returns undefined for weight unit "g" not in table (grams already set by parser)', () => {
    // parser sets grams directly for g/kg; if somehow grams is absent, we don't convert
    expect(estimateGrams(make({ unit: 'g', grams: undefined, quantity: 200 }))).toBeUndefined();
  });
});

// ─── Low confidence ───────────────────────────────────────────────────────────

describe('estimateGrams — low confidence', () => {
  it('returns undefined when confidence < 0.3', () => {
    expect(estimateGrams(make({ confidence: 0.1, unit: 'tbsp' }))).toBeUndefined();
  });

  it('returns undefined at exactly 0.2 confidence', () => {
    expect(estimateGrams(make({ confidence: 0.2, unit: 'pinch' }))).toBeUndefined();
  });

  it('returns value when confidence is exactly 0.3', () => {
    expect(estimateGrams(make({ confidence: 0.3, unit: 'pinch', quantity: 1 }))).toBe(1);
  });

  it('returns value when confidence is 0.5', () => {
    expect(estimateGrams(make({ confidence: 0.5, unit: 'tbsp', quantity: 1, normalizedName: 'olio' }))).toBe(10);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('estimateGrams — edge cases', () => {
  it('returns undefined when quantity is 0', () => {
    expect(estimateGrams(make({ quantity: 0, unit: 'tbsp' }))).toBeUndefined();
  });

  it('returns undefined when quantity is undefined', () => {
    expect(estimateGrams(make({ quantity: undefined, unit: 'tbsp' }))).toBeUndefined();
  });

  it('uses normalizedName for override lookup (case already lowercase)', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'tsp', normalizedName: 'zucchero', name: 'Zucchero' }))).toBe(4);
  });

  it('falls back to name when normalizedName is absent', () => {
    expect(estimateGrams(make({ quantity: 1, unit: 'piece', normalizedName: undefined, name: 'uova' }))).toBe(60);
  });

  it('handles fractional quantities correctly', () => {
    expect(estimateGrams(make({ quantity: 0.5, unit: 'tbsp', normalizedName: 'farina' }))).toBe(4);
  });
});
