import type {
  PlannerDayId,
  PlannerMealSlot,
  Recipe,
  ShoppingItem,
  WeeklyPlanner,
} from '../../types';
import { createEmptyWeeklyPlanner, normalizeWeeklyPlanner } from '../planner';
import { CucinaDexieDb, DEXIE_MIGRATION_META_KEY, WEEKLY_PLANNER_ROW_ID, isIndexedDbSupported } from './dexieDb';
import type {
  AddShoppingOptions,
  AsyncStorageAdapter,
  ImportResult,
  RecipeInput,
  RecipeMeta,
  StorageAdapter,
} from './storageAdapter';

type PersistenceSnapshot = {
  recipes: Recipe[];
  shoppingItems: ShoppingItem[];
  weeklyPlanner: WeeklyPlanner;
};

type DexieWriteErrorFactory = (storageKey: string, cause?: unknown) => Error;

type DexieStorageAdapterOptions = {
  db?: CucinaDexieDb;
  localFallback: StorageAdapter;
  createWriteError: DexieWriteErrorFactory;
  onFallback?: () => void;
};

export type DexieStorageAdapter = StorageAdapter & {
  ready: Promise<void>;
  async: AsyncStorageAdapter;
};

function cloneRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ingredients: [ ...(recipe.ingredients || []) ],
    steps: [ ...(recipe.steps || []) ],
    tags: recipe.tags ? [ ...recipe.tags ] : undefined,
    mealOccasion: recipe.mealOccasion ? [ ...recipe.mealOccasion ] : undefined,
  };
}

function cloneShoppingItem(item: ShoppingItem): ShoppingItem {
  return { ...item };
}

function cloneWeeklyPlanner(plan: WeeklyPlanner): WeeklyPlanner {
  return normalizeWeeklyPlanner(plan);
}

function cloneSnapshot(snapshot: PersistenceSnapshot): PersistenceSnapshot {
  return {
    recipes: snapshot.recipes.map(cloneRecipe),
    shoppingItems: snapshot.shoppingItems.map(cloneShoppingItem),
    weeklyPlanner: cloneWeeklyPlanner(snapshot.weeklyPlanner),
  };
}

function emptySnapshot(): PersistenceSnapshot {
  return {
    recipes: [],
    shoppingItems: [],
    weeklyPlanner: createEmptyWeeklyPlanner(),
  };
}

function loadSnapshotFromAdapter(adapter: StorageAdapter): PersistenceSnapshot {
  return {
    recipes: adapter.recipeBook.load(),
    shoppingItems: adapter.shoppingList.load(),
    weeklyPlanner: adapter.weeklyPlanner.load(),
  };
}

function hasPlannerContent(plan: WeeklyPlanner): boolean {
  return Object.values(plan).some(day => Object.values(day).some(Boolean));
}

function hasSnapshotData(snapshot: PersistenceSnapshot): boolean {
  return snapshot.recipes.length > 0
    || snapshot.shoppingItems.length > 0
    || hasPlannerContent(snapshot.weeklyPlanner);
}

export function createDexieStorageAdapter(options: DexieStorageAdapterOptions): DexieStorageAdapter | null {
  if (!isIndexedDbSupported()) return null;
  return new DexieBackedStorageAdapter(options);
}

class DexieBackedStorageAdapter implements DexieStorageAdapter {
  readonly recipeBook;
  readonly shoppingList;
  readonly weeklyPlanner;
  readonly ready: Promise<void>;
  readonly async: AsyncStorageAdapter;

  private readonly db: CucinaDexieDb;
  private readonly localFallback: StorageAdapter;
  private readonly createWriteError: DexieWriteErrorFactory;
  private readonly onFallback?: () => void;
  private cache: PersistenceSnapshot;
  private syncQueue: Promise<void> = Promise.resolve();
  private didFallback = false;

