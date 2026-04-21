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
  PreparationType,
  Recipe,
  ShoppingItem,
} from '../types';
import {
  getPreparationType,
  normalizePreparationTypeValue,
  scaleShoppingIngredientText,
} from './ingredientUtils';

export const STORAGE_KEY = 'cucina_recipebook_v3';
export const STORAGE_KEY_V2 = 'cucina_ricettario_v2';
export const SHOPPING_LIST_KEY = 'cucina_shopping_list_v1';

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
  difficolta?: string;
};

type RecipeInput = Partial<Recipe> & {
  id?: string;
  nome?: string;
  cat?: string;
  tempo?: string;
  porzioni?: string;
  fonte?: string;
  ingredienti?: string[];
};

type RecipeBookStorageValue = RecipeInput[];
type RecipeMeta = { id?: string; name?: string };
type AddShoppingOptions = { scaleFactor?: number };

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

function isShoppingItem(value: unknown): value is ShoppingItem {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as ShoppingItem).id === 'string'
    && typeof (value as ShoppingItem).text === 'string',
  );
}

function normalizeStoredRecipe(recipe: RecipeInput): Recipe {
  const preparationType = getPreparationType(recipe);
  const id = asString(recipe.id);
  const name = asString(recipe.name ?? recipe.nome);

  const validMealOccasions = [ 'Colazione', 'Pranzo', 'Cena', 'Spuntino' ];
  const mealOccasion = asStringArray(recipe?.mealOccasion).filter(m => validMealOccasions.includes(m));

  return {
    ...recipe,
    id,
    name,
    category: asString(recipe.category ?? recipe.cat),
    time: asString(recipe.time ?? recipe.tempo),
    servings: asString(recipe.servings ?? recipe.porzioni),
    source: asString(recipe.source ?? recipe.fonte, 'web'),
    sourceDomain: recipe.sourceDomain || undefined,
    ingredients: asStringArray(recipe.ingredients ?? recipe.ingredienti),
    steps: asStringArray(recipe.steps),
    timerMinutes: asNumber(recipe.timerMinutes, 0),
    url: asString(recipe.url) || undefined,
    difficolta: asString(recipe.difficolta) || undefined,
    notes: asString(recipe.notes) || undefined,
    preparationType,
    bimby: recipe?.bimby != null ? recipe.bimby : preparationType === 'bimby',
    favorite: Boolean(recipe?.favorite),
    lastViewedAt: recipe?.lastViewedAt || undefined,
    tags: asStringArray(recipe?.tags),
    mealOccasion: mealOccasion.length > 0 ? mealOccasion : undefined,
  };
}

/**
 * One-time migration: v2 (Italian field names) → v3 (English field names).
 */
export function migrateFromV2(): void {
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
      preparationType: normalizePreparationTypeValue(r.preparationType) || (r.bimby ? 'bimby' : 'classic') as PreparationType,
      sourceDomain: r.sourceDomain || undefined,
      ingredients: asStringArray(r.ingredienti || r.ingredients),
      steps: asStringArray(r.steps),
      timerMinutes: r.timerMin !== undefined ? r.timerMin : (r.timerMinutes || 0),
      url: r.url || undefined,
      difficolta: r.difficolta || undefined,
    }));

    saveRecipeBook(migrated as Recipe[]);
    localStorage.removeItem(STORAGE_KEY_V2);
  } catch (e) {
    console.warn('Migration v2→v3 failed:', e);
  }
}

// ── Recipe book CRUD ──────────────────────────────────────────────────────

export function loadRecipeBook(): Recipe[] {
  const arr = parseJson<RecipeBookStorageValue>(localStorage.getItem(STORAGE_KEY) || '[]', []);
  return Array.isArray(arr) ? arr.map(normalizeStoredRecipe) : [];
}

export function saveRecipeBook(arr: Recipe[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((arr || []).map(normalizeStoredRecipe)));
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
}

export function addRecipe(recipe: RecipeInput): boolean {
  const arr = loadRecipeBook();
  if (arr.find(r => r.id === recipe.id)) return false;
  arr.unshift(normalizeStoredRecipe(recipe));
  saveRecipeBook(arr);
  return true;
}

export function deleteRecipe(id: string): void {
  saveRecipeBook(loadRecipeBook().filter(r => r.id !== id));
}

export function updateRecipe(id: string, updates: Partial<Recipe>): boolean {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[ idx ] = normalizeStoredRecipe({ ...arr[ idx ], ...updates, id: arr[ idx ].id });
  saveRecipeBook(arr);
  return true;
}

export function updateRecipeNotes(id: string, notes: string): boolean {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[ idx ] = { ...arr[ idx ], notes: notes || '' };
  saveRecipeBook(arr);
  return true;
}

export function toggleRecipeFavorite(id: string): boolean {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[ idx ].favorite = !arr[ idx ].favorite;
  saveRecipeBook(arr);
  return true;
}

export function markRecipeViewed(id: string): boolean {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[ idx ].lastViewedAt = Date.now();
  saveRecipeBook(arr);
  return true;
}

// ── Recipe book export / import ───────────────────────────────────────────

export function exportRecipeBook(): number {
  const arr = loadRecipeBook();
  const blob = new Blob([ JSON.stringify(arr, null, 2) ], { type: 'application/json' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = 'ricettario_backup.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return arr.length;
}

export function importRecipeBook(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const arr = parseJson<RecipeInput[]>(String(e.target?.result || '[]'), []);
        if (!Array.isArray(arr)) throw new Error('Invalid format');
        const incoming = arr.map(normalizeStoredRecipe);
        const existing = loadRecipeBook();
        const merged = [ ...incoming, ...existing.filter(r => !incoming.find(a => a.id === r.id)) ];
        saveRecipeBook(merged);
        resolve(merged.length);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

// ── Shopping list CRUD ────────────────────────────────────────────────────

export function loadShoppingList(): ShoppingItem[] {
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

export function saveShoppingList(items: ShoppingItem[]): void {
  try {
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(items || []));
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
}

export function addShoppingListItems(items: string[], recipeMeta: RecipeMeta = {}): number {
  const existing = loadShoppingList();
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

  saveShoppingList([ ...existing, ...additions ]);
  return additions.length;
}

export function addShoppingListItemsWithScale(items: string[], recipeMeta: RecipeMeta = {}, options: AddShoppingOptions = {}): number {
  const existing = loadShoppingList();
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

  saveShoppingList([ ...existing, ...additions ]);
  return additions.length;
}

export function removeShoppingListItemsByRecipe(recipeId: string): number {
  if (!recipeId) return 0;
  const items = loadShoppingList();
  const next = items.filter(item => item.sourceRecipeId !== recipeId);
  const removed = items.length - next.length;
  if (removed > 0) saveShoppingList(next);
  return removed;
}

export function toggleShoppingListItem(id: string): boolean {
  const items = loadShoppingList();
  const idx = items.findIndex(item => item.id === id);
  if (idx === -1) return false;
  items[ idx ].checked = !items[ idx ].checked;
  saveShoppingList(items);
  return true;
}

export function removeShoppingListItem(id: string): boolean {
  const items = loadShoppingList();
  const next = items.filter(item => item.id !== id);
  if (next.length === items.length) return false;
  saveShoppingList(next);
  return true;
}

export function clearShoppingList(): void {
  saveShoppingList([]);
}
