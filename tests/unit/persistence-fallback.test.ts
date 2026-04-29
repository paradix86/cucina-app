import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  resetStorageAdapter,
  getStorageAdapter,
} from '../../src/lib/storage';
import { createDexieStorageAdapter } from '../../src/lib/persistence/dexieAdapter';
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
});

describe('persistence-fallback', () => {
  it('createDexieStorageAdapter returns null when IndexedDB is unavailable', () => {
    const originalIndexedDb = globalThis.indexedDB;
    try {
      globalThis.indexedDB = undefined as unknown as IDBFactory;
      
      const localAdapter = getStorageAdapter();
      const dexieAdapter = createDexieStorageAdapter({
        localFallback: localAdapter,
        createWriteError: (key, cause) => new Error(`StorageWriteError: ${key}: ${cause}`),
      });
      
      expect(dexieAdapter).toBeNull();
    } finally {
      globalThis.indexedDB = originalIndexedDb;
    }
  });

  it('falls back to localStorage when IndexedDB is unavailable during bootstrap', async () => {
    const originalIndexedDb = globalThis.indexedDB;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        {
          id: 'fallback-test-1',
          name: 'Fallback Recipe',
          ingredients: [ '1 egg' ],
          steps: [ 'Cook' ],
        },
      ]));

      globalThis.indexedDB = undefined as unknown as IDBFactory;
      resetStorageAdapter();

      const localAdapter = getStorageAdapter();
      const dexieAdapter = createDexieStorageAdapter({
        localFallback: localAdapter,
        createWriteError: (key, cause) => new Error(`StorageWriteError: ${key}: ${cause}`),
      });

      expect(dexieAdapter).toBeNull();
      const recipes = localAdapter.recipeBook.load();
      expect(recipes).toHaveLength(1);
      expect(recipes[0].name).toBe('Fallback Recipe');
    } finally {
      globalThis.indexedDB = originalIndexedDb;
    }
  });

  it('invokes onFallback callback when IndexedDB is unavailable', async () => {
    const originalIndexedDb = globalThis.indexedDB;
    let fallbackInvoked = false;
    
    try {
      globalThis.indexedDB = undefined as unknown as IDBFactory;
      resetStorageAdapter();

      const localAdapter = getStorageAdapter();
      const dexieAdapter = createDexieStorageAdapter({
        localFallback: localAdapter,
        createWriteError: (key, cause) => new Error(`StorageWriteError: ${key}: ${cause}`),
        onFallback: () => {
          fallbackInvoked = true;
        },
      });

      expect(dexieAdapter).toBeNull();
    } finally {
      globalThis.indexedDB = originalIndexedDb;
    }
  });

  it('localStorage fallback preserves recipe data through add/remove cycle', () => {
    const originalIndexedDb = globalThis.indexedDB;
    try {
      globalThis.indexedDB = undefined as unknown as IDBFactory;

      const localAdapter = getStorageAdapter();
      const recipe1 = {
        id: 'recipe-1',
        name: 'Test Recipe',
        ingredients: [ '100 g flour' ],
        steps: [ 'Mix', 'Bake' ],
      };

      localAdapter.recipeBook.save([ recipe1 ]);
      expect(localAdapter.recipeBook.load()).toHaveLength(1);

      localAdapter.recipeBook.add({
        id: 'recipe-2',
        name: 'Another Recipe',
        ingredients: [ '200 g sugar' ],
        steps: [ 'Combine' ],
      });

      expect(localAdapter.recipeBook.load()).toHaveLength(2);

      localAdapter.recipeBook.remove('recipe-1');
      const remaining = localAdapter.recipeBook.load();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('recipe-2');
    } finally {
      globalThis.indexedDB = originalIndexedDb;
    }
  });

  it('localStorage adapter persists shopping items correctly', () => {
    const originalIndexedDb = globalThis.indexedDB;
    try {
      globalThis.indexedDB = undefined as unknown as IDBFactory;

      const localAdapter = getStorageAdapter();
      const items = [
        { id: 'item-1', text: '500 g pasta', checked: false, createdAt: 1000 },
        { id: 'item-2', text: '2 eggs', checked: true, createdAt: 1001 },
      ];

      localAdapter.shoppingList.save(items);
      const loaded = localAdapter.shoppingList.load();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].text).toBe('500 g pasta');
      expect(loaded[1].checked).toBe(true);
    } finally {
      globalThis.indexedDB = originalIndexedDb;
    }
  });
});
