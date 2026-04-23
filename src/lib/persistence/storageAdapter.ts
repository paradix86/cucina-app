import type {
  PlannerDayId,
  PlannerMealSlot,
  Recipe,
  ShoppingItem,
  WeeklyPlanner,
} from '../../types';

export type RecipeInput = Partial<Recipe> & {
  id?: string;
  nome?: string;
  cat?: string;
  tempo?: string;
  porzioni?: string;
  fonte?: string;
  ingredienti?: string[];
};

export type RecipeMeta = {
  id?: string;
  name?: string;
};

export type AddShoppingOptions = {
  scaleFactor?: number;
};

export type ImportResult = {
  total: number;
  added: number;
};

export interface RecipeBookStorageArea {
  migrateFromV2(): void;
  load(): Recipe[];
  save(recipes: Recipe[]): void;
  add(recipe: RecipeInput): boolean;
  remove(id: string): void;
  update(id: string, updates: Partial<Recipe>): boolean;
  updateNotes(id: string, notes: string): boolean;
  toggleFavorite(id: string): boolean;
  markViewed(id: string): boolean;
  exportBackup(): number;
  importBackup(file: File): Promise<ImportResult>;
}

export interface ShoppingListStorageArea {
  load(): ShoppingItem[];
  save(items: ShoppingItem[]): void;
  add(items: string[], recipeMeta?: RecipeMeta): number;
  addWithScale(items: string[], recipeMeta?: RecipeMeta, options?: AddShoppingOptions): number;
  removeByRecipe(recipeId: string): number;
  toggleItem(id: string): boolean;
  removeItem(id: string): boolean;
  clear(): void;
}

export interface WeeklyPlannerStorageArea {
  load(): WeeklyPlanner;
  save(plan: WeeklyPlanner): void;
  updateSlot(day: PlannerDayId, slot: PlannerMealSlot, recipeId: string | null): WeeklyPlanner;
  clear(): void;
}

export interface StorageAdapter {
  recipeBook: RecipeBookStorageArea;
  shoppingList: ShoppingListStorageArea;
  weeklyPlanner: WeeklyPlannerStorageArea;
}

// Planned future contract for IndexedDB/Dexie migration. The app still uses the
// synchronous StorageAdapter today; this shape documents the async seam we are
// preparing toward without forcing Promise-based callers yet.
export interface AsyncStorageAdapter {
  recipeBook: {
    migrateFromV2(): Promise<void>;
    load(): Promise<Recipe[]>;
    save(recipes: Recipe[]): Promise<void>;
    add(recipe: RecipeInput): Promise<boolean>;
    remove(id: string): Promise<void>;
    update(id: string, updates: Partial<Recipe>): Promise<boolean>;
    updateNotes(id: string, notes: string): Promise<boolean>;
    toggleFavorite(id: string): Promise<boolean>;
    markViewed(id: string): Promise<boolean>;
    exportBackup(): Promise<number>;
    importBackup(file: File): Promise<ImportResult>;
  };
  shoppingList: {
    load(): Promise<ShoppingItem[]>;
    save(items: ShoppingItem[]): Promise<void>;
    add(items: string[], recipeMeta?: RecipeMeta): Promise<number>;
    addWithScale(items: string[], recipeMeta?: RecipeMeta, options?: AddShoppingOptions): Promise<number>;
    removeByRecipe(recipeId: string): Promise<number>;
    toggleItem(id: string): Promise<boolean>;
    removeItem(id: string): Promise<boolean>;
    clear(): Promise<void>;
  };
  weeklyPlanner: {
    load(): Promise<WeeklyPlanner>;
    save(plan: WeeklyPlanner): Promise<void>;
    updateSlot(day: PlannerDayId, slot: PlannerMealSlot, recipeId: string | null): Promise<WeeklyPlanner>;
    clear(): Promise<void>;
  };
}
