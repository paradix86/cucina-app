/**
 * Pure helpers for ingredient name normalization and alias-based query expansion.
 *
 * These functions have no side effects and no imports beyond TypeScript built-ins,
 * making them trivially unit-testable.
 */

// ─── Normalization ────────────────────────────────────────────────────────────

/** Lowercase, trim, collapse internal whitespace. */
export function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Alias rules ──────────────────────────────────────────────────────────────

// A rule fires when the normalized ingredient name exactly equals `trigger`
// or starts with `trigger` followed by a space (i.e. `trigger` is a prefix word
// boundary).  When it fires, `base` is added as a fallback search query.
//
// Rules are evaluated in order; all matching rules contribute their base.
// Duplicates are removed while preserving first-occurrence order.
const ALIAS_RULES: ReadonlyArray<{ trigger: string; base: string }> = [
  // ── Olio ──────────────────────────────────────────────────────────────────
  { trigger: 'olio extravergine di oliva', base: 'olio' },
  { trigger: 'olio extravergine',          base: 'olio' },
  { trigger: 'olio evo',                   base: 'olio' },
  { trigger: "olio d'oliva",               base: 'olio' },
  { trigger: 'olio di oliva',              base: 'olio' },

  // ── Farina ────────────────────────────────────────────────────────────────
  { trigger: 'farina 00',               base: 'farina' },
  { trigger: 'farina integrale',        base: 'farina' },
  { trigger: 'farina di grano tenero',  base: 'farina' },
  { trigger: 'farina manitoba',         base: 'farina' },
  { trigger: 'farina di farro',         base: 'farina' },

  // ── Riso ──────────────────────────────────────────────────────────────────
  { trigger: 'riso basmati',    base: 'riso' },
  { trigger: 'riso integrale',  base: 'riso' },
  { trigger: 'riso carnaroli',  base: 'riso' },
  { trigger: 'riso arborio',    base: 'riso' },
  { trigger: 'riso parboiled',  base: 'riso' },
  { trigger: 'riso venere',     base: 'riso' },

  // ── Pasta ─────────────────────────────────────────────────────────────────
  { trigger: 'pasta integrale',    base: 'pasta' },
  { trigger: 'pasta fresca',       base: 'pasta' },
  { trigger: "pasta all'uovo",     base: 'pasta' },
  { trigger: 'pasta di semola',    base: 'pasta' },

  // ── Zucchero ──────────────────────────────────────────────────────────────
  { trigger: 'zucchero bianco',   base: 'zucchero' },
  { trigger: 'zucchero semolato', base: 'zucchero' },
  { trigger: 'zucchero di canna', base: 'zucchero' },
  { trigger: 'zucchero a velo',   base: 'zucchero' },

  // ── Uova ──────────────────────────────────────────────────────────────────
  { trigger: 'uova', base: 'uovo' },
  { trigger: 'uove', base: 'uovo' },
];

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Return the primary name followed by any base-ingredient aliases derived from
 * the ALIAS_RULES table.  The primary name is always first; bases are appended
 * in rule order, deduplicated.
 *
 * Example:
 *   getIngredientAliases('olio extravergine di oliva') → ['olio extravergine di oliva', 'olio']
 *   getIngredientAliases('farina 00')                 → ['farina 00', 'farina']
 *   getIngredientAliases('pasta')                     → ['pasta']
 */
export function getIngredientAliases(normalizedName: string): string[] {
  const result: string[] = [normalizedName];
  const seen = new Set<string>([normalizedName]);

  for (const { trigger, base } of ALIAS_RULES) {
    const matches =
      normalizedName === trigger ||
      normalizedName.startsWith(trigger + ' ');
    if (matches && !seen.has(base)) {
      seen.add(base);
      result.push(base);
    }
  }

  return result;
}

/**
 * Build an ordered list of search queries to try for a single ingredient.
 * The first entry is always the primary normalized name; subsequent entries
 * are alias bases derived from ALIAS_RULES.  All entries are normalized and
 * deduplicated while preserving first-occurrence order.
 *
 * The enrichment loop should attempt queries in sequence, stopping at the
 * first one that yields a provider result above the confidence threshold.
 *
 * Example:
 *   buildNutritionSearchQueries('olio extravergine di oliva', '50 ml olio evo')
 *     → ['olio extravergine di oliva', 'olio']
 *
 *   buildNutritionSearchQueries('pasta integrale', '200 g pasta integrale')
 *     → ['pasta integrale', 'pasta']
 *
 *   buildNutritionSearchQueries('pomodoro', '100 g pomodoro')
 *     → ['pomodoro']  // no alias rules apply
 */
export function buildNutritionSearchQueries(
  normalizedName: string | undefined,
  originalName: string,
): string[] {
  const primary = normalizedName
    ? normalizeIngredientName(normalizedName)
    : normalizeIngredientName(originalName);

  if (!primary) return [];

  const seen = new Set<string>();
  const queries: string[] = [];

  const add = (q: string) => {
    const n = normalizeIngredientName(q);
    if (n && !seen.has(n)) {
      seen.add(n);
      queries.push(n);
    }
  };

  add(primary);

  for (const alias of getIngredientAliases(primary)) {
    if (alias !== primary) add(alias);
  }

  return queries;
}
