/**
 * ingredientUtils.ts — Pure ingredient parsing, grouping, section assignment,
 * and recipe preparation-type utilities.
 *
 * No persistence here. Consumed by stores, views, and composables directly.
 * Storage-layer scaling helpers are also here because they depend on parseIngredient.
 */
import type {
  GroupedShoppingItemsResult,
  ParsedIngredient,
  ParsedIngredientUnit,
  PreparationType,
  ShoppingGroup,
  ShoppingItem,
  ShoppingSectionId,
} from '../types';

// ── Recipe preparation type ───────────────────────────────────────────────

type RecipeTypeHint = { preparationType?: string; bimby?: boolean } | null | undefined;

export function normalizePreparationTypeValue(value: unknown): PreparationType | '' {
  return [ 'classic', 'bimby', 'airfryer' ].includes(String(value)) ? (value as PreparationType) : '';
}

export function getPreparationType(recipe: RecipeTypeHint): PreparationType {
  const explicit = normalizePreparationTypeValue(recipe?.preparationType);
  if (explicit) return explicit;
  if (recipe?.bimby === true) return 'bimby';
  return 'classic';
}

// ── Ingredient text normalization ─────────────────────────────────────────

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
    return `${parenQty[ 1 ]} ${parenQty[ 3 ]} (${parenQty[ 2 ]})`.replace(/\s+/g, ' ').trim();
  }
  return cleaned;
}

// ── Unit / name normalization ─────────────────────────────────────────────

function normalizeUnit(unit: string): ParsedIngredientUnit | null {
  if (!unit) return null;
  const u = String(unit).toLowerCase().trim();

  if ([ 'g', 'gr', 'gram', 'grams', 'grammi' ].includes(u)) return 'g';
  if ([ 'kg', 'chilogrammi', 'kilogram', 'kilograms' ].includes(u)) return 'kg';
  if ([ 'ml', 'millilitre', 'milliliter', 'millilitri' ].includes(u)) return 'ml';
  if ([ 'l', 'litre', 'liter', 'litri' ].includes(u)) return 'l';
  if ([ 'uova', 'egg', 'eggs', 'uove' ].includes(u)) return 'eggs';
  if ([ 'pezzo', 'pezzi', 'piece', 'pieces' ].includes(u)) return 'pieces';

  return null;
}

function normalizeName(name: string): string {
  if (!name) return '';
  let n = String(name).toLowerCase().trim();
  n = n.replace(/\s+(fresco|congelato|secco|in\s+polvere|macinato)$/i, '');
  return n;
}

