import type { NutritionProviderClient, NutritionSearchQuery, NutritionSearchResult } from './nutritionProviders';
import { BASE_INGREDIENTS_DATA, type BaseIngredientNutritionEntry } from './baseIngredientsData';

// ─── Normalization ────────────────────────────────────────────────────────────

// Normalize a query or alias for matching: lowercase, collapse spaces, strip
// common punctuation characters that appear in ingredient strings.
// Apostrophes are NOT removed because they are semantically meaningful in
// Italian (e.g. "fiocchi d'avena", "spicchio d'aglio").
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[()[\],.;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Word-boundary helpers ────────────────────────────────────────────────────

// Italian word characters including accented letters.
const WORD_CHAR = /[a-zA-Z0-9àáèéìíîòóùúÀÁÈÉÌÍÎÒÓÙÚ]/;

function isWordBoundaryBefore(text: string, idx: number): boolean {
  if (idx === 0) return true;
  return !WORD_CHAR.test(text[idx - 1]);
}

function isWordBoundaryAfter(text: string, idx: number, len: number): boolean {
  const end = idx + len;
  if (end >= text.length) return true;
  return !WORD_CHAR.test(text[end]);
}

// ─── Safety check ─────────────────────────────────────────────────────────────

// Returns true when `alias` appears in `query` at a proper word boundary
// AND the text that follows is NOT a "di X" qualifier, which would indicate a
// different ingredient family (e.g. "farina di mandorle", "latte di soia",
// "burro di arachidi" must NOT match their short-form aliases).
function isSafeSubstringMatch(query: string, alias: string): boolean {
  let searchFrom = 0;
  while (searchFrom < query.length) {
    const idx = query.indexOf(alias, searchFrom);
    if (idx === -1) return false;
    if (isWordBoundaryBefore(query, idx) && isWordBoundaryAfter(query, idx, alias.length)) {
      const after = query.slice(idx + alias.length).trim();
      if (after.startsWith('di ') || after === 'di') return false;  // "X di Y" → different food
      return true;
    }
    searchFrom = idx + 1;
  }
  return false;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreEntry(entry: BaseIngredientNutritionEntry, rawQuery: string): number {
  const q = normalizeText(rawQuery);
  if (!q) return 0;

  const candidates = [
    normalizeText(entry.canonicalName),
    ...entry.aliases.map(normalizeText),
  ].filter(c => c.length > 0);

  // Round 1 — exact match of canonical name or any alias
  for (const c of candidates) {
    if (c === q) return 0.95;
  }

  // Round 2 — starts-with / prefix matches (explicit word-boundary)
  for (const c of candidates) {
    if (!c) continue;

    // Query starts with candidate — the candidate is a short base name used in a
    // longer description ("banana media", "miele 5g opzionale" …)
    if (q.startsWith(c) && (q.length === c.length || q[c.length] === ' ')) {
      const after = q.slice(c.length).trim();
      // Reject "X di Y" compounds (different ingredient family)
      if (after.startsWith('di ') || after === 'di') continue;
      return 0.80;
    }

    // Candidate starts with query — user typed a prefix of a longer alias
    // ("carne macinata" as shorthand for "carne macinata di manzo")
    if (c.startsWith(q) && (c.length === q.length || c[q.length] === ' ')) {
      return 0.80;
    }
  }

  // Round 3 — safe word-boundary substring: alias appears inside the query.
  // Direction is intentionally one-way: query contains alias ("fiocchi d'avena" → "avena").
  // The reverse (alias contains query) is NOT checked because it produces false
  // positives (e.g. "acqua" matching "tonno sott'acqua").
  for (const c of candidates) {
    if (c.length <= 4) continue;
    if (isSafeSubstringMatch(q, c)) return 0.75;
  }

  return 0;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const baseIngredientsProvider: NutritionProviderClient = {
  provider:    'base_ingredients',
  displayName: 'Base ingredients',

  async search(query: NutritionSearchQuery): Promise<NutritionSearchResult[]> {
    const raw = (query.normalizedQuery ?? query.query).trim();
    if (!raw) return [];

    const max = query.maxResults ?? 5;

    const scored: { entry: BaseIngredientNutritionEntry; score: number }[] = [];
    for (const entry of BASE_INGREDIENTS_DATA) {
      const score = scoreEntry(entry, raw);
      if (score > 0) scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, max).map(({ entry, score }) => ({
      id:               entry.id,
      name:             entry.canonicalName,
      provider:         'base_ingredients',
      nutritionPer100g: entry.nutritionPer100g,
      confidence:       score,
    }));
  },
};
