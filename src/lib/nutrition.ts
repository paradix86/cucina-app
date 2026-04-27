import type {
  IngredientNutrition,
  NutritionPer100g,
  NutritionProvider,
  NutritionSource,
  NutritionStatus,
  ParsedIngredientAmount,
  RecipeNutrition,
} from '../types';

const NUTRITION_FIELDS: readonly (keyof NutritionPer100g)[] = [
  'kcal', 'proteinG', 'carbsG', 'sugarsG', 'fatG', 'saturatedFatG',
  'fiberG', 'saltG', 'sodiumMg', 'calciumMg', 'ironMg', 'potassiumMg',
  'magnesiumMg', 'zincMg', 'vitaminCMg', 'vitaminDMcg', 'vitaminB12Mcg',
];

const VALID_PROVIDERS: readonly NutritionProvider[] = ['openfoodfacts', 'usda', 'manual', 'unknown'];
const VALID_STATUSES: readonly NutritionStatus[] = ['missing', 'partial', 'complete', 'manual'];

function safeNonNegNum(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function normalizeNutritionPer100g(value: unknown): NutritionPer100g | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  return {
    kcal:           safeNonNegNum(v['kcal']),
    proteinG:       safeNonNegNum(v['proteinG']),
    carbsG:         safeNonNegNum(v['carbsG']),
    sugarsG:        safeNonNegNum(v['sugarsG']),
    fatG:           safeNonNegNum(v['fatG']),
    saturatedFatG:  safeNonNegNum(v['saturatedFatG']),
    fiberG:         safeNonNegNum(v['fiberG']),
    saltG:          safeNonNegNum(v['saltG']),
    sodiumMg:       safeNonNegNum(v['sodiumMg']),
    calciumMg:      safeNonNegNum(v['calciumMg']),
    ironMg:         safeNonNegNum(v['ironMg']),
    potassiumMg:    safeNonNegNum(v['potassiumMg']),
    magnesiumMg:    safeNonNegNum(v['magnesiumMg']),
    zincMg:         safeNonNegNum(v['zincMg']),
    vitaminCMg:     safeNonNegNum(v['vitaminCMg']),
    vitaminDMcg:    safeNonNegNum(v['vitaminDMcg']),
    vitaminB12Mcg:  safeNonNegNum(v['vitaminB12Mcg']),
  };
}

export function normalizeNutritionSource(value: unknown): NutritionSource | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const rawProvider = String(v['provider'] ?? '');
  const provider: NutritionProvider = (VALID_PROVIDERS as readonly string[]).includes(rawProvider)
    ? rawProvider as NutritionProvider
    : 'unknown';
  const rawConf = Number(v['confidence']);
  const confidence = Number.isFinite(rawConf) && rawConf >= 0 && rawConf <= 1 ? rawConf : undefined;
  return {
    provider,
    externalId:  typeof v['externalId']  === 'string' ? v['externalId']  : undefined,
    externalUrl: typeof v['externalUrl'] === 'string' ? v['externalUrl'] : undefined,
    confidence,
    fetchedAt:   typeof v['fetchedAt']   === 'string' ? v['fetchedAt']   : undefined,
  };
}

export function normalizeIngredientNutrition(value: unknown): IngredientNutrition | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v['ingredientName'] !== 'string' || !v['ingredientName']) return undefined;
  return {
    ingredientName:  v['ingredientName'],
    normalizedName:  typeof v['normalizedName'] === 'string' ? v['normalizedName'] : undefined,
    quantity:        safeNonNegNum(v['quantity']),
    unit:            typeof v['unit'] === 'string' ? v['unit'] : undefined,
    grams:           safeNonNegNum(v['grams']),
    nutritionPer100g: normalizeNutritionPer100g(v['nutritionPer100g']),
    source:          normalizeNutritionSource(v['source']),
  };
}

export function normalizeIngredientNutritionArray(value: unknown): IngredientNutrition[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeIngredientNutrition)
    .filter((n): n is IngredientNutrition => n !== undefined);
}

// ─── Ingredient amount parsing ────────────────────────────────────────────────

