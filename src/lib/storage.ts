/**
 * storage.ts — localStorage persistence layer for recipe book and shopping list.
 *
 * Responsibilities: read, write, migrate, export, import.
 * No ingredient parsing or domain utilities here — see ingredientUtils.ts.
 *
 * Future migration note: replacing this file's load/save functions with
 * IndexedDB, SQLite, or a backend API is the only change needed to swap
 * the persistence backend. The Pinia stores (recipeBook.ts, shoppingList.ts)
 * are the repository layer above this; views should not import from here directly.
 */
import type {
  PlannerDayId,
  PlannerMealSlot,
  PreparationType,
  Recipe,
  ShoppingItem,
  WeeklyPlanner,
} from '../types';
import type {
  AddShoppingOptions,
  AsyncStorageAdapter,
  ImportResult,
  RecipeInput,
  RecipeMeta,
  StorageAdapter,
  StorageAdapterWithAsync,
} from './persistence/storageAdapter';
import { createDexieStorageAdapter } from './persistence/dexieAdapter';
import {
  getPreparationType,
  normalizePreparationTypeValue,
  scaleShoppingIngredientText,
} from './ingredientUtils';
import { createEmptyWeeklyPlanner, normalizeWeeklyPlanner } from './planner';
import {
  normalizeIngredientNutritionArray,
  normalizeRecipeNutrition,
} from './nutrition';

export const STORAGE_KEY = 'cucina_recipebook_v3';
export const STORAGE_KEY_V2 = 'cucina_ricettario_v2';
export const SHOPPING_LIST_KEY = 'cucina_shopping_list_v1';
export const WEEKLY_PLANNER_KEY = 'cucina_weekly_planner_v1';
export const MEAL_COMPOSER_DRAFT_KEY = 'cucina_meal_composer_draft_v1';

type LegacyV2Recipe = {
  id?: string;
  nome?: string;
  name?: string;
  cat?: string;
  category?: string;
  bimby?: boolean;
  emoji?: string;
  tempo?: string;
  time?: string;
  porzioni?: string;
  servings?: string;
  fonte?: string;
  source?: string;
  preparationType?: string;
  sourceDomain?: string;
  ingredienti?: string[];
  ingredients?: string[];
  steps?: string[];
  timerMin?: number;
  timerMinutes?: number;
  url?: string;
  coverImageUrl?: string;
  image?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  difficolta?: string;
};

type RecipeBookStorageValue = RecipeInput[];

export class StorageWriteError extends Error {
  readonly storageKey: string;
  constructor(storageKey: string, cause?: unknown) {
    super(`localStorage write failed for key "${storageKey}"`);
    this.name = 'StorageWriteError';
    this.storageKey = storageKey;
    if (cause != null) this.cause = cause;
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          if (typeof record.text === 'string') return record.text.trim();
          return Object.values(record)
            .filter(v => typeof v === 'string')
            .join(' ')
            .trim();
        }
        return '';
      }).filter(Boolean)
    : [];
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeCoverImageUrl(value: unknown): string {
  const url = asString(value).trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return '';
}

function isShoppingItem(value: unknown): value is ShoppingItem {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as ShoppingItem).id === 'string'
    && typeof (value as ShoppingItem).text === 'string',
  );
}

