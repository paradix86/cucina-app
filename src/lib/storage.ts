/**
 * storage.js — Personal recipe book management via localStorage
 */
import type {
  GroupedShoppingItemsResult,
  ParsedIngredient,
  ParsedIngredientUnit,
  PreparationType,
  Recipe,
  ShoppingGroup,
  ShoppingItem,
  ShoppingSectionId,
} from '../types';

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
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
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

export function normalizePreparationTypeValue(value: unknown): PreparationType | '' {
  return ['classic', 'bimby', 'airfryer'].includes(String(value)) ? (value as PreparationType) : '';
}

export function getPreparationType(recipe: Partial<RecipeInput> | null | undefined): PreparationType {
  const explicit = normalizePreparationTypeValue(recipe?.preparationType);
  if (explicit) return explicit;
  if (recipe?.bimby === true) return 'bimby';
  return 'classic';
}

function normalizeStoredRecipe(recipe: RecipeInput): Recipe {
  const preparationType = getPreparationType(recipe);
  const id = asString(recipe.id);
  const name = asString(recipe.name ?? recipe.nome);
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
  };
}

/**
 * One-time migration: v2 (Italian field names) → v3 (English field names).
 * Called once from app.js before any render.
 */
export function migrateFromV2(): void {
  if (!localStorage.getItem(STORAGE_KEY_V2)) return;   // nothing to migrate
  if (localStorage.getItem(STORAGE_KEY)) return;   // v3 already exists

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
      preparationType: normalizePreparationTypeValue(r.preparationType) || (r.bimby ? 'bimby' : 'classic'),
      sourceDomain: r.sourceDomain || undefined,
      ingredients: asStringArray(r.ingredienti || r.ingredients),
      steps: asStringArray(r.steps),
      timerMinutes: r.timerMin !== undefined ? r.timerMin : (r.timerMinutes || 0),
      url: r.url || undefined,
      difficolta: r.difficolta || undefined,
    }));

    saveRecipeBook(migrated);
    localStorage.removeItem(STORAGE_KEY_V2);
  } catch (e) {
    console.warn('Migration v2→v3 failed:', e);
  }
}

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

  arr[idx] = normalizeStoredRecipe({
    ...arr[idx],
    ...updates,
    id: arr[idx].id,
  });
  saveRecipeBook(arr);
  return true;
}

export function updateRecipeNotes(id: string, notes: string): boolean {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[idx] = { ...arr[idx], notes: notes || '' };
  saveRecipeBook(arr);
  return true;
}

export function toggleRecipeFavorite(id: string): boolean {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[idx].favorite = !arr[idx].favorite;
  saveRecipeBook(arr);
  return true;
}

export function markRecipeViewed(id: string): boolean {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[idx].lastViewedAt = Date.now();
  saveRecipeBook(arr);
  return true;
}

export function exportRecipeBook(): number {
  const arr = loadRecipeBook();
  const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
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
        const merged = [...incoming, ...existing.filter(r => !incoming.find(a => a.id === r.id))];
        saveRecipeBook(merged);
        resolve(merged.length);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

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

  const next = [...existing, ...additions];
  saveShoppingList(next);
  return additions.length;
}

function normalizeShoppingIngredientText(text: string): string {
  const cleaned = String(text || '')
    .replace(/^[\-\*\u2022]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:;,]$/, '')
    .trim();

  if (!cleaned) return '';
  // Skip heading-like pseudo ingredients
  if (/^per\s+(?:la|il|lo|l'|i|gli|le)\b/i.test(cleaned)) return '';

  // Normalize common parenthetical quantity note layout
  const parenQty = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*\(([^)]+)\)\s+(.+)$/i);
  if (parenQty) {
    return `${parenQty[1]} ${parenQty[3]} (${parenQty[2]})`.replace(/\s+/g, ' ').trim();
  }
  return cleaned;
}

