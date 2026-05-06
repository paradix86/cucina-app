import type {
  IngredientNutrition,
  NutritionPer100g,
  NutritionProvider,
  ParsedIngredientAmount,
} from '../types';
import { baseIngredientsProvider } from './baseIngredientsProvider';
import { OfflineError } from './errors';
import { fetchWithTimeout } from './fetchWithTimeout';

// ─── Public types ─────────────────────────────────────────────────────────────

export type NutritionSearchQuery = {
  query: string;
  normalizedQuery?: string;
  language?: string;    // ISO 639-1; defaults to 'it'
  maxResults?: number;  // defaults to 5
};

export type NutritionSearchResult = {
  id: string;
  name: string;
  provider: NutritionProvider;
  nutritionPer100g: NutritionPer100g;
  confidence: number;   // 0–1: match quality for this candidate
  externalUrl?: string;
};

export interface NutritionProviderClient {
  readonly provider: NutritionProvider;
  readonly displayName: string;
  search(query: NutritionSearchQuery): Promise<NutritionSearchResult[]>;
}

// ─── Mapping helper ───────────────────────────────────────────────────────────

export function buildIngredientNutritionMatch(
  parsed: ParsedIngredientAmount,
  result: NutritionSearchResult,
): IngredientNutrition {
  return {
    ingredientName: parsed.original || parsed.name,
    normalizedName: parsed.normalizedName,
    quantity:  parsed.quantity,
    unit:      parsed.unit,
    grams:     parsed.grams,
    nutritionPer100g: result.nutritionPer100g,
    source: {
      provider:    result.provider,
      externalId:  result.id,
      externalUrl: result.externalUrl,
      confidence:  result.confidence,
      fetchedAt:   new Date().toISOString(),
    },
  };
}

// ─── Manual provider ──────────────────────────────────────────────────────────

type ManualEntry = {
  id: string;
  name: string;
  aliases: string[];  // all lowercase, used for matching
  nutrition: NutritionPer100g;
};