function normalizeStoredRecipe(recipe: RecipeInput): Recipe {
  const rawSource = asString(recipe.source ?? recipe.fonte, 'web');
  // Legacy data used 'bimby'/'classica'/'classic' as source values (they mean preparation type).
  // Normalize these to 'manual' so source cleanly represents origin only.
  const legacyPrepSource = rawSource === 'bimby' || rawSource === 'classica' || rawSource === 'classic';
  const source = legacyPrepSource ? 'manual' : rawSource;

  // Safety: old recipes with source='bimby' but no explicit preparationType
  const basePreparationType = getPreparationType(recipe);
  const preparationType: import('../types').PreparationType =
    basePreparationType === 'classic' && rawSource === 'bimby' ? 'bimby' : basePreparationType;

  const id = asString(recipe.id);
  const name = asString(recipe.name ?? recipe.nome);
  const coverImageUrl = normalizeCoverImageUrl(
    recipe.coverImageUrl
      ?? (recipe as Record<string, unknown>).image
      ?? (recipe as Record<string, unknown>).imageUrl
      ?? (recipe as Record<string, unknown>).thumbnailUrl,
  );

  const validMealOccasions = [ 'Colazione', 'Pranzo', 'Cena', 'Spuntino' ];
  const mealOccasion = asStringArray(recipe?.mealOccasion).filter(m => validMealOccasions.includes(m));

  const timerMinutes = Math.max(0, Math.floor(asNumber(recipe.timerMinutes, 0)));
  const rawTimerSec = asNumber(recipe.timerSeconds, -1);
  const timerSeconds = rawTimerSec >= 0 ? Math.max(0, Math.floor(rawTimerSec)) : timerMinutes * 60;

  // Map free-text difficolta → typed difficulty if not already set
  let difficulty = (recipe as Record<string, unknown>).difficulty as 'easy' | 'medium' | 'hard' | undefined;
  if (!difficulty && recipe.difficolta) {
    const d = (recipe.difficolta as string).toLowerCase().trim();
    if (d.includes('facil') || d.includes('easy') || d.includes('leicht') || d.includes('fácil') || d.includes('facile')) {
      difficulty = 'easy';
    } else if (d.includes('med') || d.includes('mittel') || d.includes('moyen') || d.includes('medio')) {
      difficulty = 'medium';
    } else if (d.includes('diffic') || d.includes('hard') || d.includes('schwer') || d.includes('difficile') || d.includes('dific')) {
      difficulty = 'hard';
    }
  }

  return {
    ...recipe,
    id,
    name,
    category: asString(recipe.category ?? recipe.cat),
    time: asString(recipe.time ?? recipe.tempo),
    servings: asString(recipe.servings ?? recipe.porzioni),
    source,
    sourceDomain: recipe.sourceDomain || undefined,
    coverImageUrl: coverImageUrl || undefined,
    ingredients: asStringArray(recipe.ingredients ?? recipe.ingredienti),
    steps: asStringArray(recipe.steps),
    timerMinutes,
    timerSeconds,
    url: asString(recipe.url) || undefined,
    difficolta: asString(recipe.difficolta) || undefined,
    difficulty: difficulty || undefined,
    notes: asString(recipe.notes) || undefined,
    preparationType,
    bimby: recipe?.bimby != null ? recipe.bimby : preparationType === 'bimby',
    favorite: Boolean(recipe?.favorite),
    lastViewedAt: recipe?.lastViewedAt || undefined,
    tags: asStringArray(recipe?.tags),
    mealOccasion: mealOccasion.length > 0 ? mealOccasion : undefined,
    importedInfo: recipe.importedInfo ?? undefined,
    nutrition: normalizeRecipeNutrition(recipe.nutrition),
    ingredientNutrition: normalizeIngredientNutritionArray(recipe.ingredientNutrition),
  };
}

/**
 * One-time migration: v2 (Italian field names) → v3 (English field names).
 */
function migrateFromV2WithLocalStorage(): void {
  if (!localStorage.getItem(STORAGE_KEY_V2)) return;
  if (localStorage.getItem(STORAGE_KEY)) return;

  try {
    const arr = parseJson<LegacyV2Recipe[]>(localStorage.getItem(STORAGE_KEY_V2) || '[]', []);
    if (!Array.isArray(arr)) return;

    const migrated = arr.map(r => ({
      id: asString(r.id),
      name: r.nome || r.name || '',
      category: r.cat || r.category || '',
      bimby: r.bimby != null ? r.bimby : false,
      emoji: r.emoji || '🍴',
      time: r.tempo || r.time || '',
      servings: r.porzioni || r.servings || '',
      source: r.fonte || r.source || 'web',
      coverImageUrl: normalizeCoverImageUrl(r.coverImageUrl || r.imageUrl || r.image || r.thumbnailUrl) || undefined,
      preparationType: normalizePreparationTypeValue(r.preparationType) || (r.bimby ? 'bimby' : 'classic') as PreparationType,
      sourceDomain: r.sourceDomain || undefined,
      ingredients: asStringArray(r.ingredienti || r.ingredients),
      steps: asStringArray(r.steps),
      timerMinutes: r.timerMin !== undefined ? r.timerMin : (r.timerMinutes || 0),
      url: r.url || undefined,
      difficolta: r.difficolta || undefined,
    }));

    saveRecipeBookToLocalStorage(migrated as Recipe[]);
    localStorage.removeItem(STORAGE_KEY_V2);
  } catch (e) {
    console.warn('Migration v2→v3 failed:', e);
  }
}