function scaleParsedIngredient(parsed: ParsedIngredient, factor: number): string {
  const qty = parsed.parsedQty || 0;
  const scaledQty = qty * factor;
  const unit = parsed.parsedUnit;
  const name = parsed.parsedName || '';
  if (!unit || !name || !scaledQty) return parsed.raw;

  if (unit === 'g' || unit === 'kg') {
    const base = unit === 'kg' ? scaledQty * 1000 : scaledQty;
    if (base >= 1000) return `${formatQuantity(base / 1000)} kg ${name}`.trim();
    return `${formatQuantity(base)} g ${name}`.trim();
  }
  if (unit === 'ml' || unit === 'l') {
    const base = unit === 'l' ? scaledQty * 1000 : scaledQty;
    if (base >= 1000) return `${formatQuantity(base / 1000)} l ${name}`.trim();
    return `${formatQuantity(base)} ml ${name}`.trim();
  }
  if (unit === 'eggs') return `${formatQuantity(scaledQty)} eggs`.trim();
  if (unit === 'pieces') return `${formatQuantity(scaledQty)} ${name}`.trim();
  return `${formatQuantity(scaledQty)} ${unit} ${name}`.trim();
}

function scaleShoppingIngredientText(text: string, factor: number): string {
  const normalized = normalizeShoppingIngredientText(text);
  if (!normalized) return '';
  if (factor === 1) return normalized;

  const parsed = parseIngredient(normalized);
  if (parsed.confidence === 'high' && parsed.parsedQty && parsed.parsedUnit) {
    return scaleParsedIngredient(parsed, factor);
  }
  return normalized;
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

  const next = [...existing, ...additions];
  saveShoppingList(next);
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
  items[idx].checked = !items[idx].checked;
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

/**
 * ================================================================
 * SHOPPING LIST GROUPING & PARSING
 * ================================================================
 *
 * Conservative ingredient parser and grouping system.
 * Only merges when confidence is HIGH.
 */

/**
 * Parse an ingredient string into { quantity, unit, name, confidence, raw }.
 *
 * Matched patterns:
 *   "500 g chicken"     → { quantity: 500, unit: 'g', name: 'chicken', confidence: 'high' }
 *   "1 kg potatoes"     → { quantity: 1, unit: 'kg', name: 'potatoes', confidence: 'high' }
 *   "200 ml milk"       → { quantity: 200, unit: 'ml', name: 'milk', confidence: 'high' }
 *   "2 eggs"            → { quantity: 2, unit: 'eggs', name: 'eggs', confidence: 'high' }
 *   "chicken meat q.b." → { confidence: 'low' } (vague, not merged)
 *   "olive oil"         → { confidence: 'low' } (no quantity)
 */
export function parseIngredient(text: string): ParsedIngredient {
  if (!text) return { confidence: 'low', raw: String(text || ''), parsedQty: null, parsedUnit: null, parsedName: null };

  const trimmed = normalizeShoppingIngredientText(String(text));
  const result: ParsedIngredient = { raw: trimmed, parsedQty: null, parsedUnit: null, parsedName: null, confidence: 'low' };
  if (!trimmed) return result;

  // Reject vague measures
  if (/\b(q\.b|to\s*taste|q\.s|quanto\s*basta|asporto|a\s*piacere|as\s*needed)\b/i.test(trimmed)) {
    return result;
  }

  // Try to match: QUANTITY UNIT NAME
  // e.g., "500 g chicken" or "2 eggs"
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z°º]+)\s+(.+)$/);
  if (match) {
    const qtyStr = match[1].replace(',', '.');
    const unitRaw = match[2].toLowerCase();
    const nameRaw = match[3].trim();

    const qty = parseFloat(qtyStr);
    if (!isNaN(qty) && qty > 0) {
      // Normalize unit
      const normalizedUnit = normalizeUnit(unitRaw);
      if (normalizedUnit) {
        result.parsedQty = qty;
        result.parsedUnit = normalizedUnit;
        result.parsedName = normalizeName(nameRaw);
        result.confidence = 'high';
      }
    }
  }

  // Fallback: quantity + name (without explicit unit), only for clear countables
  const noUnitMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (noUnitMatch) {
    const qty = parseFloat(noUnitMatch[1].replace(',', '.'));
    const nameRaw = normalizeName(noUnitMatch[2]);
    if (!isNaN(qty) && qty > 0 && /^(uov|egg|limon|patat|cipoll|spicch|clove|banana|mela|arancia|pera|carota|zucchin)/i.test(nameRaw)) {
      result.parsedQty = qty;
      result.parsedUnit = 'pieces';
      result.parsedName = nameRaw;
      result.confidence = 'high';
    }
  }

  return result;
}