// Common Italian cooking ingredients with approximate nutritional values per 100 g.
// Values are averages from standard Italian food composition tables (INRAN/CREA).
const MANUAL_DB: readonly ManualEntry[] = [
  {
    id: 'manual-pasta-secca',
    name: 'Pasta secca',
    aliases: ['pasta', 'pasta secca', 'spaghetti', 'penne', 'rigatoni', 'fusilli', 'tagliatelle'],
    nutrition: { kcal: 350, proteinG: 12, carbsG: 70, sugarsG: 2, fatG: 1.5, fiberG: 3, saltG: 0 },
  },
  {
    id: 'manual-riso',
    name: 'Riso',
    aliases: ['riso', 'riso carnaroli', 'riso arborio', 'riso basmati', 'riso integrale'],
    nutrition: { kcal: 350, proteinG: 7, carbsG: 77, sugarsG: 0, fatG: 0.5, fiberG: 1 },
  },
  {
    id: 'manual-olio-oliva',
    name: 'Olio d\'oliva',
    aliases: ['olio', "olio d'oliva", 'olio extravergine', 'olio evo', 'olio di oliva'],
    nutrition: { kcal: 884, fatG: 100, saturatedFatG: 14, proteinG: 0, carbsG: 0 },
  },
  {
    id: 'manual-uova',
    name: 'Uova',
    aliases: ['uova', 'uovo', 'uove', 'uova intere', 'egg', 'eggs'],
    nutrition: { kcal: 143, proteinG: 13, fatG: 10, carbsG: 1, saturatedFatG: 3 },
  },
  {
    id: 'manual-latte',
    name: 'Latte intero',
    aliases: ['latte', 'latte intero', 'latte fresco', 'latte parzialmente scremato'],
    nutrition: { kcal: 61, proteinG: 3.2, fatG: 3.3, carbsG: 4.8, calciumMg: 120 },
  },
  {
    id: 'manual-burro',
    name: 'Burro',
    aliases: ['burro', 'burro fresco'],
    nutrition: { kcal: 717, fatG: 81, saturatedFatG: 51, proteinG: 0.9, carbsG: 0.6 },
  },
  {
    id: 'manual-pomodoro',
    name: 'Pomodoro',
    aliases: ['pomodoro', 'pomodori', 'pomodorini', 'pomodori pelati', 'passata di pomodoro'],
    nutrition: { kcal: 18, proteinG: 0.9, carbsG: 3.5, fatG: 0.2, fiberG: 1.2, vitaminCMg: 19 },
  },
  {
    id: 'manual-cipolla',
    name: 'Cipolla',
    aliases: ['cipolla', 'cipolle', 'cipollotto', 'cipollotti'],
    nutrition: { kcal: 40, proteinG: 1.1, carbsG: 9, fatG: 0.1, fiberG: 1.7 },
  },
  {
    id: 'manual-aglio',
    name: 'Aglio',
    aliases: ['aglio', 'spicchio d\'aglio', 'spicchi d\'aglio'],
    nutrition: { kcal: 149, proteinG: 6.4, carbsG: 33, fatG: 0.5, fiberG: 2.1 },
  },
  {
    id: 'manual-parmigiano',
    name: 'Parmigiano Reggiano',
    aliases: ['parmigiano', 'parmigiano reggiano', 'grana padano', 'grana'],
    nutrition: { kcal: 392, proteinG: 36, fatG: 26, carbsG: 0, calciumMg: 1160, saltG: 1.6 },
  },
  {
    id: 'manual-farina',
    name: 'Farina 00',
    aliases: ['farina', 'farina 00', 'farina di grano tenero', 'farina integrale'],
    nutrition: { kcal: 364, proteinG: 10, carbsG: 76, fatG: 1, fiberG: 3 },
  },
  {
    id: 'manual-zucchero',
    name: 'Zucchero',
    aliases: ['zucchero', 'zucchero semolato', 'zucchero bianco'],
    nutrition: { kcal: 392, carbsG: 100, sugarsG: 100, proteinG: 0, fatG: 0 },
  },
  {
    id: 'manual-sale',
    name: 'Sale',
    aliases: ['sale', 'sale fino', 'sale grosso', 'sale marino'],
    nutrition: { saltG: 100, sodiumMg: 39300 },
  },
  {
    id: 'manual-mozzarella',
    name: 'Mozzarella',
    aliases: ['mozzarella', 'mozzarella di bufala', 'fior di latte'],
    nutrition: { kcal: 250, proteinG: 18, fatG: 19, carbsG: 2.5, calciumMg: 500 },
  },
  {
    id: 'manual-carote',
    name: 'Carote',
    aliases: ['carota', 'carote'],
    nutrition: { kcal: 41, proteinG: 0.9, carbsG: 9.6, fatG: 0.2, fiberG: 2.8, vitaminCMg: 6 },
  },
  {
    id: 'manual-patate',
    name: 'Patate',
    aliases: ['patata', 'patate'],
    nutrition: { kcal: 77, proteinG: 2, carbsG: 17, fatG: 0.1, fiberG: 2.2, potassiumMg: 421 },
  },
];

function normalizeForSearch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function scoreEntry(entry: ManualEntry, q: string): number {
  for (const alias of entry.aliases) {
    if (alias === q) return 0.95;
    if (alias.startsWith(q)) return 0.8;
    if (alias.includes(q)) return 0.7;
    if (q.startsWith(alias)) return 0.75;
    if (q.includes(alias) && alias.length > 3) return 0.65;
  }
  return 0;
}

export const manualProvider: NutritionProviderClient = {
  provider: 'manual',
  displayName: 'Ingredienti base (manuale)',

  async search(query: NutritionSearchQuery): Promise<NutritionSearchResult[]> {
    const q = normalizeForSearch(query.normalizedQuery ?? query.query);
    if (!q) return [];

    const max = query.maxResults ?? 5;
    const scored: { entry: ManualEntry; score: number }[] = [];

    for (const entry of MANUAL_DB) {
      const score = scoreEntry(entry, q);
      if (score > 0) scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, max).map(({ entry, score }) => ({
      id:              entry.id,
      name:            entry.name,
      provider:        'manual',
      nutritionPer100g: entry.nutrition,
      confidence:      score,
    }));
  },
};

// ─── OpenFoodFacts provider ───────────────────────────────────────────────────

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

// Bound the OFF fetch so a slow or rate-limited upstream cannot stall the
// enrichment chain. On timeout, the catch path returns [] (same as any other
// fetch failure), which advances the chain to the next query / next provider.
const OFF_FETCH_TIMEOUT_MS = 4000;

// Safely parse a numeric field that may arrive as number, numeric string, or
// comma-decimal string. Returns undefined for anything non-finite or negative.
function offNum(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  return undefined;
}

