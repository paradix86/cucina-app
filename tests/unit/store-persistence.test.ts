import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  STORAGE_KEY,
  resetStorageAdapter,
} from '../../src/lib/storage';
import { useRecipeBookStore } from '../../src/stores/recipeBook';
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

// The recipeBook store serializes mutations through an internal persistQueue.
// store.refresh() awaits the queue then re-hydrates, so it is the correct
// way to assert persisted state from tests.

describe('store persistence and mutation ordering', () => {
  it('persists concurrent add operations to Dexie', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();

    store.add({
      id: 'recipe-1',
      name: 'Pasta',
      ingredients: ['200g pasta'],
      steps: ['Cook pasta'],
    });
    store.add({
      id: 'recipe-2',
      name: 'Rice',
      ingredients: ['200g rice'],
      steps: ['Cook rice'],
    });

    await store.refresh();

    expect(store.recipes).toHaveLength(2);
    expect(store.recipes.map(r => r.id).sort()).toEqual(['recipe-1', 'recipe-2']);

    const db = new CucinaDexieDb();
    const dexieRecipes = await db.recipes.toArray();
    expect(dexieRecipes).toHaveLength(2);
    db.close();
  });

  it('persists add then update then remove sequence in order', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();

    store.add({
      id: 'recipe-1',
      name: 'Pasta',
      ingredients: ['200g pasta'],
      steps: ['Cook pasta'],
    });
    expect(store.recipes).toHaveLength(1);
    expect(store.recipes[0].name).toBe('Pasta');

    store.update('recipe-1', { name: 'Spaghetti' });
    expect(store.recipes[0].name).toBe('Spaghetti');

    store.remove('recipe-1');
    expect(store.recipes).toHaveLength(0);

    await store.refresh();
    expect(store.recipes).toHaveLength(0);

    const db = new CucinaDexieDb();
    const dexieRecipes = await db.recipes.toArray();
    expect(dexieRecipes).toHaveLength(0);
    db.close();
  });

  it('persists rapid mutations with correct final state in Dexie', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();

    for (let i = 1; i <= 3; i += 1) {
      store.add({
        id: 'recipe-' + i,
        name: 'Recipe ' + i,
        ingredients: ['ingredient ' + i],
        steps: ['step ' + i],
      });
    }
    expect(store.recipes).toHaveLength(3);

    store.update('recipe-1', { name: 'Updated Recipe 1' });
    store.remove('recipe-2');
    expect(store.recipes).toHaveLength(2);

    await store.refresh();

    expect(store.recipes).toHaveLength(2);
    const ids = store.recipes.map(r => r.id).sort();
    expect(ids).toEqual(['recipe-1', 'recipe-3']);

    const db = new CucinaDexieDb();
    const dexieRecipes = await db.recipes.toArray();
    expect(dexieRecipes).toHaveLength(2);
    const dexieIds = dexieRecipes.map(r => r.id).sort();
    expect(dexieIds).toEqual(['recipe-1', 'recipe-3']);
    db.close();
  });

  it('mirrors mutations to localStorage after persist queue drains', async () => {
    const store = useRecipeBookStore();
    await store.hydrate();

    store.add({
      id: 'recipe-1',
      name: 'Pasta',
      ingredients: ['200g pasta'],
      steps: ['Cook pasta'],
    });

    await store.refresh();

    const lsData = localStorage.getItem(STORAGE_KEY);
    expect(lsData).toBeTruthy();
    const parsed = JSON.parse(lsData!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('recipe-1');
  });
});
