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
});
