import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  STORAGE_KEY,
  resetStorageAdapter,
} from '../../src/lib/storage';
import { useRecipeBookStore } from '../../src/stores/recipeBook';
import { CucinaDexieDb } from '../../src/lib/persistence/dexieDb';
import type { Recipe, RecipeNutrition, IngredientNutrition } from '../../src/types';

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

const sampleNutrition: RecipeNutrition = {
  status: 'complete',
  servingsUsed: 2,
  perServing: { kcal: 350, proteinG: 12, carbsG: 60, fatG: 8 },
  perRecipe: { kcal: 700, proteinG: 24, carbsG: 120, fatG: 16 },
  sources: [{ provider: 'manual', confidence: 1.0 }],
};

const sampleIngredientNutrition: IngredientNutrition[] = [
  {
    ingredientName: '200 g pasta',
    normalizedName: 'pasta',
    quantity: 200,
    unit: 'g',
    grams: 200,
    nutritionPer100g: { kcal: 350, proteinG: 12, carbsG: 70 },
    source: { provider: 'manual', externalId: 'pasta', confidence: 1.0 },
  },
];

const baseRecipe: Recipe = {
  id: 'r-nutrition-1',
  name: 'Pasta Test',
  ingredients: ['200 g pasta'],
  steps: ['Cuoci'],
};

beforeEach(async () => {
  globalThis.localStorage = localStorageMock as Storage;
  localStorageMock.clear();
  resetStorageAdapter();
  await clearDexieDb();
  setActivePinia(createPinia());
});

describe('store nutrition preservation', () => {
  describe('cloneRecipe deep-clone', () => {
    it('preserves nutrition through add → read cycle', async () => {
      const store = useRecipeBookStore();
      await store.hydrate();

      const recipe: Recipe = { ...baseRecipe, nutrition: sampleNutrition, ingredientNutrition: sampleIngredientNutrition };
      store.add(recipe);

      const saved = store.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.nutrition?.status).toBe('complete');
      expect(saved?.nutrition?.perServing?.kcal).toBe(350);
      expect(saved?.ingredientNutrition).toHaveLength(1);
      expect(saved?.ingredientNutrition?.[0].grams).toBe(200);
    });

    it('isolates nutrition object from original after add', async () => {
      const store = useRecipeBookStore();
      await store.hydrate();

      const nutrition = { ...sampleNutrition, perServing: { kcal: 350 } };
      const recipe: Recipe = { ...baseRecipe, nutrition };
      store.add(recipe);

      // Mutate the original — store copy must not be affected
      nutrition.perServing!.kcal = 9999;

      const saved = store.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.nutrition?.perServing?.kcal).toBe(350);
    });

    it('isolates ingredientNutrition entries from original after add', async () => {
      const store = useRecipeBookStore();
      await store.hydrate();

      const ing = { ...sampleIngredientNutrition[0], nutritionPer100g: { kcal: 350 } };
      const recipe: Recipe = { ...baseRecipe, ingredientNutrition: [ing] };
      store.add(recipe);

      ing.nutritionPer100g!.kcal = 9999;

      const saved = store.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.ingredientNutrition?.[0].nutritionPer100g?.kcal).toBe(350);
    });

    it('handles recipe with undefined nutrition gracefully', async () => {
      const store = useRecipeBookStore();
      await store.hydrate();

      store.add({ ...baseRecipe });

      const saved = store.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.nutrition).toBeUndefined();
      expect(saved?.ingredientNutrition).toBeUndefined();
    });

    it('preserves nutrition.sources array independently', async () => {
      const store = useRecipeBookStore();
      await store.hydrate();

      const src = { provider: 'manual' as const, confidence: 1.0 };
      const nutrition: RecipeNutrition = { ...sampleNutrition, sources: [src] };
      store.add({ ...baseRecipe, nutrition });

      nutrition.sources!.push({ provider: 'openfoodfacts' });

      const saved = store.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.nutrition?.sources).toHaveLength(1);
      expect(saved?.nutrition?.sources?.[0].provider).toBe('manual');
    });
  });

  describe('update() nutrition fields', () => {
    it('stores nutrition after update()', async () => {
      const store = useRecipeBookStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([baseRecipe]));
      await store.hydrate();

      store.update('r-nutrition-1', {
        nutrition: sampleNutrition,
        ingredientNutrition: sampleIngredientNutrition,
      });

      const saved = store.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.nutrition?.status).toBe('complete');
      expect(saved?.nutrition?.perServing?.kcal).toBe(350);
      expect(saved?.ingredientNutrition).toHaveLength(1);
    });

    it('does not replace existing non-nutrition fields when updating nutrition', async () => {
      const store = useRecipeBookStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...baseRecipe, notes: 'my notes' }]));
      await store.hydrate();

      store.update('r-nutrition-1', { nutrition: sampleNutrition });

      const saved = store.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.notes).toBe('my notes');
      expect(saved?.nutrition?.status).toBe('complete');
    });

    it('overwrites existing nutrition on re-calculate', async () => {
      const store = useRecipeBookStore();
      const oldNutrition: RecipeNutrition = { status: 'partial', sources: [{ provider: 'manual' }], perRecipe: { kcal: 100 } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...baseRecipe, nutrition: oldNutrition }]));
      await store.hydrate();

      store.update('r-nutrition-1', { nutrition: sampleNutrition });

      const saved = store.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.nutrition?.status).toBe('complete');
      expect(saved?.nutrition?.perServing?.kcal).toBe(350);
    });

    it('isolates updated nutrition from the passed object', async () => {
      const store = useRecipeBookStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([baseRecipe]));
      await store.hydrate();

      const nutrition = { ...sampleNutrition, perServing: { kcal: 350 } };
      store.update('r-nutrition-1', { nutrition });

      nutrition.perServing!.kcal = 9999;

      const saved = store.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.nutrition?.perServing?.kcal).toBe(350);
    });
  });

  describe('persistence round-trip', () => {
    it('nutrition survives persist → hydrate cycle', async () => {
      const store = useRecipeBookStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([baseRecipe]));
      await store.hydrate();

      store.update('r-nutrition-1', {
        nutrition: sampleNutrition,
        ingredientNutrition: sampleIngredientNutrition,
      });

      // Flush the persist queue: it's a plain promise chain (no real timers),
      // so a setImmediate drain is enough and is not sensitive to machine load.
      await new Promise<void>(resolve => setImmediate(resolve));

      // Re-hydrate simulates app restart
      resetStorageAdapter();
      await clearDexieDb();
      setActivePinia(createPinia());
      const store2 = useRecipeBookStore();
      await store2.hydrate();

      const saved = store2.recipes.find(r => r.id === 'r-nutrition-1');
      expect(saved?.nutrition?.status).toBe('complete');
      expect(saved?.nutrition?.perServing?.kcal).toBe(350);
      expect(saved?.ingredientNutrition?.[0].grams).toBe(200);
    });
  });
});