/**
 * Normalize unit string to a canonical form.
 * Returns null if unit is not recognized.
 *
 * Supported canonical units: g, kg, ml, l, eggs, pieces
 */
function normalizeUnit(unit: string): ParsedIngredientUnit | null {
  if (!unit) return null;
  const u = String(unit).toLowerCase().trim();

  // Weight
  if (['g', 'gr', 'gram', 'grams', 'grammi'].includes(u)) return 'g';
  if (['kg', 'chilogrammi', 'kilogram', 'kilograms'].includes(u)) return 'kg';

  // Volume
  if (['ml', 'millilitre', 'milliliter', 'millilitri'].includes(u)) return 'ml';
  if (['l', 'litre', 'liter', 'litri'].includes(u)) return 'l';

  // Countable
  if (['uova', 'egg', 'eggs', 'uove'].includes(u)) return 'eggs';
  if (['pezzo', 'pezzi', 'piece', 'pieces'].includes(u)) return 'pieces';

  return null;
}

/**
 * Normalize ingredient name for comparison.
 * Lowercase, trim, remove common articles/suffixes.
 */
function normalizeName(name: string): string {
  if (!name) return '';
  let n = String(name).toLowerCase().trim();
  // Remove common suffixes
  n = n.replace(/\s+(fresco|congelato|secco|in\s+polvere|macinato)$/i, '');
  return n;
}

/**
 * Convert quantity to base units for comparison/sum.
 * Returns quantity in base units: g for weight, ml for volume, items for countable.
 */
function toBaseUnits(qty: number | null, unit: ParsedIngredientUnit | null): number | null {
  if (qty == null || unit == null) return null;
  switch (unit) {
    case 'g': return qty;
    case 'kg': return qty * 1000;
    case 'ml': return qty;
    case 'l': return qty * 1000;
    case 'eggs': return qty;
    case 'pieces': return qty;
    default: return null;
  }
}

/**
 * Convert base units back to display-friendly unit.
 * Prefers kg over g if >= 1000g, l over ml if >= 1000ml.
 */
function fromBaseUnits(baseQty: number, unit: ParsedIngredientUnit): { qty: number; unit: ParsedIngredientUnit } {
  if (!unit) return { qty: baseQty, unit };

  if (unit === 'g' || unit === 'kg') {
    if (baseQty >= 1000) {
      return { qty: baseQty / 1000, unit: 'kg' };
    }
    return { qty: baseQty, unit: 'g' };
  }

  if (unit === 'ml' || unit === 'l') {
    if (baseQty >= 1000) {
      return { qty: baseQty / 1000, unit: 'l' };
    }
    return { qty: baseQty, unit: 'ml' };
  }

  return { qty: baseQty, unit };
}

/**
 * Format a quantity nicely for display.
 */
export function formatQuantity(qty: number): string {
  if (qty === Math.floor(qty)) return String(Math.floor(qty));
  return qty.toFixed(1).replace(/\.0$/, '');
}

/**
 * ================================================================
 * SHOPPING LIST SECTIONS
 * ================================================================
 *
 * Conservative section assignment for cooking-oriented grouping.
 * Six practical categories aligned with how real meals are built.
 */

export const SHOPPING_SECTIONS: ShoppingSectionId[] = [
  'proteins',
  'carbs',
  'vegetables_fruit',
  'dairy_eggs',
  'fats_oils_spices',
  'other'
];

const SECTION_ORDER = {
  'proteins': 0,
  'carbs': 1,
  'vegetables_fruit': 2,
  'dairy_eggs': 3,
  'fats_oils_spices': 4,
  'other': 5,
};

/**
 * Keyword lists for each section.
 * Used for conservative categorization.
 */
