import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  SHOPPING_LIST_KEY,
  STORAGE_KEY,
  WEEKLY_PLANNER_KEY,
  resetStorageAdapter,
  waitForStorageBootstrap,
} from '../../src/lib/storage';
import { useRecipeBookStore } from '../../src/stores/recipeBook';
import { useShoppingListStore } from '../../src/stores/shoppingList';
import { useWeeklyPlannerStore } from '../../src/stores/weeklyPlanner';
import { CucinaDexieDb } from '../../src/lib/persistence/dexieDb';
import { createEmptyWeeklyPlanner } from '../../src/lib/planner';

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

describe('store hydration', () => {
  it('hydrates recipe book, shopping list, and planner state from storage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        id: 'recipe-1',
        name: 'Pasta',
        ingredients: [ '200 g pasta' ],
        steps: [ 'Cuoci' ],
      },
    ]));
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify([
      {
        id: 'shop-1',
        text: '200 g pasta',
        checked: false,
        createdAt: 1,
      },
    ]));
    localStorage.setItem(WEEKLY_PLANNER_KEY, JSON.stringify({
      ...createEmptyWeeklyPlanner(),
      monday: { breakfast: null, lunch: 'recipe-1', dinner: null },
    }));

    const recipeBook = useRecipeBookStore();
    const shoppingList = useShoppingListStore();
    const weeklyPlanner = useWeeklyPlannerStore();

    await Promise.all([
      recipeBook.hydrate(),
      shoppingList.hydrate(),
      weeklyPlanner.hydrate(),
    ]);

    expect(recipeBook.isHydrated).toBe(true);
    expect(recipeBook.recipes).toHaveLength(1);
    expect(shoppingList.isHydrated).toBe(true);
    expect(shoppingList.items).toHaveLength(1);
    expect(weeklyPlanner.isHydrated).toBe(true);
    expect(weeklyPlanner.plan.monday.lunch).toBe('recipe-1');
  });

  it('keeps shopping list and planner behavior stable after hydration', async () => {
    const recipeBook = useRecipeBookStore();
    const shoppingList = useShoppingListStore();
    const weeklyPlanner = useWeeklyPlannerStore();

    await Promise.all([
      recipeBook.hydrate(),
      shoppingList.hydrate(),
      weeklyPlanner.hydrate(),
    ]);

    const added = shoppingList.addRecipeIngredients({
      id: 'recipe-2',
      name: 'Toast',
      ingredients: [ '2 eggs', '100 g bread' ],
    });
    expect(added).toBe(2);
    expect(shoppingList.items).toHaveLength(2);

    expect(weeklyPlanner.setSlot('tuesday', 'dinner', 'recipe-2')).toBe(true);
    expect(weeklyPlanner.plan.tuesday.dinner).toBe('recipe-2');

    await new Promise(resolve => setTimeout(resolve, 25));
    await Promise.all([
      shoppingList.refresh(),
      weeklyPlanner.refresh(),
    ]);

    expect(shoppingList.items).toHaveLength(2);
    expect(weeklyPlanner.plan.tuesday.dinner).toBe('recipe-2');
  });

  it('hydrates from localStorage fallback when IndexedDB is unavailable', async () => {
    const originalIndexedDb = globalThis.indexedDB;
    try {
      globalThis.indexedDB = undefined as unknown as IDBFactory;
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        {
          id: 'fallback-1',
          name: 'Fallback',
          ingredients: [ '1 uovo' ],
          steps: [ 'Mescola' ],
        },
      ]));

      resetStorageAdapter();
      const recipeBook = useRecipeBookStore();

      await recipeBook.hydrate();
      await waitForStorageBootstrap();

      expect(recipeBook.isHydrated).toBe(true);
      expect(recipeBook.recipes).toHaveLength(1);
    } finally {
      globalThis.indexedDB = originalIndexedDb;
    }
  });

  it('remains stable through repeated hydration and refresh cycles', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        id: 'cycle-1',
        name: 'Cycle Recipe',
        ingredients: [ '1 tomato' ],
        steps: [ 'Slice' ],
      },
    ]));
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify([
      {
        id: 'cycle-shop-1',
        text: '1 tomato',
        checked: false,
        createdAt: 1,
      },
    ]));
    localStorage.setItem(WEEKLY_PLANNER_KEY, JSON.stringify({
      ...createEmptyWeeklyPlanner(),
      monday: { breakfast: null, lunch: 'cycle-1', dinner: null },
    }));

    const recipeBook = useRecipeBookStore();
    const shoppingList = useShoppingListStore();
    const weeklyPlanner = useWeeklyPlannerStore();

    for (let i = 0; i < 4; i += 1) {
      await Promise.all([
        recipeBook.hydrate(i > 0),
        shoppingList.hydrate(i > 0),
        weeklyPlanner.hydrate(i > 0),
      ]);

      expect(recipeBook.recipes).toHaveLength(1);
      expect(shoppingList.items).toHaveLength(1);
      expect(weeklyPlanner.plan.monday.lunch).toBe('cycle-1');

      await Promise.all([
        recipeBook.refresh(),
        shoppingList.refresh(),
        weeklyPlanner.refresh(),
      ]);
    }
  });
});