  constructor({ db, localFallback, createWriteError, onFallback }: DexieStorageAdapterOptions) {
    this.db = db || new CucinaDexieDb();
    this.localFallback = localFallback;
    this.createWriteError = createWriteError;
    this.onFallback = onFallback;
    this.cache = cloneSnapshot(loadSnapshotFromAdapter(localFallback));
    this.ready = this.bootstrap().catch(error => {
      this.triggerFallback(error);
    });

    this.recipeBook = {
      migrateFromV2: () => {
        this.localFallback.recipeBook.migrateFromV2();
        this.refreshRecipeCache();
        this.queueRecipeSync();
      },
      load: () => this.didFallback
        ? this.localFallback.recipeBook.load()
        : this.cache.recipes.map(cloneRecipe),
      save: recipes => {
        this.localFallback.recipeBook.save(recipes);
        this.refreshRecipeCache();
        this.queueRecipeSync();
      },
      add: recipe => {
        const added = this.localFallback.recipeBook.add(recipe);
        this.refreshRecipeCache();
        if (added) this.queueRecipeSync();
        return added;
      },
      remove: id => {
        this.localFallback.recipeBook.remove(id);
        this.refreshRecipeCache();
        this.queueRecipeSync();
      },
      update: (id, updates) => {
        const updated = this.localFallback.recipeBook.update(id, updates);
        this.refreshRecipeCache();
        if (updated) this.queueRecipeSync();
        return updated;
      },
      updateNotes: (id, notes) => {
        const updated = this.localFallback.recipeBook.updateNotes(id, notes);
        this.refreshRecipeCache();
        if (updated) this.queueRecipeSync();
        return updated;
      },
      toggleFavorite: id => {
        const updated = this.localFallback.recipeBook.toggleFavorite(id);
        this.refreshRecipeCache();
        if (updated) this.queueRecipeSync();
        return updated;
      },
      markViewed: id => {
        const updated = this.localFallback.recipeBook.markViewed(id);
        this.refreshRecipeCache();
        if (updated) this.queueRecipeSync();
        return updated;
      },
      exportBackup: () => this.localFallback.recipeBook.exportBackup(),
      importBackup: async (file: File): Promise<ImportResult> => {
        const result = await this.localFallback.recipeBook.importBackup(file);
        this.refreshRecipeCache();
        this.queueRecipeSync();
        return result;
      },
    };

    this.shoppingList = {
      load: () => this.didFallback
        ? this.localFallback.shoppingList.load()
        : this.cache.shoppingItems.map(cloneShoppingItem),
      save: items => {
        this.localFallback.shoppingList.save(items);
        this.refreshShoppingCache();
        this.queueShoppingSync();
      },
      add: (items, recipeMeta) => {
        const added = this.localFallback.shoppingList.add(items, recipeMeta);
        this.refreshShoppingCache();
        if (added > 0) this.queueShoppingSync();
        return added;
      },
      addWithScale: (items, recipeMeta, options) => {
        const added = this.localFallback.shoppingList.addWithScale(items, recipeMeta, options);
        this.refreshShoppingCache();
        if (added > 0) this.queueShoppingSync();
        return added;
      },
      removeByRecipe: recipeId => {
        const removed = this.localFallback.shoppingList.removeByRecipe(recipeId);
        this.refreshShoppingCache();
        if (removed > 0) this.queueShoppingSync();
        return removed;
      },
      toggleItem: id => {
        const updated = this.localFallback.shoppingList.toggleItem(id);
        this.refreshShoppingCache();
        if (updated) this.queueShoppingSync();
        return updated;
      },
      removeItem: id => {
        const removed = this.localFallback.shoppingList.removeItem(id);
        this.refreshShoppingCache();
        if (removed) this.queueShoppingSync();
        return removed;
      },
      clear: () => {
        this.localFallback.shoppingList.clear();
        this.refreshShoppingCache();
        this.queueShoppingSync();
      },
    };

    this.weeklyPlanner = {
      load: () => this.didFallback
        ? this.localFallback.weeklyPlanner.load()
        : cloneWeeklyPlanner(this.cache.weeklyPlanner),
      save: plan => {
        this.localFallback.weeklyPlanner.save(plan);
        this.refreshPlannerCache();
        this.queuePlannerSync();
      },
      updateSlot: (day: PlannerDayId, slot: PlannerMealSlot, recipeId: string | null) => {
        const next = this.localFallback.weeklyPlanner.updateSlot(day, slot, recipeId);
        this.refreshPlannerCache();
        this.queuePlannerSync();
        return cloneWeeklyPlanner(next);
      },
      clear: () => {
        this.localFallback.weeklyPlanner.clear();
        this.refreshPlannerCache();
        this.queuePlannerSync();
      },
    };

    this.async = {
      recipeBook: {
        migrateFromV2: async () => {
          this.recipeBook.migrateFromV2();
          await this.ready;
        },
        load: async () => {
          await this.ready;
          return this.didFallback
            ? this.localFallback.recipeBook.load()
            : this.cache.recipes.map(cloneRecipe);
        },
        save: async recipes => {
          const next = recipes.map(cloneRecipe);
          await this.writeRecipesPrimary(next);
        },
        add: async recipe => {
          const next = this.didFallback
            ? this.localFallback.recipeBook.load()
            : this.cache.recipes.map(cloneRecipe);
          if (next.find(item => item.id === recipe.id)) return false;
          next.unshift(recipe as Recipe);
          await this.writeRecipesPrimary(next);
          return true;
        },
        remove: async id => {
          const next = (this.didFallback ? this.localFallback.recipeBook.load() : this.cache.recipes)
            .filter(recipe => recipe.id !== id)
            .map(cloneRecipe);
          await this.writeRecipesPrimary(next);
        },
        update: async (id, updates) => {
          const source = this.didFallback ? this.localFallback.recipeBook.load() : this.cache.recipes;
          const index = source.findIndex(recipe => recipe.id === id);
          if (index === -1) return false;
          const next = source.map(cloneRecipe);
          next[ index ] = { ...next[ index ], ...updates, id: next[ index ].id };
          await this.writeRecipesPrimary(next);
          return true;
        },
        updateNotes: async (id, notes) => {
          const source = this.didFallback ? this.localFallback.recipeBook.load() : this.cache.recipes;
          const index = source.findIndex(recipe => recipe.id === id);
          if (index === -1) return false;
          const next = source.map(cloneRecipe);
          next[ index ] = { ...next[ index ], notes: notes || '' };
          await this.writeRecipesPrimary(next);
          return true;
        },
        toggleFavorite: async id => {
          const source = this.didFallback ? this.localFallback.recipeBook.load() : this.cache.recipes;
          const index = source.findIndex(recipe => recipe.id === id);
          if (index === -1) return false;
          const next = source.map(cloneRecipe);
          next[ index ] = { ...next[ index ], favorite: !next[ index ].favorite };
          await this.writeRecipesPrimary(next);
          return true;
        },
        markViewed: async id => {
          const source = this.didFallback ? this.localFallback.recipeBook.load() : this.cache.recipes;
          const index = source.findIndex(recipe => recipe.id === id);
          if (index === -1) return false;
          const next = source.map(cloneRecipe);
          next[ index ] = { ...next[ index ], lastViewedAt: Date.now() };
          await this.writeRecipesPrimary(next);
          return true;
        },
        exportBackup: async () => this.localFallback.recipeBook.exportBackup(),
        importBackup: async file => {
          const result = await this.localFallback.recipeBook.importBackup(file);
          this.refreshRecipeCache();
          await this.writeRecipesPrimary(this.cache.recipes);
          return result;
        },
      },
      shoppingList: {
        load: async () => {
          await this.ready;
          return this.didFallback
            ? this.localFallback.shoppingList.load()
            : this.cache.shoppingItems.map(cloneShoppingItem);
        },
        save: async items => {
          await this.writeShoppingPrimary(items.map(cloneShoppingItem));
        },
        add: async (items, recipeMeta) => {
          const added = this.localFallback.shoppingList.add(items, recipeMeta);
          this.refreshShoppingCache();
          await this.writeShoppingPrimary(this.cache.shoppingItems);
          return added;
        },
        addWithScale: async (items, recipeMeta, options) => {
          const added = this.localFallback.shoppingList.addWithScale(items, recipeMeta, options);
          this.refreshShoppingCache();
          await this.writeShoppingPrimary(this.cache.shoppingItems);
          return added;
        },
        removeByRecipe: async recipeId => {
          const removed = this.localFallback.shoppingList.removeByRecipe(recipeId);
          this.refreshShoppingCache();
          await this.writeShoppingPrimary(this.cache.shoppingItems);
          return removed;
        },
        toggleItem: async id => {
          const updated = this.localFallback.shoppingList.toggleItem(id);
          this.refreshShoppingCache();
          await this.writeShoppingPrimary(this.cache.shoppingItems);
          return updated;
        },
        removeItem: async id => {
          const removed = this.localFallback.shoppingList.removeItem(id);
          this.refreshShoppingCache();
          await this.writeShoppingPrimary(this.cache.shoppingItems);
          return removed;
        },
        clear: async () => {
          this.localFallback.shoppingList.clear();
          this.refreshShoppingCache();
          await this.writeShoppingPrimary(this.cache.shoppingItems);
        },
      },
      weeklyPlanner: {
        load: async () => {
          await this.ready;
          return this.didFallback
            ? this.localFallback.weeklyPlanner.load()
            : cloneWeeklyPlanner(this.cache.weeklyPlanner);
        },
        save: async plan => {
          await this.writePlannerPrimary(plan);
        },
        updateSlot: async (day, slot, recipeId) => {
          const next = this.didFallback
            ? this.localFallback.weeklyPlanner.updateSlot(day, slot, recipeId)
            : (() => {
                const updated = cloneWeeklyPlanner(this.cache.weeklyPlanner);
                updated[day][slot] = recipeId && recipeId.trim() ? recipeId.trim() : null;
                return updated;
              })();
          await this.writePlannerPrimary(next);
          return cloneWeeklyPlanner(next);
        },
        clear: async () => {
          await this.writePlannerPrimary(createEmptyWeeklyPlanner());
        },
      },
    };
  }

