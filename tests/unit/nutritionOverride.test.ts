import { describe, it, expect } from 'vitest';
import {
  parseGramsInput,
  parseNutrientInput,
  applyGramsOverrides,
  applyNutritionOverrides,
} from '../../src/lib/nutritionOverride';
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

// ─── parseNutrientInput ───────────────────────────────────────────────────────

describe('parseNutrientInput', () => {
  it('parses integer', () => {
    expect(parseNutrientInput('350')).toBe(350);
  });

  it('parses decimal with dot', () => {
    expect(parseNutrientInput('1.5')).toBe(1.5);
  });

  it('parses decimal with comma', () => {
    expect(parseNutrientInput('10,5')).toBe(10.5);
  });

  it('allows zero (unlike parseGramsInput)', () => {
    expect(parseNutrientInput('0')).toBe(0);
  });

  it('returns undefined for empty string', () => {
    expect(parseNutrientInput('')).toBeUndefined();
  });

  it('returns undefined for negative values', () => {
    expect(parseNutrientInput('-1')).toBeUndefined();
  });

  it('returns undefined for non-numeric text', () => {
    expect(parseNutrientInput('abc')).toBeUndefined();
  });

  it('returns undefined for Infinity', () => {
    expect(parseNutrientInput('Infinity')).toBeUndefined();
  });
});

// ─── applyNutritionOverrides ──────────────────────────────────────────────────

function makeIngNoNutrition(ingredientName: string): IngredientNutrition {
  return { ingredientName, grams: undefined, source: { provider: 'openfoodfacts' as const } };
}

