import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { resetStorageAdapter } from '../../src/lib/storage';
import { useShoppingListStore } from '../../src/stores/shoppingList';
import { CucinaDexieDb } from '../../src/lib/persistence/dexieDb';

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

describe('shopping list — recipe dedup', () => {
  it('single add produces one item per ingredient', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate', '300g carne'] });

    expect(store.items).toHaveLength(2);
  });

  it('double add of same recipe merges high-confidence quantities', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toMatch(/4/);
  });

  it('double add of same recipe merges low-confidence trailing number', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['Patate 2'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['Patate 2'] });

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toMatch(/4/);
  });

  it('same ingredient from different recipes produces separate items', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    store.addRecipeIngredients({ id: 'r2', name: 'Gnocchi', ingredients: ['2 patate'] });

    expect(store.items).toHaveLength(2);
    expect(store.items[0].sourceRecipeId).toBe('r1');
    expect(store.items[1].sourceRecipeId).toBe('r2');
  });

  it('triple add accumulates correctly', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toMatch(/6/);
  });

  it('manual items are never deduplicated against recipe items', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addManualItem('patate');
    store.addManualItem('patate');
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });

    // 2 manual + 1 recipe = 3 distinct items
    expect(store.items).toHaveLength(3);
  });

  it('removeRecipeIngredients removes all items for a recipe', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate', '300g carne'] });
    expect(store.items).toHaveLength(2);

    const removed = store.removeRecipeIngredients('r1');
    expect(removed).toBe(2);
    expect(store.items).toHaveLength(0);
  });

  it('removeRecipeIngredients removes only the target recipe when two recipes are present', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    store.addRecipeIngredients({ id: 'r2', name: 'Gnocchi', ingredients: ['100g farina'] });
    expect(store.items).toHaveLength(2);

    store.removeRecipeIngredients('r1');
    expect(store.items).toHaveLength(1);
    expect(store.items[0].sourceRecipeId).toBe('r2');
  });

  it('removeRecipeIngredients does not touch manual items', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addManualItem('sale');
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    expect(store.items).toHaveLength(2);

    store.removeRecipeIngredients('r1');
    expect(store.items).toHaveLength(1);
    expect(store.items[0].sourceRecipeId).toBeUndefined();
    expect(store.items[0].text).toBe('sale');
  });

  it('adding same recipe 3 times (planner day with 3 slots) aggregates into one item', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addRecipeIngredients({ id: 'r1', name: 'Pasta', ingredients: ['200g pasta'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Pasta', ingredients: ['200g pasta'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Pasta', ingredients: ['200g pasta'] });

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toMatch(/600/);
  });

  // RT-04 regression: low-confidence inputs whose text does not end in a digit
  // (so mergeIngredientTexts falls back to "× N") must keep a stable dedup key
  // across repeated adds. Previously the "× N" suffix poisoned the key and
  // produced extra rows on the 3rd, 5th, ... add.

  it('RT-04: adding "Aglio 1 spicchio" 5 times yields exactly one row', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    for (let i = 0; i < 5; i++) {
      store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['Aglio 1 spicchio'] });
    }

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toMatch(/× ?5|spicchi/i);
  });

  it('RT-04: adding "Acqua q.b." 5 times yields exactly one row', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    for (let i = 0; i < 5; i++) {
      store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['Acqua q.b.'] });
    }

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toMatch(/× ?5/);
  });

  it('RT-04: adding "Paprika dolce 3 cucchiai" 5 times yields exactly one row', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    for (let i = 0; i < 5; i++) {
      store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['Paprika dolce 3 cucchiai'] });
    }

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toMatch(/× ?5|15/);
  });

  it('RT-04: adding "Semi di cumino ½ cucchiaio" 5 times yields exactly one row', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    for (let i = 0; i < 5; i++) {
      store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['Semi di cumino ½ cucchiaio'] });
    }

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toMatch(/× ?5/);
  });

  it('RT-04: full Gulash ingredient set added 5 times produces one row per unique ingredient', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    const ingredients = [
      'Aglio 1 spicchio',
      'Acqua q.b.',
      'Paprika dolce 3 cucchiai',
      'Paprika piccante 1 cucchiaio',
      'Semi di cumino ½ cucchiaio',
      'Alloro 2 foglie',
      'Cipolle 3',
    ];

    for (let i = 0; i < 5; i++) {
      store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients });
    }

    expect(store.items).toHaveLength(ingredients.length);
    const baseNames = store.items
      .map(i => i.text)
      .map(t =>
        t.replace(/\s*×\s*\d+\s*$/, '').replace(/\s*\d+(?:[.,]\d+)?\s*$/, '').trim().toLowerCase(),
      );
    expect(new Set(baseNames).size).toBe(baseNames.length);
  });

  it('adding same planner day twice doubles the aggregated quantity', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    // First "day add": recipe fills all 3 slots
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    // Second "day add" of the same day → 6 × 2 = 12
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });
    store.addRecipeIngredients({ id: 'r1', name: 'Gulash', ingredients: ['2 patate'] });

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toMatch(/12/);
  });
});