// Maps raw Italian/abbreviated unit strings to canonical unit names.
const UNIT_MAP: Record<string, string> = {
  // Weight
  g: 'g', gr: 'g', grammo: 'g', grammi: 'g',
  kg: 'kg', chilogrammo: 'kg', chilogrammi: 'kg',
  // Volume
  ml: 'ml', millilitro: 'ml', millilitri: 'ml',
  l: 'l', litro: 'l', litri: 'l',
  // Spoon measures
  cucchiaio: 'tbsp', cucchiai: 'tbsp',
  cucchiaino: 'tsp', cucchiaini: 'tsp',
  // Approximate amounts
  pizzico: 'pinch', pizzichi: 'pinch',
  // Countables — unit word doubles as ingredient label
  pezzo: 'piece', pezzi: 'piece',
  uovo: 'piece', uova: 'piece', uove: 'piece',
};

function lookupUnit(raw: string): string | undefined {
  return UNIT_MAP[raw.toLowerCase().trim()];
}

function confidenceFor(unit: string): number {
  if (unit === 'g' || unit === 'kg' || unit === 'ml' || unit === 'l') return 0.9;
  if (unit === 'tbsp' || unit === 'tsp') return 0.5;
  return 0.4; // piece, pinch
}

function gramsFor(qty: number, unit: string): number | undefined {
  if (unit === 'g') return qty;
  if (unit === 'kg') return qty * 1000;
  return undefined;
}

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function makeResult(
  original: string,
  name: string,
  opts: { quantity?: number; unit?: string; confidence: number },
): ParsedIngredientAmount {
  const n = cleanName(name) || original.trim();
  return {
    original,
    name: n,
    normalizedName: n ? n.toLowerCase() : undefined,
    quantity: opts.quantity,
    unit: opts.unit,
    grams: opts.quantity != null && opts.unit ? gramsFor(opts.quantity, opts.unit) : undefined,
    confidence: opts.confidence,
  };
}

// \b before q handles word boundary at start; no \b after q.b.? because the
// trailing dot is a non-word char that would cause \b to reject the match.
const QB_RE = /\bq\.b\.?|\b(?:quanto\s*basta|a\s*piacere|a\s*piacimento)\b/gi;
const MEZZA_RE = /^(mezzo|mezza)\s+/i;
// Matches a leading number (with optional comma decimal) followed by an optional
// run of letters (unit), then the rest of the string.
const LEADING_RE = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZàèéìòùÀÈÉÌÒÙ]*)\s*(.*?)$/;
// Matches name text followed by a trailing number + optional unit.
const TRAILING_RE = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-ZàèéìòùÀÈÉÌÒÙ]*)\s*$/;

/**
 * Parse an Italian ingredient string into a structured amount record.
 * Never throws; falls back to confidence=0.1 with the raw string as name.
 */
export function parseIngredientAmount(input: string): ParsedIngredientAmount {
  const original = String(input ?? '');
  const trimmed = original.replace(/\s+/g, ' ').trim();

  if (!trimmed) return { original, name: original, confidence: 0.1 };

  // Q.B. / vague → low confidence, strip the marker to extract name
  if (QB_RE.test(trimmed)) {
    QB_RE.lastIndex = 0;
    const name = cleanName(trimmed.replace(QB_RE, '')) || trimmed;
    return makeResult(original, name, { confidence: 0.1 });
  }
  QB_RE.lastIndex = 0;

  // "mezza/mezzo" Italian half-quantity
  if (MEZZA_RE.test(trimmed)) {
    const name = cleanName(trimmed.replace(MEZZA_RE, ''));
    return makeResult(original, name, { quantity: 0.5, unit: 'piece', confidence: 0.4 });
  }

  // Normalise fraction notation: "1/2" → "0.5"
  const working = trimmed.replace(/\b(\d+)\/(\d+)\b/g, (_, n, d) => {
    const v = Number(n) / Number(d);
    return Number.isFinite(v) ? String(v) : _;
  });

  // Pattern A — leading quantity: "200 g riso", "200g riso", "2 uova", "1 cucchiaio olio"
  const la = working.match(LEADING_RE);
  if (la) {
    const qty = parseFloat(la[1].replace(',', '.'));
    const unitRaw = la[2] ?? '';
    const nameRaw = (la[3] ?? '').trim();

    if (Number.isFinite(qty) && qty > 0) {
      const unit = unitRaw ? lookupUnit(unitRaw) : undefined;
      if (unit) {
        // When unit IS the ingredient label (uova/pizzico), use the raw unit word as name fallback
        const isLabelUnit = ['piece', 'pinch'].includes(unit);
        const name = nameRaw || (isLabelUnit ? unitRaw : trimmed);
        return makeResult(original, name, { quantity: qty, unit, confidence: confidenceFor(unit) });
      }
      // No recognised unit — unit word is start of name ("3 patate" → name "patate")
      const name = unitRaw ? cleanName(unitRaw + (nameRaw ? ' ' + nameRaw : '')) : nameRaw || trimmed;
      return makeResult(original, name, { quantity: qty, confidence: 0.3 });
    }
  }

  // Pattern B — trailing quantity: "riso 200 g", "olio 1 cucchiaio", "riso 200gr"
  const ta = working.match(TRAILING_RE);
  if (ta) {
    const nameRaw = ta[1].trim();
    const qty = parseFloat(ta[2].replace(',', '.'));
    const unitRaw = ta[3] ?? '';

    if (Number.isFinite(qty) && qty > 0) {
      const unit = unitRaw ? lookupUnit(unitRaw) : undefined;
      if (unit) {
        return makeResult(original, nameRaw, { quantity: qty, unit, confidence: confidenceFor(unit) });
      }
      // Trailing bare number, no unit ("riso 3") — low confidence
      return makeResult(original, nameRaw, { quantity: qty, confidence: 0.2 });
    }
  }

  // Fallback — just a name, no parseable quantity
  return makeResult(original, trimmed, { confidence: 0.1 });
}

