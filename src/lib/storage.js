/**
 * storage.js — Personal recipe book management via localStorage
 */

export const STORAGE_KEY = 'cucina_recipebook_v3';
export const STORAGE_KEY_V2 = 'cucina_ricettario_v2';
export const SHOPPING_LIST_KEY = 'cucina_shopping_list_v1';

export function normalizePreparationTypeValue(value) {
  return ['classic', 'bimby', 'airfryer'].includes(value) ? value : '';
}

export function getPreparationType(recipe) {
  const explicit = normalizePreparationTypeValue(recipe?.preparationType);
  if (explicit) return explicit;
  if (recipe?.bimby === true) return 'bimby';
  return 'classic';
}

function normalizeStoredRecipe(recipe) {
  const preparationType = getPreparationType(recipe);
  return {
    ...recipe,
    preparationType,
    bimby: recipe?.bimby != null ? recipe.bimby : preparationType === 'bimby',
    favorite: recipe?.favorite || false,
    lastViewedAt: recipe?.lastViewedAt || undefined,
    tags: Array.isArray(recipe?.tags) ? recipe.tags : [],
  };
}

/**
 * One-time migration: v2 (Italian field names) → v3 (English field names).
 * Called once from app.js before any render.
 */
export function migrateFromV2() {
  if (!localStorage.getItem(STORAGE_KEY_V2)) return;   // nothing to migrate
  if (localStorage.getItem(STORAGE_KEY)) return;   // v3 already exists

  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY_V2) || '[]');
    if (!Array.isArray(arr)) return;

    const migrated = arr.map(r => ({
      id: r.id,
      name: r.nome || r.name || '',
      category: r.cat || r.category || '',
      bimby: r.bimby != null ? r.bimby : false,
      emoji: r.emoji || '🍴',
      time: r.tempo || r.time || '',
      servings: r.porzioni || r.servings || '',
      source: r.fonte || r.source || 'web',
      preparationType: normalizePreparationTypeValue(r.preparationType) || (r.bimby ? 'bimby' : 'classic'),
      sourceDomain: r.sourceDomain || undefined,
      ingredients: r.ingredienti || r.ingredients || [],
      steps: r.steps || [],
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

export function loadRecipeBook() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(arr) ? arr.map(normalizeStoredRecipe) : [];
  } catch {
    return [];
  }
}

export function saveRecipeBook(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((arr || []).map(normalizeStoredRecipe)));
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
}

export function addRecipe(recipe) {
  const arr = loadRecipeBook();
  if (arr.find(r => r.id === recipe.id)) return false;
  arr.unshift(normalizeStoredRecipe(recipe));
  saveRecipeBook(arr);
  return true;
}

export function deleteRecipe(id) {
  saveRecipeBook(loadRecipeBook().filter(r => r.id !== id));
}

export function updateRecipeNotes(id, notes) {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[idx] = { ...arr[idx], notes: notes || '' };
  saveRecipeBook(arr);
  return true;
}

export function toggleRecipeFavorite(id) {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[idx].favorite = !arr[idx].favorite;
  saveRecipeBook(arr);
  return true;
}

export function markRecipeViewed(id) {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[idx].lastViewedAt = Date.now();
  saveRecipeBook(arr);
  return true;
}

export function exportRecipeBook() {
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

export function importRecipeBook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const arr = JSON.parse(e.target.result);
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

export function loadShoppingList() {
  try {
    const arr = JSON.parse(localStorage.getItem(SHOPPING_LIST_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveShoppingList(items) {
  try {
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(items || []));
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
}

export function addShoppingListItems(items, recipeMeta = {}) {
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
    .filter(item => item.text);

  const next = [...existing, ...additions];
  saveShoppingList(next);
  return additions.length;
}

export function toggleShoppingListItem(id) {
  const items = loadShoppingList();
  const idx = items.findIndex(item => item.id === id);
  if (idx === -1) return false;
  items[idx].checked = !items[idx].checked;
  saveShoppingList(items);
  return true;
}

export function removeShoppingListItem(id) {
  const items = loadShoppingList();
  const next = items.filter(item => item.id !== id);
  if (next.length === items.length) return false;
  saveShoppingList(next);
  return true;
}

export function clearShoppingList() {
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
export function parseIngredient(text) {
  if (!text) return { confidence: 'low', raw: text };

  const trimmed = String(text).trim();
  const result = { raw: trimmed, parsedQty: null, parsedUnit: null, parsedName: null, confidence: 'low' };

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

  return result;
}

/**
 * Normalize unit string to a canonical form.
 * Returns null if unit is not recognized.
 *
 * Supported canonical units: g, kg, ml, l, eggs, pieces
 */
function normalizeUnit(unit) {
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
function normalizeName(name) {
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
function toBaseUnits(qty, unit) {
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
function fromBaseUnits(baseQty, unit) {
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
export function formatQuantity(qty) {
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

export const SHOPPING_SECTIONS = [
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
const SECTION_KEYWORDS = {
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
    'tomato', 'pomodoro', 'lettuce', 'lattuga', 'spinach', 'spinaci', 'broccoli',
    'cabbage', 'cavolo', 'zucchini', 'zucca', 'peperone', 'eggplant', 'melanzana',
    'banana', 'apple', 'mela', 'orange', 'arancia', 'lemon', 'limone',
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
export function assignSection(ingredientName) {
  if (!ingredientName) return 'other';

  const normalized = String(ingredientName).toLowerCase().trim();

  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (_keywordMatches(normalized, keyword)) return section;
    }
  }

  return 'other';
}

/**
 * Get i18n key for a section ID.
 */
export function getSectionI18nKey(sectionId) {
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
export function groupShoppingItems(items) {
  if (!Array.isArray(items)) return { grouped: [], ungrouped: [] };

  const parseResults = items.map(item => ({
    ...item,
    parsed: parseIngredient(item.text),
  }));

  const numericGroups = {};
  const exactGroups = {};
  const ungrouped = [];

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
      const baseQty = toBaseUnits(parsed.parsedQty, parsed.parsedUnit);
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

  const groupedArray = Object.values(numericGroups)
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