describe('applyNutritionOverrides — per-100g patch', () => {
  it('updates nutritionPer100g fields from per100g patch', () => {
    const ing = makeIng('pasta', 200, 10, 70, 1);
    const { ingredientNutrition } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  {},
      per100gOverrides: { pasta: { proteinG: 15 } },
      ingredients: ['200g pasta'],
    });
    expect(ingredientNutrition[0].nutritionPer100g?.proteinG).toBe(15);
    // other fields preserved
    expect(ingredientNutrition[0].nutritionPer100g?.carbsG).toBe(70);
    expect(ingredientNutrition[0].nutritionPer100g?.fatG).toBe(1);
  });

  it('sets source.provider to manual when per100g patched', () => {
    const ing = makeIng('pasta', 200);
    const { ingredientNutrition } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  {},
      per100gOverrides: { pasta: { kcal: 360 } },
      ingredients: ['200g pasta'],
    });
    expect(ingredientNutrition[0].source?.provider).toBe('manual');
  });

  it('kcal recalculates proportionally after per100g patch', () => {
    // pasta 200g, original kcal 350/100g → 700 kcal total
    const ing = makeIng('pasta', 200);
    (ing.nutritionPer100g as any).kcal = 350;
    const { nutrition: before } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  {},
      per100gOverrides: {},
      ingredients: ['200g pasta'],
    });
    // Change to 700 kcal/100g → should double
    const { nutrition: after } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  {},
      per100gOverrides: { pasta: { kcal: 700 } },
      ingredients: ['200g pasta'],
    });
    const kcalBefore = before.perRecipe?.kcal ?? 0;
    const kcalAfter  = after.perRecipe?.kcal  ?? 0;
    expect(kcalAfter).toBeCloseTo(kcalBefore * 2, 1);
  });

  it('clearing a per100g field removes its contribution', () => {
    const ing = makeIng('pasta', 200, 10, 70, 5);
    const { nutrition: withProtein } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  {},
      per100gOverrides: {},
      ingredients: ['200g pasta'],
    });
    const { nutrition: withoutProtein } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  {},
      per100gOverrides: { pasta: { proteinG: undefined } },
      ingredients: ['200g pasta'],
    });
    const pBefore = withProtein.perRecipe?.proteinG ?? 0;
    const pAfter  = withoutProtein.perRecipe?.proteinG ?? 0;
    expect(pBefore).toBeGreaterThan(0);
    expect(pAfter).toBe(0);
  });

  it('creates nutritionPer100g when ingredient had none', () => {
    const ing = makeIngNoNutrition('sale');
    ing.grams = 5;
    const { ingredientNutrition } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  {},
      per100gOverrides: { sale: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 } },
      ingredients: ['sale q.b.'],
    });
    expect(ingredientNutrition[0].nutritionPer100g).toBeDefined();
    expect(ingredientNutrition[0].nutritionPer100g?.kcal).toBe(0);
  });

  it('does not mutate the input ingredientNutrition', () => {
    const original = [makeIng('pasta', 200)];
    const originalProtein = original[0].nutritionPer100g?.proteinG;
    applyNutritionOverrides({
      ingredientNutrition: original,
      gramsOverrides:  {},
      per100gOverrides: { pasta: { proteinG: 99 } },
      ingredients: ['200g pasta'],
    });
    expect(original[0].nutritionPer100g?.proteinG).toBe(originalProtein);
  });

  it('leaves unpatched ingredients unchanged', () => {
    const ings = [makeIng('pasta', 200), makeIng('pomodoro', 100)];
    const { ingredientNutrition } = applyNutritionOverrides({
      ingredientNutrition: ings,
      gramsOverrides:  {},
      per100gOverrides: { pasta: { kcal: 999 } },
      ingredients: ['200g pasta', '100g pomodoro'],
    });
    expect(ingredientNutrition[1].source?.provider).toBe('openfoodfacts');
    expect(ingredientNutrition[1].nutritionPer100g?.proteinG).toBe(10);
  });

  it('returns status manual', () => {
    const { nutrition } = applyNutritionOverrides({
      ingredientNutrition: [makeIng('pasta', 200)],
      gramsOverrides:  {},
      per100gOverrides: { pasta: { kcal: 350 } },
      ingredients: ['200g pasta'],
    });
    expect(nutrition.status).toBe('manual');
  });

  it('combined grams + per100g patch recalculates correctly', () => {
    // 200g pasta @ 350kcal/100g = 700 kcal.  Change to 100g + 700kcal/100g → still 700 kcal.
    const ing = makeIng('pasta', 200);
    (ing.nutritionPer100g as any).kcal = 350;
    const { nutrition } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  { pasta: 100 },
      per100gOverrides: { pasta: { kcal: 700 } },
      ingredients: ['200g pasta'],
    });
    expect(nutrition.perRecipe?.kcal).toBeCloseTo(700, 1);
  });

  it('partial edit: only edited per100g field changes; others preserved and recalculate', () => {
    const ing = makeIng('pasta', 100, 13, 70, 1);
    const { ingredientNutrition } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  {},
      per100gOverrides: { pasta: { proteinG: 20 } },
      ingredients: ['100g pasta'],
    });
    expect(ingredientNutrition[0].nutritionPer100g?.proteinG).toBe(20);
    expect(ingredientNutrition[0].nutritionPer100g?.carbsG).toBe(70);
    expect(ingredientNutrition[0].nutritionPer100g?.fatG).toBe(1);
  });

  it('sets source.userEdited=true on overridden ingredients', () => {
    const ing = makeIng('pasta', 200);
    const { ingredientNutrition } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  { pasta: 100 },
      per100gOverrides: {},
      ingredients: ['200g pasta'],
    });
    expect(ingredientNutrition[0].source?.userEdited).toBe(true);
  });

  it('does not set source.userEdited on untouched ingredients', () => {
    const ings = [makeIng('pasta', 200), makeIng('riso', 100)];
    const { ingredientNutrition } = applyNutritionOverrides({
      ingredientNutrition: ings,
      gramsOverrides:  { pasta: 150 },
      per100gOverrides: {},
      ingredients: ['200g pasta', '100g riso'],
    });
    expect(ingredientNutrition[0].source?.userEdited).toBe(true);  // pasta was overridden
    expect(ingredientNutrition[1].source?.userEdited).toBeUndefined();  // riso was not
  });
});

// ─── manual grams / per100g coverage ─────────────────────────────────────────

