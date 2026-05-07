import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { resetStorageAdapter } from '../../src/lib/storage';
import { useRecipeBookStore } from '../../src/stores/recipeBook';
import { CucinaDexieDb } from '../../src/lib/persistence/dexieDb';
import type { Recipe } from '../../src/types';

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
  globalThis.localStorage = localStorageMock as Storage;
  localStorageMock.clear();
  resetStorageAdapter();
  await clearDexieDb();
  setActivePinia(createPinia());
});

const FRESH_RECIPE: Recipe = {
  id: 'imp_999',
  name: 'Spaghetti alla Carbonara (updated)',
  category: 'Primi',
  emoji: '🍝',
  time: '20 min',
  servings: '4',
  difficulty: 'medium',
  source: 'web',
  sourceDomain: 'giallozafferano.it',
  url: 'https://www.giallozafferano.it/ricetta/spaghetti-alla-carbonara/',
  preparationType: 'classic',
  ingredients: ['320 g spaghetti', '150 g guanciale', '6 tuorli'],
  steps: ['Boil pasta', 'Render guanciale', 'Combine and serve'],
  timerMinutes: 20,
  tags: ['pasta', 'classico'],
  mealOccasion: ['Pranzo', 'Cena'],
};

describe('recipeBookStore.replaceImported', () => {
  it('overwrites imported fields with fresh content', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();
    store.add({
      id: 'r-existing',
      name: 'Old Carbonara',
      url: 'https://www.giallozafferano.it/ricetta/spaghetti-alla-carbonara/',
      ingredients: ['200 g spaghetti'],
      steps: ['Old step'],
    });

    const ok = store.replaceImported('r-existing', FRESH_RECIPE);

    expect(ok).toBe(true);
    expect(store.recipes).toHaveLength(1);
    const after = store.recipes[0];
    expect(after.name).toBe('Spaghetti alla Carbonara (updated)');
    expect(after.ingredients).toEqual([
      '320 g spaghetti', '150 g guanciale', '6 tuorli',
    ]);
    expect(after.steps).toHaveLength(3);
    expect(after.timerMinutes).toBe(20);
    expect(after.tags).toEqual(['pasta', 'classico']);
  });

  it('preserves the original id even though fresh.id differs', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();
    store.add({ id: 'r-existing', name: 'Old', ingredients: [], steps: [] });

    store.replaceImported('r-existing', FRESH_RECIPE);

    expect(store.recipes[0].id).toBe('r-existing');
  });

  it('preserves favorite, lastViewedAt, and notes from the existing recipe', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();
    store.add({
      id: 'r-existing',
      name: 'Old',
      ingredients: [],
      steps: [],
      favorite: true,
      lastViewedAt: 1736000000000,
      notes: 'Family note: aggiungere pancetta',
    });

    store.replaceImported('r-existing', { ...FRESH_RECIPE, favorite: false });

    expect(store.recipes[0].favorite).toBe(true);
    expect(store.recipes[0].lastViewedAt).toBe(1736000000000);
    expect(store.recipes[0].notes).toBe('Family note: aggiungere pancetta');
  });

  it('returns false and leaves the book unchanged when id is not found', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();
    store.add({ id: 'r-existing', name: 'Old', ingredients: [], steps: [] });

    const ok = store.replaceImported('r-nonexistent', FRESH_RECIPE);

    expect(ok).toBe(false);
    expect(store.recipes).toHaveLength(1);
    expect(store.recipes[0].name).toBe('Old');
  });

  it('does not increase the recipe count (replace, not add)', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();
    store.add({ id: 'r-existing', name: 'Old', ingredients: [], steps: [] });
    store.add({ id: 'r-other', name: 'Other', ingredients: [], steps: [] });

    store.replaceImported('r-existing', FRESH_RECIPE);

    expect(store.recipes).toHaveLength(2);
    expect(store.recipes.map(r => r.id).sort()).toEqual(['r-existing', 'r-other']);
  });

  it('persists the replaced recipe across a refresh', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();
    store.add({ id: 'r-existing', name: 'Old', ingredients: [], steps: [] });
    store.replaceImported('r-existing', FRESH_RECIPE);

    await store.refresh();

    expect(store.recipes[0].name).toBe('Spaghetti alla Carbonara (updated)');
    expect(store.recipes[0].id).toBe('r-existing');
  });
});
