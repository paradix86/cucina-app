import type {
  IngredientNutrition,
  NutritionPer100g,
  NutritionProvider,
  ParsedIngredientAmount,
} from '../types';

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

// ─── Provider registry ────────────────────────────────────────────────────────

export const NUTRITION_PROVIDERS: readonly NutritionProviderClient[] = [manualProvider];

export function getProvider(id: NutritionProvider): NutritionProviderClient | undefined {
  return NUTRITION_PROVIDERS.find(p => p.provider === id);
}