describe('manual override coverage', () => {
  it('manual grams + existing per100g increases recipe total when grams double', () => {
    // olio: 880 kcal/100g — doubling grams from 10 to 20 doubles kcal contribution
    const ing: IngredientNutrition = {
      ingredientName: '1 cucchiaio olio',
      grams: 10,
      gramsEstimated: true,
      source: { provider: 'openfoodfacts' },
      nutritionPer100g: { kcal: 880, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0 },
    };

    const { nutrition: before } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  {},
      per100gOverrides: {},
      ingredients: ['1 cucchiaio olio'],
    });
    const { nutrition: after } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  { '1 cucchiaio olio': 20 },
      per100gOverrides: {},
      ingredients: ['1 cucchiaio olio'],
    });

    expect(after.perRecipe?.kcal).toBeCloseTo((before.perRecipe?.kcal ?? 0) * 2, 1);
  });

  it('creates a new entry for an unmatched ingredient when both grams and per100g are supplied', () => {
    const { ingredientNutrition, nutrition } = applyNutritionOverrides({
      ingredientNutrition: [],
      gramsOverrides:  { 'olio evo': 10 },
      per100gOverrides: { 'olio evo': { kcal: 884, fatG: 100, proteinG: 0, carbsG: 0, fiberG: 0 } },
      ingredients: ['olio evo'],
    });

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].ingredientName).toBe('olio evo');
    expect(ingredientNutrition[0].grams).toBe(10);
    expect(ingredientNutrition[0].gramsEstimated).toBe(false);
    expect(ingredientNutrition[0].source.provider).toBe('manual');
    expect(ingredientNutrition[0].nutritionPer100g?.kcal).toBe(884);
    expect(nutrition.status).toBe('manual');
    expect((nutrition.perRecipe?.kcal ?? 0)).toBeGreaterThan(0);
  });

  it('creates a new entry for an unmatched ingredient with grams only (still missing nutrition)', () => {
    const { ingredientNutrition, nutrition } = applyNutritionOverrides({
      ingredientNutrition: [],
      gramsOverrides:  { 'sale q.b.': 5 },
      per100gOverrides: {},
      ingredients: ['sale q.b.'],
    });

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].grams).toBe(5);
    expect(ingredientNutrition[0].nutritionPer100g).toBeUndefined();
    // No per100g → contributes zero kcal
    expect(nutrition.perRecipe?.kcal ?? 0).toBe(0);
  });

  it('creates a new entry for an unmatched ingredient with per100g only (still missing grams)', () => {
    const { ingredientNutrition } = applyNutritionOverrides({
      ingredientNutrition: [],
      gramsOverrides:  {},
      per100gOverrides: { 'olio evo': { kcal: 884, fatG: 100, proteinG: 0, carbsG: 0, fiberG: 0 } },
      ingredients: ['olio evo'],
    });

    expect(ingredientNutrition).toHaveLength(1);
    expect(ingredientNutrition[0].grams).toBeUndefined();
    expect(ingredientNutrition[0].nutritionPer100g?.kcal).toBe(884);
  });

  it('does not create a new entry when an unmatched ingredient has empty grams and no per100g', () => {
    const { ingredientNutrition } = applyNutritionOverrides({
      ingredientNutrition: [],
      gramsOverrides:  { 'sale q.b.': undefined },
      per100gOverrides: { 'sale q.b.': { kcal: undefined, proteinG: undefined, carbsG: undefined, fatG: undefined, fiberG: undefined } },
      ingredients: ['sale q.b.'],
    });

    expect(ingredientNutrition).toHaveLength(0);
  });

  it('manual grams without nutritionPer100g leaves ingredient excluded from totals', () => {
    // sale with grams set but no per-100g data: isUsable=false → zero contribution
    const ing: IngredientNutrition = {
      ingredientName: 'sale q.b.',
      grams: undefined,
      source: { provider: 'openfoodfacts' },
      nutritionPer100g: undefined,
    };

    const { ingredientNutrition, nutrition } = applyNutritionOverrides({
      ingredientNutrition: [ing],
      gramsOverrides:  { 'sale q.b.': 5 },
      per100gOverrides: {},
      ingredients: ['sale q.b.'],
    });

    // Grams are set
    expect(ingredientNutrition[0].grams).toBe(5);
    // But no nutritionPer100g → calculateRecipeNutrition cannot sum it → totals are undefined/zero
    expect(nutrition.perRecipe?.kcal ?? 0).toBe(0);
    expect(nutrition.status).toBe('manual');
  });
});