// ── Recipe book CRUD ──────────────────────────────────────────────────────

function loadRecipeBookFromLocalStorage(): Recipe[] {
  const arr = parseJson<RecipeBookStorageValue>(localStorage.getItem(STORAGE_KEY) || '[]', []);
  return Array.isArray(arr) ? arr.map(normalizeStoredRecipe) : [];
}

function saveRecipeBookToLocalStorage(arr: Recipe[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((arr || []).map(normalizeStoredRecipe)));
  } catch (e) {
    console.warn('localStorage write failed:', e);
    throw new StorageWriteError(STORAGE_KEY, e);
  }
}

function addRecipeToLocalStorage(recipe: RecipeInput): boolean {
  const arr = loadRecipeBookFromLocalStorage();
  if (arr.find(r => r.id === recipe.id)) return false;
  arr.unshift(normalizeStoredRecipe(recipe));
  saveRecipeBookToLocalStorage(arr);
  return true;
}

function deleteRecipeFromLocalStorage(id: string): void {
  saveRecipeBookToLocalStorage(loadRecipeBookFromLocalStorage().filter(r => r.id !== id));
}

function updateRecipeInLocalStorage(id: string, updates: Partial<Recipe>): boolean {
  const arr = loadRecipeBookFromLocalStorage();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[ idx ] = normalizeStoredRecipe({ ...arr[ idx ], ...updates, id: arr[ idx ].id });
  saveRecipeBookToLocalStorage(arr);
  return true;
}

function updateRecipeNotesInLocalStorage(id: string, notes: string): boolean {
  const arr = loadRecipeBookFromLocalStorage();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[ idx ] = { ...arr[ idx ], notes: notes || '' };
  saveRecipeBookToLocalStorage(arr);
  return true;
}

function toggleRecipeFavoriteInLocalStorage(id: string): boolean {
  const arr = loadRecipeBookFromLocalStorage();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[ idx ].favorite = !arr[ idx ].favorite;
  saveRecipeBookToLocalStorage(arr);
  return true;
}

function markRecipeViewedInLocalStorage(id: string): boolean {
  const arr = loadRecipeBookFromLocalStorage();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[ idx ].lastViewedAt = Date.now();
  saveRecipeBookToLocalStorage(arr);
  return true;
}

// ── Recipe book export / import ───────────────────────────────────────────

function exportRecipeBookFromLocalStorage(): number {
  const arr = loadRecipeBookFromLocalStorage();
  const blob = new Blob([ JSON.stringify(arr, null, 2) ], { type: 'application/json' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `cucina_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return arr.length;
}

function importRecipeBookFromLocalStorage(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const arr = parseJson<RecipeInput[]>(String(e.target?.result || '[]'), []);
        if (!Array.isArray(arr)) throw new Error('Invalid format');
        const incoming = arr.map(normalizeStoredRecipe);
        const existing = loadRecipeBookFromLocalStorage();
        const existingIds = new Set(existing.map(r => r.id));
        const added = incoming.filter(r => !existingIds.has(r.id)).length;
        // Full restore: imported backup snapshot replaces current recipe book state.
        saveRecipeBookToLocalStorage(incoming);
        resolve({ total: incoming.length, added });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

// ── Shopping list CRUD ────────────────────────────────────────────────────

function loadShoppingListFromLocalStorage(): ShoppingItem[] {
  const arr = parseJson<unknown[]>(localStorage.getItem(SHOPPING_LIST_KEY) || '[]', []);
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(isShoppingItem)
    .map(item => ({
      ...item,
      checked: Boolean(item.checked),
      sourceRecipeId: asString(item.sourceRecipeId) || undefined,
      sourceRecipeName: asString(item.sourceRecipeName) || undefined,
      createdAt: asNumber(item.createdAt, Date.now()),
    }));
}

function saveShoppingListToLocalStorage(items: ShoppingItem[]): void {
  try {
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(items || []));
  } catch (e) {
    console.warn('localStorage write failed:', e);
    throw new StorageWriteError(SHOPPING_LIST_KEY, e);
  }
}

// ── Weekly planner CRUD ───────────────────────────────────────────────────

function loadWeeklyPlannerFromLocalStorage(): WeeklyPlanner {
  const raw = parseJson<unknown>(localStorage.getItem(WEEKLY_PLANNER_KEY) || '{}', {});
  return normalizeWeeklyPlanner(raw);
}

function saveWeeklyPlannerToLocalStorage(plan: WeeklyPlanner): void {
  try {
    localStorage.setItem(WEEKLY_PLANNER_KEY, JSON.stringify(normalizeWeeklyPlanner(plan)));
  } catch (e) {
    console.warn('localStorage write failed:', e);
    throw new StorageWriteError(WEEKLY_PLANNER_KEY, e);
  }
}

function updateWeeklyPlannerSlotInLocalStorage(day: PlannerDayId, slot: PlannerMealSlot, recipeId: string | null): WeeklyPlanner {
  const current = loadWeeklyPlannerFromLocalStorage();
  current[day][slot] = recipeId && recipeId.trim() ? recipeId.trim() : null;
  saveWeeklyPlannerToLocalStorage(current);
  return current;
}

function clearWeeklyPlannerInLocalStorage(): void {
  saveWeeklyPlannerToLocalStorage(createEmptyWeeklyPlanner());
}

function addShoppingListItemsToLocalStorage(items: string[], recipeMeta: RecipeMeta = {}): number {
  const existing = loadShoppingListFromLocalStorage();
  const timestamp = Date.now();
  const additions = (items || [])
    .filter(Boolean)
    .map((text, index) => ({
      id: `shop-${timestamp}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      text: String(text).trim(),
      checked: false,
      sourceRecipeId: recipeMeta.id || undefined,
      sourceRecipeName: recipeMeta.name || undefined,
      createdAt: timestamp,
    }))
    .filter(item => item.text) as ShoppingItem[];

  saveShoppingListToLocalStorage([ ...existing, ...additions ]);
  return additions.length;
}