// Prefer the language-specific product name, fall back to the generic field.
function offProductName(p: Record<string, unknown>, lang: string): string | undefined {
  const localized = String(p[`product_name_${lang}`] ?? '').trim();
  if (localized) return localized;
  const generic = String(p['product_name'] ?? '').trim();
  return generic || undefined;
}

// Map OpenFoodFacts nutriments object to NutritionPer100g.
// Sodium in OFF is in grams per 100 g — multiply by 1 000 to get mg.
function offMapNutriments(n: Record<string, unknown>): NutritionPer100g {
  const sodiumG = offNum(n['sodium_100g']);
  return {
    kcal:          offNum(n['energy-kcal_100g']),
    proteinG:      offNum(n['proteins_100g']),
    carbsG:        offNum(n['carbohydrates_100g']),
    sugarsG:       offNum(n['sugars_100g']),
    fatG:          offNum(n['fat_100g']),
    saturatedFatG: offNum(n['saturated-fat_100g']),
    fiberG:        offNum(n['fiber_100g']),
    saltG:         offNum(n['salt_100g']),
    sodiumMg:      sodiumG !== undefined ? Math.round(sodiumG * 1000) : undefined,
  };
}

function offHasNutrition(n: NutritionPer100g): boolean {
  return Object.values(n).some(v => v !== undefined);
}

// Score a product name against the search query (both already lowercased).
function offConfidence(productName: string, q: string): number {
  const name = productName.toLowerCase();
  const query = q.toLowerCase().trim();
  if (name === query) return 0.9;
  if (name.startsWith(query)) return 0.8;
  if (name.includes(query)) return 0.7;
  if (query.split(/\s+/).filter(Boolean).every(w => name.includes(w))) return 0.6;
  return 0.45;
}

export const openFoodFactsProvider: NutritionProviderClient = {
  provider: 'openfoodfacts',
  displayName: 'OpenFoodFacts',

  async search(query: NutritionSearchQuery): Promise<NutritionSearchResult[]> {
    const q = (query.normalizedQuery ?? query.query).trim();
    if (!q) return [];

    const lang       = query.language ?? 'it';
    const maxResults = query.maxResults ?? 5;

    const url = new URL(OFF_SEARCH_URL);
    url.searchParams.set('search_terms', q);
    url.searchParams.set('json',         '1');
    url.searchParams.set('action',       'process');
    url.searchParams.set('page_size',    String(maxResults));
    url.searchParams.set('lc',           lang);

    let data: unknown;
    try {
      const response = await fetchWithTimeout(url.toString(), { timeoutMs: OFF_FETCH_TIMEOUT_MS });
      if (!response.ok) return [];
      data = await response.json();
    } catch (err) {
      // Offline must propagate so the caller can surface it; timeouts and
      // network errors degrade silently to "no match for this query".
      if (err instanceof OfflineError) throw err;
      return [];
    }

    if (!data || typeof data !== 'object') return [];
    const payload = data as Record<string, unknown>;
    if (!Array.isArray(payload['products'])) return [];

    const results: NutritionSearchResult[] = [];

    for (const item of payload['products'] as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;

      const name = offProductName(p, lang);
      if (!name) continue;

      if (!p['nutriments'] || typeof p['nutriments'] !== 'object') continue;
      const nutritionPer100g = offMapNutriments(p['nutriments'] as Record<string, unknown>);
      if (!offHasNutrition(nutritionPer100g)) continue;

      const code = String(p['code'] ?? p['id'] ?? '').trim();
      const id   = code || `off-${name}`;
      const externalUrl = typeof p['url'] === 'string' ? p['url'] : undefined;

      results.push({
        id,
        name,
        provider:        'openfoodfacts',
        nutritionPer100g,
        confidence:      offConfidence(name, q),
        externalUrl,
      });
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, maxResults);
  },
};

// ─── Provider registry ────────────────────────────────────────────────────────

// Enrichment order: manual (small hardcoded DB) → base_ingredients (large curated DB) → openfoodfacts (external API).
// User-edited entries are preserved before this chain is consulted (see enrichRecipeNutritionWithProviders).
export const NUTRITION_PROVIDERS: readonly NutritionProviderClient[] = [
  manualProvider,
  baseIngredientsProvider,
  openFoodFactsProvider,
];

export { baseIngredientsProvider };

export function getProvider(id: NutritionProvider): NutritionProviderClient | undefined {
  return NUTRITION_PROVIDERS.find(p => p.provider === id);
}
