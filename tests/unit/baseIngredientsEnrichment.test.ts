import { describe, it, expect, vi } from 'vitest';
import { enrichRecipeNutritionWithProviders } from '../../src/lib/nutritionEnrichment';
import { baseIngredientsProvider } from '../../src/lib/baseIngredientsProvider';
import { manualProvider } from '../../src/lib/nutritionProviders';
import type { Recipe } from '../../src/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRecipe(ingredients: string[], overrides: Partial<Recipe> = {}): Recipe {
  return {
    id:           'test',
    name:         'Test',
    source:       'manual',
    ingredients,
    steps:        [],
    servings:     '2',
    ...overrides,
  } as Recipe;
}

// ─── base_ingredients coverage ────────────────────────────────────────────────

describe('base_ingredients enrichment — basic coverage', () => {
  it("60g fiocchi d'avena contributes kcal via base_ingredients", async () => {
    const recipe = makeRecipe(["60g fiocchi d'avena"]);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    const avena = ingredientNutrition.find(n => n.ingredientName.includes('avena'));
    expect(avena).toBeDefined();
    expect(avena!.grams).toBe(60);
    expect(avena!.source?.provider).toBe('base_ingredients');
    expect(avena!.nutritionPer100g?.kcal).toBeGreaterThan(300);
  });

  it('250ml latte parzialmente scremato gets grams via density (≈ 257.5g)', async () => {
    const recipe = makeRecipe(['250ml latte parzialmente scremato']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    const latte = ingredientNutrition.find(n => n.ingredientName.includes('latte'));
    expect(latte).toBeDefined();
    expect(latte!.grams).toBeCloseTo(257.5, 0);
    expect(latte!.gramsEstimated).toBe(true);
    expect(latte!.source?.provider).toBe('base_ingredients');
  });

  it('1 banana media gets matched (no grams but not no_match)', async () => {
    const recipe = makeRecipe(['1 banana media']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    const banana = ingredientNutrition.find(n => n.ingredientName.includes('banana'));
    expect(banana).toBeDefined();
    expect(banana!.source?.provider).toBe('base_ingredients');
    expect(banana!.nutritionPer100g?.kcal).toBe(89);
  });

  it('miele (5g, opzionale) matches miele via base_ingredients', async () => {
    const recipe = makeRecipe(['miele (5g, opzionale)']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    const miele = ingredientNutrition.find(n => n.ingredientName.includes('miele'));
    expect(miele).toBeDefined();
    expect(miele!.source?.provider).toBe('base_ingredients');
    expect(miele!.nutritionPer100g?.carbsG).toBeGreaterThan(70);
  });

  it('1 cucchiaino cannella matches cannella and contributes kcal', async () => {
    const recipe = makeRecipe(['1 cucchiaino cannella']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    const cinn = ingredientNutrition.find(n => n.ingredientName.includes('cannella'));
    expect(cinn).toBeDefined();
    expect(cinn!.source?.provider).toBe('base_ingredients');
    expect(cinn!.grams).toBe(5);  // tsp default = 5g
  });
});

// ─── Porridge recipe — several ingredients matched ────────────────────────────

describe('base_ingredients enrichment — porridge recipe', () => {
  it('oats + milk recipe produces kcal > 0', async () => {
    const recipe = makeRecipe(["60g fiocchi d'avena", '250ml latte parzialmente scremato'], { servings: '1' });
    const { nutrition } = await enrichRecipeNutritionWithProviders(recipe, [baseIngredientsProvider]);
    expect(nutrition.status).toMatch(/^(partial|complete)$/);
    const kcal = nutrition.perServing?.kcal ?? nutrition.perRecipe?.kcal;
    expect(kcal).toBeGreaterThan(0);
  });
});

// ─── Provider priority ────────────────────────────────────────────────────────

describe('base_ingredients enrichment — provider ordering', () => {
  it('manual provider wins over base_ingredients when both match', async () => {
    // pasta is in both manualProvider and base_ingredients
    const recipe = makeRecipe(['200 g pasta']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [manualProvider, baseIngredientsProvider],
    );
    const pasta = ingredientNutrition[0];
    expect(pasta).toBeDefined();
    expect(pasta.source?.provider).toBe('manual');
  });

  it('base_ingredients fills gaps that manual cannot cover', async () => {
    // banana is NOT in manualProvider
    const recipe = makeRecipe(['150g banana']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [manualProvider, baseIngredientsProvider],
    );
    const banana = ingredientNutrition.find(n => n.ingredientName.includes('banana'));
    expect(banana).toBeDefined();
    expect(banana!.source?.provider).toBe('base_ingredients');
  });

  it('user-edited entries are preserved before any provider is queried', async () => {
    const recipe = makeRecipe(['100g pasta'], {
      ingredientNutrition: [{
        ingredientName: '100g pasta',
        grams: 100,
        nutritionPer100g: { kcal: 999 },
        source: { provider: 'manual', userEdited: true },
      }],
    });
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    const pasta = ingredientNutrition.find(n => n.ingredientName === '100g pasta');
    expect(pasta).toBeDefined();
    expect(pasta!.nutritionPer100g?.kcal).toBe(999);  // preserved, not overwritten
    expect(pasta!.source?.userEdited).toBe(true);
  });
});

// ─── ml density conversion in enrichment ─────────────────────────────────────

describe('base_ingredients enrichment — ml density conversion', () => {
  it('100ml acqua gets no nutrition (no acqua entry in base_ingredients)', async () => {
    const recipe = makeRecipe(['100ml acqua']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    // acqua is not in the base dataset, so no match is expected
    const acqua = ingredientNutrition.find(n => n.ingredientName.includes('acqua'));
    expect(acqua).toBeUndefined();
  });

  it('500ml latte intero contributes kcal > 0', async () => {
    const recipe = makeRecipe(['500ml latte intero'], { servings: '1' });
    const { nutrition } = await enrichRecipeNutritionWithProviders(recipe, [baseIngredientsProvider]);
    expect(nutrition.status).toMatch(/^(partial|complete)$/);
    const kcal = nutrition.perRecipe?.kcal ?? nutrition.perServing?.kcal;
    expect(kcal).toBeGreaterThan(0);
  });
});

// ─── Transparency: excluded ingredients ──────────────────────────────────────

describe('base_ingredients enrichment — transparency', () => {
  it("fiocchi d'avena is NOT excluded (has match + grams)", async () => {
    const recipe = makeRecipe(["60g fiocchi d'avena"]);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    // deriveExcludedIngredients checks: entry exists AND grams > 0 AND nutritionPer100g
    const avena = ingredientNutrition.find(n => n.ingredientName.includes('avena'));
    expect(avena).toBeDefined();
    expect(avena!.grams).toBeGreaterThan(0);
    expect(avena!.nutritionPer100g).toBeDefined();
  });

  it('latte parzialmente scremato (250ml) is NOT excluded', async () => {
    const recipe = makeRecipe(['250ml latte parzialmente scremato']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    const latte = ingredientNutrition.find(n => n.ingredientName.includes('latte'));
    expect(latte).toBeDefined();
    expect(latte!.grams).toBeGreaterThan(0);
    expect(latte!.nutritionPer100g).toBeDefined();
  });

  it('unknown ingredient remains excluded (no entry)', async () => {
    const recipe = makeRecipe(['100g ingrediente sconosciuto xyz']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider],
    );
    const unknown = ingredientNutrition.find(n => n.ingredientName.includes('sconosciuto'));
    expect(unknown).toBeUndefined();  // not in ingredientNutrition → no_match reason
  });
});

// ─── Mexican bowl recipe (IT ingredients) ────────────────────────────────────

describe('base_ingredients enrichment — Mexican bowl recipe', () => {
  const mexicanBowlIngredients = [
    '150g mais dolce in scatola',
    '200g fagioli rossi',
    '100g pomodori pelati',
    '1 peperone rosso',
    "2 spicchi d'aglio",
    '1 cipolla rossa',
    '1 cucchiaino cumino',
    '1 cucchiaino paprika affumicata',
    '1 cucchiaino origano',
    '2 cucchiai cacao amaro',
    '200ml brodo vegetale',
    '1 lime',
    'coriandolo fresco',
  ];

  it('matches mais dolce in scatola', async () => {
    const recipe = makeRecipe(['150g mais dolce in scatola']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(recipe, [baseIngredientsProvider]);
    const match = ingredientNutrition.find(n => n.ingredientName.includes('mais'));
    expect(match?.source?.provider).toBe('base_ingredients');
  });

  it('matches fagioli rossi', async () => {
    const recipe = makeRecipe(['200g fagioli rossi']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(recipe, [baseIngredientsProvider]);
    const match = ingredientNutrition.find(n => n.ingredientName.includes('fagioli'));
    expect(match?.source?.provider).toBe('base_ingredients');
  });

  it('matches pomodori pelati', async () => {
    const recipe = makeRecipe(['100g pomodori pelati']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(recipe, [baseIngredientsProvider]);
    const match = ingredientNutrition.find(n => n.ingredientName.includes('pomodori'));
    expect(match?.source?.provider).toBe('base_ingredients');
  });

  it('matches peperone rosso', async () => {
    const recipe = makeRecipe(['1 peperone rosso']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(recipe, [baseIngredientsProvider]);
    const match = ingredientNutrition.find(n => n.ingredientName.includes('peperone'));
    expect(match?.source?.provider).toBe('base_ingredients');
  });

  it('matches brodo vegetale', async () => {
    const recipe = makeRecipe(['200ml brodo vegetale']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(recipe, [baseIngredientsProvider]);
    const match = ingredientNutrition.find(n => n.ingredientName.includes('brodo'));
    expect(match?.source?.provider).toBe('base_ingredients');
  });

  it('matches coriandolo fresco', async () => {
    const recipe = makeRecipe(['coriandolo fresco']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(recipe, [baseIngredientsProvider]);
    const match = ingredientNutrition.find(n => n.ingredientName.includes('coriandolo'));
    expect(match?.source?.provider).toBe('base_ingredients');
  });

  it('full Mexican bowl has at least 10 matched ingredients out of 13', async () => {
    const recipe = makeRecipe(mexicanBowlIngredients);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(recipe, [baseIngredientsProvider]);
    const matched = ingredientNutrition.filter(n => n.source?.provider === 'base_ingredients');
    expect(matched.length).toBeGreaterThanOrEqual(10);
  });
});

// ─── OpenFoodFacts fallback ───────────────────────────────────────────────────

describe('base_ingredients enrichment — OFF fallback behavior', () => {
  it('a mock OFF provider is still tried when base_ingredients returns nothing', async () => {
    const mockOff = {
      provider: 'openfoodfacts' as const,
      displayName: 'MockOFF',
      search: vi.fn(async () => [{
        id: 'off-xyz',
        name: 'XYZ',
        provider: 'openfoodfacts' as const,
        nutritionPer100g: { kcal: 100 },
        confidence: 0.9,
      }]),
    };

    const recipe = makeRecipe(['100g ingrediente sconosciuto xyz']);
    const { ingredientNutrition } = await enrichRecipeNutritionWithProviders(
      recipe, [baseIngredientsProvider, mockOff],
    );

    expect(mockOff.search).toHaveBeenCalled();
    const entry = ingredientNutrition.find(n => n.source?.provider === 'openfoodfacts');
    expect(entry).toBeDefined();
  });
});