const SECTION_KEYWORDS: Record<ShoppingSectionId, string[]> = {
  'proteins': [
    'chicken', 'pollo', 'beef', 'manzo', 'pork', 'maiale', 'lamb', 'agnello',
    'turkey', 'tacchino', 'duck', 'anatra', 'ham', 'prosciutto', 'bacon', 'pancetta',
    'sausage', 'salsiccia', 'fish', 'pesce', 'salmon', 'salmone', 'tuna', 'tonno',
    'cod', 'merluzzo', 'shrimp', 'gamberetto', 'prawn', 'squid', 'calamaro',
    'mussels', 'cozze', 'clams', 'vongole', 'scallop', 'capasanta',
    'tofu', 'lentil', 'lenticchia', 'chickpea', 'cece',
  ],
  'carbs': [
    'pasta', 'rice', 'riso', 'couscous', 'barley', 'orzo', 'quinoa', 'polenta',
    'bread', 'pane', 'oat', 'avena', 'bulgur', 'noodle', 'spaghetti', 'penne',
    'fusilli', 'rigatoni', 'lasagna', 'ravioli', 'gnocchi',
    'potato', 'patata', 'cracker',
  ],
  'vegetables_fruit': [
    'carrot', 'carota', 'onion', 'cipolla', 'garlic', 'aglio',
    'tomato', 'pomodoro', 'pomodori', 'pelati', 'lettuce', 'lattuga', 'spinach', 'spinaci', 'broccoli',
    'cabbage', 'cavolo', 'zucchini', 'zucca', 'peperone', 'eggplant', 'melanzana',
    'banana', 'apple', 'mela', 'orange', 'arancia', 'lemon', 'limone', 'limoni',
    'strawberry', 'fragola', 'blueberry', 'mirtillo', 'grape', 'uva', 'pear', 'pera',
    'cucumber', 'cetriolo', 'pumpkin', 'bean', 'fagiolo', 'pea', 'pisello',
    'artichoke', 'carciofo', 'asparagus', 'asparago', 'radish', 'ravanello',
    'leek', 'porro', 'celery', 'sedano', 'fennel', 'finocchio', 'mushroom', 'fungo',
  ],
  'dairy_eggs': [
    'milk', 'latte', 'butter', 'burro', 'yogurt', 'cheese', 'formaggio', 'cheddar',
    'mozzarella', 'parmesan', 'parmigiano', 'pecorino', 'gorgonzola', 'ricotta',
    'cream', 'panna', 'mascarpone', 'feta', 'gouda', 'emmental',
    'egg', 'uovo', 'uova',
  ],
  'fats_oils_spices': [
    'salt', 'sale', 'pepper', 'pepe', 'paprika', 'peperoncino', 'cumin', 'cumino',
    'turmeric', 'curcuma', 'cinnamon', 'cannella', 'oregano', 'origano', 'basil',
    'basilico', 'thyme', 'timo', 'rosemary', 'rosmarino', 'parsley', 'prezzemolo',
    'oil', 'olio', 'vinegar', 'aceto', 'sugar', 'zucchero', 'honey', 'miele',
    'baking powder', 'lievito', 'baking soda', 'bicarbonato', 'vanilla', 'vaniglia',
    'flour', 'farina', 'lard', 'strutto', 'margarine',
  ],
  'other': [],
};

/**
 * Return true when `keyword` matches `normalized` as a whole word
 * or as a word-prefix (handling plurals: "potatoes" matches "potato").
 */
function _keywordMatches(normalized, keyword) {
  if (normalized === keyword) return true;
  // keyword appears at start followed by space
  if (normalized.startsWith(keyword + ' ')) return true;
  // keyword appears after a space (word boundary mid-string or end)
  if (normalized.includes(' ' + keyword + ' ') || normalized.endsWith(' ' + keyword)) return true;
  // keyword is a prefix of the name followed by a common plural/inflection suffix
  if (normalized.startsWith(keyword)) {
    const rest = normalized.slice(keyword.length);
    if (/^(s|es|i|e|\s|$)/.test(rest)) return true;
  }
  return false;
}