// ─── Nutrition calculation engine ────────────────────────────────────────────

export function parseServings(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  const match = String(value).match(/^(\d+(?:[.,]\d+)?)/);
  if (!match) return undefined;
  const n = parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function scaleNutritionBlock(n: NutritionPer100g, factor: number): NutritionPer100g {
  const result: NutritionPer100g = {};
  for (const field of NUTRITION_FIELDS) {
    const v = n[field];
    if (v !== undefined) result[field] = v * factor;
  }
  return result;
}

export function addNutritionBlocks(a: NutritionPer100g, b: NutritionPer100g): NutritionPer100g {
  const result: NutritionPer100g = { ...a };
  for (const field of NUTRITION_FIELDS) {
    const bv = b[field];
    if (bv !== undefined) result[field] = (result[field] ?? 0) + bv;
  }
  return result;
}

function isUsableIngredientNutrition(ing: IngredientNutrition): boolean {
  if (!ing.grams || ing.grams <= 0) return false;
  if (!ing.nutritionPer100g) return false;
  return NUTRITION_FIELDS.some(f => ing.nutritionPer100g![f] !== undefined);
}

export function calculateRecipeNutrition(input: {
  ingredients: string[];
  ingredientNutrition: IngredientNutrition[];
  servings?: string | number;
}): RecipeNutrition {
  const { ingredients, ingredientNutrition, servings } = input;
  const usable = ingredientNutrition.filter(isUsableIngredientNutrition);

  if (usable.length === 0) return { status: 'missing' };

  let perRecipe: NutritionPer100g = {};
  for (const ing of usable) {
    perRecipe = addNutritionBlocks(perRecipe, scaleNutritionBlock(ing.nutritionPer100g!, ing.grams! / 100));
  }

  const status: NutritionStatus = usable.length >= ingredients.length ? 'complete' : 'partial';
  const servingsNum = parseServings(servings);
  const perServing = servingsNum ? scaleNutritionBlock(perRecipe, 1 / servingsNum) : undefined;

  const sources = ingredientNutrition
    .map(ing => ing.source)
    .filter((s): s is NutritionSource => s !== undefined);

  return {
    status,
    perRecipe,
    perServing,
    servingsUsed: servingsNum,
    calculatedAt: new Date().toISOString(),
    sources: sources.length > 0 ? sources : undefined,
  };
}

export function normalizeRecipeNutrition(value: unknown): RecipeNutrition {
  if (!value || typeof value !== 'object') return { status: 'missing' };
  const v = value as Record<string, unknown>;
  const rawStatus = String(v['status'] ?? '');
  const status: NutritionStatus = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? rawStatus as NutritionStatus
    : 'missing';
  const rawServings = Number(v['servingsUsed']);
  const servingsUsed = Number.isFinite(rawServings) && rawServings > 0 ? rawServings : undefined;
  const rawSources = Array.isArray(v['sources'])
    ? (v['sources'] as unknown[]).map(normalizeNutritionSource).filter((s): s is NutritionSource => s !== undefined)
    : [];
  return {
    status,
    perRecipe:    normalizeNutritionPer100g(v['perRecipe']),
    perServing:   normalizeNutritionPer100g(v['perServing']),
    servingsUsed,
    calculatedAt: typeof v['calculatedAt'] === 'string' ? v['calculatedAt'] : undefined,
    sources:      rawSources.length > 0 ? rawSources : undefined,
  };
}