  private async bootstrap(): Promise<void> {
    const localSnapshot = cloneSnapshot(loadSnapshotFromAdapter(this.localFallback));
    const migrationFlag = await this.db.meta.get(DEXIE_MIGRATION_META_KEY);

    if (migrationFlag?.value === true) {
      const dexieSnapshot = await this.readSnapshotFromDexie();
      if (hasSnapshotData(dexieSnapshot)) {
        this.cache = cloneSnapshot(dexieSnapshot);
        this.localFallback.recipeBook.save(dexieSnapshot.recipes);
        this.localFallback.shoppingList.save(dexieSnapshot.shoppingItems);
        this.localFallback.weeklyPlanner.save(dexieSnapshot.weeklyPlanner);
        return;
      }

      this.cache = localSnapshot;
      if (hasSnapshotData(localSnapshot)) {
        await this.writeSnapshotToDexie(localSnapshot);
      }
      return;
    }

    console.info('Dexie migration started');
    this.cache = localSnapshot;
    await this.writeSnapshotToDexie(localSnapshot);
    await this.db.meta.put({ key: DEXIE_MIGRATION_META_KEY, value: true });
    console.info('Dexie migration completed');
  }

  private refreshRecipeCache(): void {
    this.cache = {
      ...this.cache,
      recipes: this.localFallback.recipeBook.load().map(cloneRecipe),
    };
  }