/**
 * Assign a section to an ingredient name.
 * Uses keyword matching with fallback to 'other'.
 */
export function assignSection(ingredientName: string): ShoppingSectionId {
  if (!ingredientName) return 'other';

  const normalized = String(ingredientName).toLowerCase().trim();

  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS) as Array<[ShoppingSectionId, string[]]>) {
    for (const keyword of keywords) {
      if (_keywordMatches(normalized, keyword)) return section;
    }
  }

  return 'other';
}

/**
 * Get i18n key for a section ID.
 */
export function getSectionI18nKey(sectionId: ShoppingSectionId): string {
  const keys = {
    'proteins': 'section_proteins',
    'carbs': 'section_carbs',
    'vegetables_fruit': 'section_vegetables_fruit',
    'dairy_eggs': 'section_dairy_eggs',
    'fats_oils_spices': 'section_fats_oils_spices',
    'other': 'section_other',
  };
  return keys[sectionId] || 'section_other';
}
export function groupShoppingItems(items: ShoppingItem[]): GroupedShoppingItemsResult {
  if (!Array.isArray(items)) return { grouped: [], ungrouped: [] };

  const parseResults = items.map(item => ({
    ...item,
    parsed: parseIngredient(item.text),
  }));

  type NumericAccumulator = {
    groupType: 'numeric';
    groupKey: string;
    name: string;
    unit: ParsedIngredientUnit;
    items: ShoppingItem[];
    baseTotal: number;
  };
  type ExactAccumulator = {
    groupType: 'exact';
    groupKey: string;
    baseName: string;
    displayName: string;
    items: ShoppingItem[];
  };

  const numericGroups: Record<string, NumericAccumulator> = {};
  const exactGroups: Record<string, ExactAccumulator> = {};
  const ungrouped: ShoppingItem[] = [];

  parseResults.forEach(item => {
    const parsed = item.parsed;
    if (parsed.confidence === 'high' && parsed.parsedName && parsed.parsedUnit) {
      const key = `${parsed.parsedName}__${parsed.parsedUnit}`;
      if (!numericGroups[key]) {
        numericGroups[key] = {
          groupType: 'numeric',
          groupKey: key,
          name: parsed.parsedName,
          unit: parsed.parsedUnit,
          items: [],
          baseTotal: 0,
        };
      }
      const baseQty = toBaseUnits(parsed.parsedQty, parsed.parsedUnit) || 0;
      numericGroups[key].baseTotal += baseQty;
      numericGroups[key].items.push(item);
    } else {
      const exactKey = normalizeName(item.text);
      if (!exactKey) {
        ungrouped.push(item);
        return;
      }
      if (!exactGroups[exactKey]) {
        exactGroups[exactKey] = {
          groupType: 'exact',
          groupKey: `exact__${exactKey}`,
          baseName: exactKey,
          displayName: String(item.text).trim(),
          items: [],
        };
      }
      exactGroups[exactKey].items.push(item);
    }
  });

  const groupedArray: ShoppingGroup[] = Object.values(numericGroups)
    .map(g => {
      const { qty, unit } = fromBaseUnits(g.baseTotal, g.unit);
      return {
        groupType: g.groupType,
        groupKey: g.groupKey,
        baseName: g.name,
        displayName: g.name,
        unit: unit,
        totalQty: qty,
        displayQty: formatQuantity(qty),
        items: g.items,
      };
    })
    .sort((a, b) => a.baseName.localeCompare(b.baseName));

  Object.values(exactGroups).forEach(group => {
    if (group.items.length > 1) {
      groupedArray.push({
        groupType: group.groupType,
        groupKey: group.groupKey,
        baseName: group.baseName,
        displayName: group.displayName,
        unit: '',
        totalQty: null,
        displayQty: '',
        items: group.items,
      });
    } else {
      ungrouped.push(group.items[0]);
    }
  });

  groupedArray.sort((a, b) => (a.displayName || a.baseName).localeCompare(b.displayName || b.baseName));

  return { grouped: groupedArray, ungrouped };
}
