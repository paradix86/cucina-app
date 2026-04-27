import { describe, it, expect } from 'vitest';
import { parseGramsInput, applyGramsOverrides } from '../../src/lib/nutritionOverride';
import type { IngredientNutrition } from '../../src/types';

// ─── parseGramsInput ──────────────────────────────────────────────────────────

describe('parseGramsInput', () => {
  it('parses an integer string', () => {
    expect(parseGramsInput('100')).toBe(100);
  });

  it('parses a decimal with dot', () => {
    expect(parseGramsInput('10.5')).toBe(10.5);
  });

  it('parses a decimal with comma (locale-style)', () => {
    expect(parseGramsInput('10,5')).toBe(10.5);
  });

  it('trims whitespace before parsing', () => {
    expect(parseGramsInput('  50  ')).toBe(50);
  });

  it('returns undefined for empty string', () => {
    expect(parseGramsInput('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(parseGramsInput('   ')).toBeUndefined();
  });

  it('returns undefined for zero', () => {
    expect(parseGramsInput('0')).toBeUndefined();
  });

  it('returns undefined for negative values', () => {
    expect(parseGramsInput('-10')).toBeUndefined();
    expect(parseGramsInput('-0.5')).toBeUndefined();
  });

  it('returns undefined for non-numeric text', () => {
    expect(parseGramsInput('abc')).toBeUndefined();
    expect(parseGramsInput('g')).toBeUndefined();
  });

  it('returns undefined for Infinity', () => {
    expect(parseGramsInput('Infinity')).toBeUndefined();
  });
});

// ─── applyGramsOverrides ──────────────────────────────────────────────────────

function makeIng(
  ingredientName: string,
  grams: number | undefined,
  proteinG = 10,
  carbsG = 20,
  fatG = 5,
): IngredientNutrition {
  return {
    ingredientName,
    grams,
    gramsEstimated: grams !== undefined ? true : undefined,
    source: { provider: 'openfoodfacts' as const },
    nutritionPer100g: { kcal: 200, proteinG, carbsG, fatG, fiberG: 2 },
  };
}

describe('applyGramsOverrides', () => {
  it('does not mutate the input array', () => {
    const original = [makeIng('pasta', 80)];
    const originalGrams = original[0].grams;
    applyGramsOverrides({
      ingredientNutrition: original,
      overrides: { pasta: 100 },
      ingredients: ['80g pasta'],
    });
    expect(original[0].grams).toBe(originalGrams);
  });

  it('updates grams for overridden ingredient', () => {
    const { ingredientNutrition } = applyGramsOverrides({
      ingredientNutrition: [makeIng('pasta', 80)],
      overrides: { pasta: 100 },
      ingredients: ['80g pasta'],
    });
    expect(ingredientNutrition[0].grams).toBe(100);
  });

  it('sets gramsEstimated to false for edited ingredients', () => {
    const { ingredientNutrition } = applyGramsOverrides({
      ingredientNutrition: [makeIng('pasta', 80)],
      overrides: { pasta: 100 },
      ingredients: ['80g pasta'],
    });
    expect(ingredientNutrition[0].gramsEstimated).toBe(false);
  });

  it('sets source.provider to manual for edited ingredients', () => {
    const { ingredientNutrition } = applyGramsOverrides({
      ingredientNutrition: [makeIng('pasta', 80)],
      overrides: { pasta: 100 },
      ingredients: ['80g pasta'],
    });
    expect(ingredientNutrition[0].source?.provider).toBe('manual');
  });

  it('leaves non-overridden ingredients unchanged', () => {
    const { ingredientNutrition } = applyGramsOverrides({
      ingredientNutrition: [makeIng('pasta', 80), makeIng('pomodoro', 50)],
      overrides: { pasta: 100 },
      ingredients: ['80g pasta', '50g pomodoro'],
    });
    expect(ingredientNutrition[1].grams).toBe(50);
    expect(ingredientNutrition[1].source?.provider).toBe('openfoodfacts');
  });

  it('preserves nutritionPer100g for overridden ingredient', () => {
    const ing = makeIng('pasta', 80, 12, 70, 1);
    const { ingredientNutrition } = applyGramsOverrides({
      ingredientNutrition: [ing],
      overrides: { pasta: 100 },
      ingredients: ['80g pasta'],
    });
    expect(ingredientNutrition[0].nutritionPer100g?.proteinG).toBe(12);
    expect(ingredientNutrition[0].nutritionPer100g?.carbsG).toBe(70);
  });

  it('returns nutrition with status manual', () => {
    const { nutrition } = applyGramsOverrides({
      ingredientNutrition: [makeIng('pasta', 80)],
      overrides: { pasta: 100 },
      ingredients: ['80g pasta'],
    });
    expect(nutrition.status).toBe('manual');
  });

  it('recalculates perRecipe based on new grams', () => {
    // pasta: 100g per100g => protein=10, carbs=20, fat=5
    // at 100g: protein=10g, at 80g: protein=8g
    const ing = makeIng('pasta', 80, 10, 20, 5);
    const { nutrition: before } = applyGramsOverrides({
      ingredientNutrition: [ing],
      overrides: {},
      ingredients: ['80g pasta'],
    });
    const { nutrition: after } = applyGramsOverrides({
      ingredientNutrition: [ing],
      overrides: { pasta: 160 },
      ingredients: ['80g pasta'],
    });
    const proteinBefore = before.perRecipe?.proteinG ?? 0;
    const proteinAfter  = after.perRecipe?.proteinG  ?? 0;
    expect(proteinAfter).toBeCloseTo(proteinBefore * 2, 5);
  });

  it('accepts undefined gram override (clears grams)', () => {
    const { ingredientNutrition } = applyGramsOverrides({
      ingredientNutrition: [makeIng('pasta', 80)],
      overrides: { pasta: undefined },
      ingredients: ['80g pasta'],
    });
    expect(ingredientNutrition[0].grams).toBeUndefined();
    expect(ingredientNutrition[0].gramsEstimated).toBeUndefined();
  });
});