const GROUPING_LEADING_DESCRIPTOR_RE = /^(?:spicch(?:io|i)|cloves?|ramett(?:o|i)|fett(?:a|e)|fogli(?:a|e)|cucchiai(?:ni)?|cucchiain(?:o|i)|pezz(?:o|i|etto|etti)|filett(?:o|i)|ciuff(?:o|i)|mazzett(?:o|i))\s+(?:di\s+|d['’])?/i;
const GROUPING_SINGULAR_MAP: Record<string, string> = {
  uova: 'uovo',
  patate: 'patata',
  cipolle: 'cipolla',
  limoni: 'limone',
  arance: 'arancia',
  carote: 'carota',
  zucchine: 'zucchina',
  melanzane: 'melanzana',
  mele: 'mela',
  pere: 'pera',
  banane: 'banana',
  pomodori: 'pomodoro',
  peperoni: 'peperone',
  funghi: 'fungo',
  porri: 'porro',
  cetrioli: 'cetriolo',
  olive: 'oliva',
  capperi: 'cappero',
  scalogni: 'scalogno',
  onions: 'onion',
  potatoes: 'potato',
  tomatoes: 'tomato',
  carrots: 'carrot',
  peppers: 'pepper',
  lemons: 'lemon',
  apples: 'apple',
  pears: 'pear',
  bananas: 'banana',
  eggs: 'egg',
  cloves: 'clove',
};

function normalizeGroupingKeyName(name: string): string {
  let normalized = normalizeName(name)
    .replace(/[()]/g, ' ')
    .replace(/\b(?:q\.b\.?|q\.b|quanto basta|to taste|a piacere|as needed)\b/gi, ' ')
    .replace(/\b\d+\s+pizzic\w*\b/gi, ' ')
    .replace(/\bpizzic\w*\b/gi, ' ')
    .replace(/\s+per\s+(?:il|lo|la|l['’]|i|gli|le)\s+[a-zà-ù'’ -]+$/i, ' ')
    .replace(/\s+per\s+la\s+cottura$/i, ' ')
    .replace(/\s+per\s+cottura$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  normalized = normalized.replace(GROUPING_LEADING_DESCRIPTOR_RE, '').trim();
  if (!normalized) return '';

  if (/\bsalsa di soia\b/i.test(normalized)) return 'salsa di soia';
  if (/\bolio\s+(?:evo|extravergine(?:\s+d['’]oliva|\s+di\s+oliva)?|d['’]oliva|di\s+oliva)\b/i.test(normalized)) return "olio di oliva";
  if (/\bsale\b/i.test(normalized)) return 'sale';
  if (/\bpepe(?:\s+nero)?\b/i.test(normalized)) return 'pepe';

  const parts = normalized.split(' ');
  if (parts.length) parts[ 0 ] = GROUPING_SINGULAR_MAP[parts[ 0 ]] || parts[ 0 ];
  return parts.join(' ').trim();
}

// ── Quantity unit conversion ──────────────────────────────────────────────

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

function fromBaseUnits(baseQty: number, unit: ParsedIngredientUnit): { qty: number; unit: ParsedIngredientUnit } {
  if (!unit) return { qty: baseQty, unit };

  if (unit === 'g' || unit === 'kg') {
    return baseQty >= 1000 ? { qty: baseQty / 1000, unit: 'kg' } : { qty: baseQty, unit: 'g' };
  }
  if (unit === 'ml' || unit === 'l') {
    return baseQty >= 1000 ? { qty: baseQty / 1000, unit: 'l' } : { qty: baseQty, unit: 'ml' };
  }
  return { qty: baseQty, unit };
}

// ── Ingredient parser ─────────────────────────────────────────────────────

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

  // Try to match: QUANTITY UNIT NAME — e.g. "500 g chicken" or "2 eggs"
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z°º]+)\s+(.+)$/);
  if (match) {
    const qtyStr = match[ 1 ].replace(',', '.');
    const unitRaw = match[ 2 ].toLowerCase();
    const nameRaw = match[ 3 ].trim();
    const qty = parseFloat(qtyStr);

    if (!isNaN(qty) && qty > 0) {
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
    const qty = parseFloat(noUnitMatch[ 1 ].replace(',', '.'));
    const nameRaw = normalizeName(noUnitMatch[ 2 ]);
    if (!isNaN(qty) && qty > 0 && /^(uov|egg|limon|patat|cipoll|spicch|clove|banana|mela|arancia|pera|carota|zucchin)/i.test(nameRaw)) {
      result.parsedQty = qty;
      result.parsedUnit = 'pieces';
      result.parsedName = nameRaw;
      result.confidence = 'high';
    }
  }

  return result;
}

// ── Quantity formatting ───────────────────────────────────────────────────

export function formatQuantity(qty: number): string {
  if (qty === Math.floor(qty)) return String(Math.floor(qty));
  return qty.toFixed(1).replace(/\.0$/, '');
}

// ── Ingredient scaling (used by the storage layer) ────────────────────────

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

export function scaleShoppingIngredientText(text: string, factor: number): string {
  const normalized = normalizeShoppingIngredientText(text);
  if (!normalized) return '';
  if (factor === 1) return normalized;

  const parsed = parseIngredient(normalized);
  if (parsed.confidence === 'high' && parsed.parsedQty && parsed.parsedUnit) {
    return scaleParsedIngredient(parsed, factor);
  }
  return normalized;
}

// ── Shopping list sections ────────────────────────────────────────────────

export const SHOPPING_SECTIONS: ShoppingSectionId[] = [
  'proteins',
  'carbs',
  'vegetables_fruit',
  'dairy_eggs',
  'fats_oils_spices',
  'other',
];

const SECTION_KEYWORDS: Record<ShoppingSectionId, string[]> = {
  'proteins': [
    'chicken', 'pollo', 'beef', 'manzo', 'pork', 'maiale', 'lamb', 'agnello',
    'turkey', 'tacchino', 'duck', 'anatra', 'ham', 'prosciutto', 'bacon', 'pancetta',
    'sausage', 'salsiccia', 'fish', 'pesce', 'salmon', 'salmone', 'tuna', 'tonno',
    'cod', 'merluzzo', 'shrimp', 'gamberetto', 'prawn', 'squid', 'calamaro',
    'mussels', 'cozze', 'clams', 'vongole', 'scallop', 'capasanta',
    'tofu', 'lentil', 'lenticchia', 'lenticchie', 'chickpea', 'cece', 'ceci',
    'bean', 'beans', 'fagiolo', 'fagioli', 'pea', 'peas', 'pisello', 'piselli',
  ],
  'carbs': [
    'pasta', 'rice', 'riso', 'couscous', 'barley', 'orzo', 'quinoa', 'polenta',
    'bread', 'pane', 'oat', 'avena', 'bulgur', 'noodle', 'spaghetti', 'penne',
    'fusilli', 'rigatoni', 'lasagna', 'ravioli', 'gnocchi',
    'cracker', 'flour', 'farina',
  ],
  'vegetables_fruit': [
    'carrot', 'carota', 'onion', 'cipolla', 'cipollotto', 'garlic', 'aglio',
    'tomato', 'pomodoro', 'pomodori', 'pelati', 'lettuce', 'lattuga', 'spinach', 'spinaci', 'broccoli',
    'cabbage', 'cavolo', 'zucchini', 'zucchina', 'zucca', 'peperone', 'eggplant', 'melanzana',
    'banana', 'apple', 'mela', 'orange', 'arancia', 'lemon', 'limone', 'limoni',
    'strawberry', 'fragola', 'blueberry', 'mirtillo', 'grape', 'uva', 'pear', 'pera',
    'cucumber', 'cetriolo', 'pumpkin', 'potato', 'patata', 'patate',
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
    'oil', 'olio', 'vinegar', 'aceto', 'soy sauce', 'salsa di soia', 'sugar', 'zucchero', 'honey', 'miele',
    'baking powder', 'lievito', 'baking soda', 'bicarbonato', 'vanilla', 'vaniglia',
    'lard', 'strutto', 'margarine',
  ],
  'other': [],
};

function _keywordMatches(normalized: string, keyword: string): boolean {
  if (normalized === keyword) return true;
  if (normalized.startsWith(keyword + ' ')) return true;
  if (normalized.includes(' ' + keyword + ' ') || normalized.endsWith(' ' + keyword)) return true;
  if (normalized.startsWith(keyword)) {
    const rest = normalized.slice(keyword.length);
    if (/^(s|es|i|e|\s|$)/.test(rest)) return true;
  }
  return false;
}

function normalizeGroupingUnit(unit: ParsedIngredientUnit): ParsedIngredientUnit {
  if (unit === 'kg') return 'g';
  if (unit === 'l') return 'ml';
  return unit;
}

export function assignSection(ingredientName: string): ShoppingSectionId {
  if (!ingredientName) return 'other';
  const normalized = String(ingredientName).toLowerCase().trim();
  for (const [ section, keywords ] of Object.entries(SECTION_KEYWORDS) as Array<[ ShoppingSectionId, string[] ]>) {
    for (const keyword of keywords) {
      if (_keywordMatches(normalized, keyword)) return section;
    }
  }
  return 'other';
}

export function getSectionI18nKey(sectionId: ShoppingSectionId): string {
  const keys: Record<ShoppingSectionId, string> = {
    'proteins': 'section_proteins',
    'carbs': 'section_carbs',
    'vegetables_fruit': 'section_vegetables_fruit',
    'dairy_eggs': 'section_dairy_eggs',
    'fats_oils_spices': 'section_fats_oils_spices',
    'other': 'section_other',
  };
  return keys[ sectionId ] ?? 'section_other';
}

// ── Shopping list grouping ────────────────────────────────────────────────

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
      const normalizedGroupName = normalizeGroupingKeyName(parsed.parsedName) || parsed.parsedName;
      const groupingUnit = normalizeGroupingUnit(parsed.parsedUnit);
      const key = `${normalizedGroupName}__${groupingUnit}`;
      if (!numericGroups[ key ]) {
        numericGroups[ key ] = {
          groupType: 'numeric',
          groupKey: key,
          name: normalizedGroupName,
          unit: groupingUnit,
          items: [],
          baseTotal: 0,
        };
      }
      numericGroups[ key ].baseTotal += toBaseUnits(parsed.parsedQty, parsed.parsedUnit) || 0;
      numericGroups[ key ].items.push(item);
    } else {
      const exactKey = normalizeGroupingKeyName(item.text);
      if (!exactKey) {
        ungrouped.push(item);
        return;
      }
      if (!exactGroups[ exactKey ]) {
        exactGroups[ exactKey ] = {
          groupType: 'exact',
          groupKey: `exact__${exactKey}`,
          baseName: exactKey,
          displayName: exactKey,
          items: [],
        };
      }
      exactGroups[ exactKey ].items.push(item);
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
        unit,
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
      ungrouped.push(group.items[ 0 ]);
    }
  });

  groupedArray.sort((a, b) => (a.displayName || a.baseName).localeCompare(b.displayName || b.baseName));

  return { grouped: groupedArray, ungrouped };
}
