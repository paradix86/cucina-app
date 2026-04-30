import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SHOPPING_LIST_KEY, resetStorageAdapter } from '../../src/lib/storage';
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

describe('shopping list — manual items', () => {
  it('adds a manual item and returns true', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    const result = store.addManualItem('Parmigiano');

    expect(result).toBe(true);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toBe('Parmigiano');
    expect(store.items[0].sourceRecipeId).toBeUndefined();
    expect(store.items[0].id).toMatch(/^manual-/);
  });

  it('rejects empty or whitespace-only text', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    expect(store.addManualItem('')).toBe(false);
    expect(store.addManualItem('   ')).toBe(false);
    expect(store.items).toHaveLength(0);
  });

  it('trims whitespace from text', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addManualItem('  Burro  ');

    expect(store.items[0].text).toBe('Burro');
  });

  it('persists manual item after reload', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addManualItem('Parmigiano');
    await store.refresh();

    expect(store.items).toHaveLength(1);
    expect(store.items[0].text).toBe('Parmigiano');

    const db = new CucinaDexieDb();
    const saved = await db.shoppingItems.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0].text).toBe('Parmigiano');
    db.close();
  });

  it('coexists with recipe-generated items without breaking grouping', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addRecipeIngredients(
      { id: 'r1', name: 'Pasta', ingredients: ['200g pasta', '100g pomodoro'] },
      {},
    );
    store.addManualItem('Parmigiano');

    await store.refresh();

    expect(store.items).toHaveLength(3);
    const manual = store.items.find(i => i.text === 'Parmigiano');
    expect(manual).toBeDefined();
    expect(manual?.sourceRecipeId).toBeUndefined();
    expect(store.groupedSections.length).toBeGreaterThan(0);
  });

  it('mirrors manual item to localStorage after persist queue drains', async () => {
    const store = useShoppingListStore();
    await store.hydrate();

    store.addManualItem('Sale');
    await store.refresh();

    const lsData = localStorage.getItem(SHOPPING_LIST_KEY);
    expect(lsData).toBeTruthy();
    const parsed = JSON.parse(lsData!);
    expect(parsed.some((item: { text: string }) => item.text === 'Sale')).toBe(true);
  });
});