  private refreshShoppingCache(): void {
    this.cache = {
      ...this.cache,
      shoppingItems: this.localFallback.shoppingList.load().map(cloneShoppingItem),
    };
  }

  private refreshPlannerCache(): void {
    this.cache = {
      ...this.cache,
      weeklyPlanner: cloneWeeklyPlanner(this.localFallback.weeklyPlanner.load()),
    };
  }

  private queueRecipeSync(): void {
    this.queueTask(async () => {
      await this.syncRecipesToDexie(this.cache.recipes);
    });
  }

  private queueShoppingSync(): void {
    this.queueTask(async () => {
      await this.syncShoppingItemsToDexie(this.cache.shoppingItems);
    });
  }

  private queuePlannerSync(): void {
    this.queueTask(async () => {
      await this.syncWeeklyPlannerToDexie(this.cache.weeklyPlanner);
    });
  }

  private queueFullSync(): void {
    this.queueTask(async () => {
      await this.writeSnapshotToDexie(this.cache);
    });
  }

  private queueTask(task: () => Promise<void>): void {
    if (this.didFallback) return;
    this.syncQueue = this.syncQueue
      .then(async () => {
        await this.ready;
        await task();
      })
      .catch(error => {
        this.triggerFallback(error);
      });
  }

  private triggerFallback(error: unknown): void {
    if (this.didFallback) return;
    this.didFallback = true;
    console.info('Dexie fallback to localStorage');
    this.onFallback?.();
    void error;
  }

  private async readSnapshotFromDexie(): Promise<PersistenceSnapshot> {
    try {
      const [ recipes, shoppingItems, plannerRow ] = await Promise.all([
        this.db.recipes.toArray(),
        this.db.shoppingItems.toArray(),
        this.db.weeklyPlanner.get(WEEKLY_PLANNER_ROW_ID),
      ]);

      return {
        recipes: recipes.map(cloneRecipe),
        shoppingItems: shoppingItems.map(cloneShoppingItem),
        weeklyPlanner: normalizeWeeklyPlanner(plannerRow?.plan || createEmptyWeeklyPlanner()),
      };
    } catch (error) {
      throw this.createWriteError('dexie_bootstrap', error);
    }
  }