function addShoppingListItemsWithScaleToLocalStorage(items: string[], recipeMeta: RecipeMeta = {}, options: AddShoppingOptions = {}): number {
  const existing = loadShoppingListFromLocalStorage();
  const timestamp = Date.now();
  const factor = Number.isFinite(options.scaleFactor) && (options.scaleFactor || 0) > 0 ? Number(options.scaleFactor) : 1;
  const additions = (items || [])
    .map((text, index) => ({
      id: `shop-${timestamp}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      text: scaleShoppingIngredientText(String(text), factor),
      checked: false,
      sourceRecipeId: recipeMeta.id || undefined,
      sourceRecipeName: recipeMeta.name || undefined,
      createdAt: timestamp,
    }))
    .filter(item => item.text) as ShoppingItem[];

  saveShoppingListToLocalStorage([ ...existing, ...additions ]);
  return additions.length;
}

function removeShoppingListItemsByRecipeFromLocalStorage(recipeId: string): number {
  if (!recipeId) return 0;
  const items = loadShoppingListFromLocalStorage();
  const next = items.filter(item => item.sourceRecipeId !== recipeId);
  const removed = items.length - next.length;
  if (removed > 0) saveShoppingListToLocalStorage(next);
  return removed;
}

function toggleShoppingListItemInLocalStorage(id: string): boolean {
  const items = loadShoppingListFromLocalStorage();
  const idx = items.findIndex(item => item.id === id);
  if (idx === -1) return false;
  items[ idx ].checked = !items[ idx ].checked;
  saveShoppingListToLocalStorage(items);
  return true;
}

function removeShoppingListItemFromLocalStorage(id: string): boolean {
  const items = loadShoppingListFromLocalStorage();
  const next = items.filter(item => item.id !== id);
  if (next.length === items.length) return false;
  saveShoppingListToLocalStorage(next);
  return true;
}

function clearShoppingListInLocalStorage(): void {
  saveShoppingListToLocalStorage([]);
}

function createLocalStorageAdapter(): StorageAdapter {
  return {
    recipeBook: {
      migrateFromV2: migrateFromV2WithLocalStorage,
      load: loadRecipeBookFromLocalStorage,
      save: saveRecipeBookToLocalStorage,
      add: addRecipeToLocalStorage,
      remove: deleteRecipeFromLocalStorage,
      update: updateRecipeInLocalStorage,
      updateNotes: updateRecipeNotesInLocalStorage,
      toggleFavorite: toggleRecipeFavoriteInLocalStorage,
      markViewed: markRecipeViewedInLocalStorage,
      exportBackup: exportRecipeBookFromLocalStorage,
      importBackup: importRecipeBookFromLocalStorage,
    },
    shoppingList: {
      load: loadShoppingListFromLocalStorage,
      save: saveShoppingListToLocalStorage,
      add: addShoppingListItemsToLocalStorage,
      addWithScale: addShoppingListItemsWithScaleToLocalStorage,
      removeByRecipe: removeShoppingListItemsByRecipeFromLocalStorage,
      toggleItem: toggleShoppingListItemInLocalStorage,
      removeItem: removeShoppingListItemFromLocalStorage,
      clear: clearShoppingListInLocalStorage,
    },
    weeklyPlanner: {
      load: loadWeeklyPlannerFromLocalStorage,
      save: saveWeeklyPlannerToLocalStorage,
      updateSlot: updateWeeklyPlannerSlotInLocalStorage,
      clear: clearWeeklyPlannerInLocalStorage,
    },
  };
}

const defaultLocalStorageAdapter = createLocalStorageAdapter();

let activeStorageAdapter: StorageAdapter = defaultLocalStorageAdapter;
let storageAdapterResolved = false;
let storageBootstrapPromise: Promise<void> = Promise.resolve();

function createAsyncAdapterFromSync(adapter: StorageAdapter): AsyncStorageAdapter {
  return {
    recipeBook: {
      migrateFromV2: async () => adapter.recipeBook.migrateFromV2(),
      load: async () => adapter.recipeBook.load(),
      save: async recipes => adapter.recipeBook.save(recipes),
      add: async recipe => adapter.recipeBook.add(recipe),
      remove: async id => adapter.recipeBook.remove(id),
      update: async (id, updates) => adapter.recipeBook.update(id, updates),
      updateNotes: async (id, notes) => adapter.recipeBook.updateNotes(id, notes),
      toggleFavorite: async id => adapter.recipeBook.toggleFavorite(id),
      markViewed: async id => adapter.recipeBook.markViewed(id),
      exportBackup: async () => adapter.recipeBook.exportBackup(),
      importBackup: async file => adapter.recipeBook.importBackup(file),
    },
    shoppingList: {
      load: async () => adapter.shoppingList.load(),
      save: async items => adapter.shoppingList.save(items),
      add: async (items, recipeMeta) => adapter.shoppingList.add(items, recipeMeta),
      addWithScale: async (items, recipeMeta, options) => adapter.shoppingList.addWithScale(items, recipeMeta, options),
      removeByRecipe: async recipeId => adapter.shoppingList.removeByRecipe(recipeId),
      toggleItem: async id => adapter.shoppingList.toggleItem(id),
      removeItem: async id => adapter.shoppingList.removeItem(id),
      clear: async () => adapter.shoppingList.clear(),
    },
    weeklyPlanner: {
      load: async () => adapter.weeklyPlanner.load(),
      save: async plan => adapter.weeklyPlanner.save(plan),
      updateSlot: async (day, slot, recipeId) => adapter.weeklyPlanner.updateSlot(day, slot, recipeId),
      clear: async () => adapter.weeklyPlanner.clear(),
    },
  };
}

function getAsyncStorageAdapter(): AsyncStorageAdapter {
  const adapter = getStorageAdapter() as StorageAdapterWithAsync;
  return adapter.async || createAsyncAdapterFromSync(adapter);
}

function ensureActiveStorageAdapter(): StorageAdapter {
  if (storageAdapterResolved) return activeStorageAdapter;

  storageAdapterResolved = true;
  activeStorageAdapter = defaultLocalStorageAdapter;

  const dexieAdapter = createDexieStorageAdapter({
    localFallback: defaultLocalStorageAdapter,
    createWriteError: (storageKey, cause) => new StorageWriteError(storageKey, cause),
    onFallback: () => {
      activeStorageAdapter = defaultLocalStorageAdapter;
    },
  });

  if (!dexieAdapter) {
    console.info('Dexie fallback to localStorage');
    return activeStorageAdapter;
  }

  activeStorageAdapter = dexieAdapter;
  storageBootstrapPromise = dexieAdapter.ready.catch(() => undefined);
  return activeStorageAdapter;
}

export function getStorageAdapter(): StorageAdapter {
  return ensureActiveStorageAdapter();
}

export function setStorageAdapter(adapter: StorageAdapter): void {
  storageAdapterResolved = true;
  activeStorageAdapter = adapter;
  storageBootstrapPromise = Promise.resolve();
}

export function resetStorageAdapter(): void {
  storageAdapterResolved = false;
  activeStorageAdapter = defaultLocalStorageAdapter;
  storageBootstrapPromise = Promise.resolve();
}

export function waitForStorageBootstrap(): Promise<void> {
  ensureActiveStorageAdapter();
  return storageBootstrapPromise;
}

export async function loadRecipeBookAsync(): Promise<Recipe[]> {
  await waitForStorageBootstrap();
  return getAsyncStorageAdapter().recipeBook.load();
}

export async function saveRecipeBookAsync(arr: Recipe[]): Promise<void> {
  await waitForStorageBootstrap();
  return getAsyncStorageAdapter().recipeBook.save(arr);
}

export async function loadShoppingListAsync(): Promise<ShoppingItem[]> {
  await waitForStorageBootstrap();
  return getAsyncStorageAdapter().shoppingList.load();
}

export async function saveShoppingListAsync(items: ShoppingItem[]): Promise<void> {
  await waitForStorageBootstrap();
  return getAsyncStorageAdapter().shoppingList.save(items);
}

export async function loadWeeklyPlannerAsync(): Promise<WeeklyPlanner> {
  await waitForStorageBootstrap();
  return getAsyncStorageAdapter().weeklyPlanner.load();
}

export async function saveWeeklyPlannerAsync(plan: WeeklyPlanner): Promise<void> {
  await waitForStorageBootstrap();
  return getAsyncStorageAdapter().weeklyPlanner.save(plan);
}

export function migrateFromV2(): void {
  getStorageAdapter().recipeBook.migrateFromV2();
}

export function loadRecipeBook(): Recipe[] {
  return getStorageAdapter().recipeBook.load();
}

export function saveRecipeBook(arr: Recipe[]): void {
  getStorageAdapter().recipeBook.save(arr);
}

export function addRecipe(recipe: RecipeInput): boolean {
  return getStorageAdapter().recipeBook.add(recipe);
}

export function deleteRecipe(id: string): void {
  getStorageAdapter().recipeBook.remove(id);
}

export function updateRecipe(id: string, updates: Partial<Recipe>): boolean {
  return getStorageAdapter().recipeBook.update(id, updates);
}

export function updateRecipeNotes(id: string, notes: string): boolean {
  return getStorageAdapter().recipeBook.updateNotes(id, notes);
}

export function toggleRecipeFavorite(id: string): boolean {
  return getStorageAdapter().recipeBook.toggleFavorite(id);
}

export function markRecipeViewed(id: string): boolean {
  return getStorageAdapter().recipeBook.markViewed(id);
}

export function exportRecipeBook(): number {
  return getStorageAdapter().recipeBook.exportBackup();
}

export function importRecipeBook(file: File): Promise<ImportResult> {
  return getStorageAdapter().recipeBook.importBackup(file);
}

export function loadShoppingList(): ShoppingItem[] {
  return getStorageAdapter().shoppingList.load();
}

export function saveShoppingList(items: ShoppingItem[]): void {
  getStorageAdapter().shoppingList.save(items);
}

export function loadWeeklyPlanner(): WeeklyPlanner {
  return getStorageAdapter().weeklyPlanner.load();
}

export function saveWeeklyPlanner(plan: WeeklyPlanner): void {
  getStorageAdapter().weeklyPlanner.save(plan);
}

export function updateWeeklyPlannerSlot(day: PlannerDayId, slot: PlannerMealSlot, recipeId: string | null): WeeklyPlanner {
  return getStorageAdapter().weeklyPlanner.updateSlot(day, slot, recipeId);
}

export function clearWeeklyPlanner(): void {
  getStorageAdapter().weeklyPlanner.clear();
}

export function addShoppingListItems(items: string[], recipeMeta: RecipeMeta = {}): number {
  return getStorageAdapter().shoppingList.add(items, recipeMeta);
}

export function addShoppingListItemsWithScale(items: string[], recipeMeta: RecipeMeta = {}, options: AddShoppingOptions = {}): number {
  return getStorageAdapter().shoppingList.addWithScale(items, recipeMeta, options);
}

export function removeShoppingListItemsByRecipe(recipeId: string): number {
  return getStorageAdapter().shoppingList.removeByRecipe(recipeId);
}

export function toggleShoppingListItem(id: string): boolean {
  return getStorageAdapter().shoppingList.toggleItem(id);
}

export function removeShoppingListItem(id: string): boolean {
  return getStorageAdapter().shoppingList.removeItem(id);
}

export function clearShoppingList(): void {
  getStorageAdapter().shoppingList.clear();
}