  private async writeSnapshotToDexie(snapshot: PersistenceSnapshot): Promise<void> {
    const next = cloneSnapshot(snapshot);
    try {
      await this.db.transaction(
        'rw',
        this.db.recipes,
        this.db.shoppingItems,
        this.db.weeklyPlanner,
        async () => {
          await this.db.recipes.clear();
          if (next.recipes.length > 0) await this.db.recipes.bulkPut(next.recipes);

          await this.db.shoppingItems.clear();
          if (next.shoppingItems.length > 0) await this.db.shoppingItems.bulkPut(next.shoppingItems);

          await this.db.weeklyPlanner.put({
            id: WEEKLY_PLANNER_ROW_ID,
            plan: next.weeklyPlanner,
          });
        },
      );
    } catch (error) {
      throw this.createWriteError('dexie_snapshot', error);
    }
  }

  private async syncRecipesToDexie(recipes: Recipe[]): Promise<void> {
    try {
      await this.db.transaction('rw', this.db.recipes, async () => {
        await this.db.recipes.clear();
        if (recipes.length > 0) await this.db.recipes.bulkPut(recipes.map(cloneRecipe));
      });
    } catch (error) {
      throw this.createWriteError('dexie_recipes', error);
    }
  }

  private async syncShoppingItemsToDexie(items: ShoppingItem[]): Promise<void> {
    try {
      await this.db.transaction('rw', this.db.shoppingItems, async () => {
        await this.db.shoppingItems.clear();
        if (items.length > 0) await this.db.shoppingItems.bulkPut(items.map(cloneShoppingItem));
      });
    } catch (error) {
      throw this.createWriteError('dexie_shopping', error);
    }
  }

  private async syncWeeklyPlannerToDexie(plan: WeeklyPlanner): Promise<void> {
    try {
      await this.db.weeklyPlanner.put({
        id: WEEKLY_PLANNER_ROW_ID,
        plan: cloneWeeklyPlanner(plan),
      });
    } catch (error) {
      throw this.createWriteError('dexie_planner', error);
    }
  }

  private async writeRecipesPrimary(recipes: Recipe[]): Promise<void> {
    const next = recipes.map(cloneRecipe);
    await this.ready;
    if (this.didFallback) {
      this.localFallback.recipeBook.save(next);
      this.cache = { ...this.cache, recipes: next };
      return;
    }

    try {
      await this.syncRecipesToDexie(next);
      this.cache = { ...this.cache, recipes: next };
    } catch (error) {
      this.triggerFallback(error);
      this.localFallback.recipeBook.save(next);
      this.cache = { ...this.cache, recipes: next };
      return;
    }

    try {
      this.localFallback.recipeBook.save(next);
    } catch (error) {
      console.warn('[storage] localStorage recipe mirror failed after Dexie write', error);
    }
  }

  private async writeShoppingPrimary(items: ShoppingItem[]): Promise<void> {
    const next = items.map(cloneShoppingItem);
    await this.ready;
    if (this.didFallback) {
      this.localFallback.shoppingList.save(next);
      this.cache = { ...this.cache, shoppingItems: next };
      return;
    }

    try {
      await this.syncShoppingItemsToDexie(next);
      this.cache = { ...this.cache, shoppingItems: next };
    } catch (error) {
      this.triggerFallback(error);
      this.localFallback.shoppingList.save(next);
      this.cache = { ...this.cache, shoppingItems: next };
      return;
    }

    try {
      this.localFallback.shoppingList.save(next);
    } catch (error) {
      console.warn('[storage] localStorage shopping mirror failed after Dexie write', error);
    }
  }

  private async writePlannerPrimary(plan: WeeklyPlanner): Promise<void> {
    const next = cloneWeeklyPlanner(plan);
    await this.ready;
    if (this.didFallback) {
      this.localFallback.weeklyPlanner.save(next);
      this.cache = { ...this.cache, weeklyPlanner: next };
      return;
    }

    try {
      await this.syncWeeklyPlannerToDexie(next);
      this.cache = { ...this.cache, weeklyPlanner: next };
    } catch (error) {
      this.triggerFallback(error);
      this.localFallback.weeklyPlanner.save(next);
      this.cache = { ...this.cache, weeklyPlanner: next };
      return;
    }

    try {
      this.localFallback.weeklyPlanner.save(next);
    } catch (error) {
      console.warn('[storage] localStorage planner mirror failed after Dexie write', error);
    }
  }
}
