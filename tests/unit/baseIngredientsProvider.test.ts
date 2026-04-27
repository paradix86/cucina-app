import { describe, it, expect } from 'vitest';
import { baseIngredientsProvider } from '../../src/lib/baseIngredientsProvider';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function search(q: string, max = 5) {
  return baseIngredientsProvider.search({ query: q, normalizedQuery: q, maxResults: max });
}

// ─── Provider metadata ────────────────────────────────────────────────────────

describe('baseIngredientsProvider — metadata', () => {
  it('has the correct provider id', () => {
    expect(baseIngredientsProvider.provider).toBe('base_ingredients');
  });

  it('has a readable display name', () => {
    expect(baseIngredientsProvider.displayName).toBe('Base ingredients');
  });
});

// ─── Exact alias matches (confidence 0.95) ────────────────────────────────────

describe('baseIngredientsProvider — exact alias matches', () => {
  it("fiocchi d'avena matches avena entry at 0.95", async () => {
    const results = await search("fiocchi d'avena");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].confidence).toBe(0.95);
    expect(results[0].id).toBe('base-avena');
  });

  it('avena matches avena entry at 0.95', async () => {
    const results = await search('avena');
    expect(results[0].id).toBe('base-avena');
    expect(results[0].confidence).toBe(0.95);
  });

  it('latte parzialmente scremato matches specific milk entry at 0.95', async () => {
    const results = await search('latte parzialmente scremato');
    expect(results[0].id).toBe('base-latte-parzialmente-scremato');
    expect(results[0].confidence).toBe(0.95);
  });

  it('latte matches latte intero entry (short alias) at 0.95', async () => {
    const results = await search('latte');
    expect(results[0].id).toBe('base-latte-intero');
    expect(results[0].confidence).toBe(0.95);
  });

  it('cannella matches cannella entry at 0.95', async () => {
    const results = await search('cannella');
    expect(results[0].id).toBe('base-cannella');
    expect(results[0].confidence).toBe(0.95);
  });

  it('mandorle matches mandorle entry at 0.95', async () => {
    const results = await search('mandorle');
    expect(results[0].id).toBe('base-mandorle');
    expect(results[0].confidence).toBe(0.95);
  });

  it('farina 00 matches farina 00 entry at 0.95', async () => {
    const results = await search('farina 00');
    expect(results[0].id).toBe('base-farina-00');
    expect(results[0].confidence).toBe(0.95);
  });

  it('miele matches miele entry at 0.95', async () => {
    const results = await search('miele');
    expect(results[0].id).toBe('base-miele');
    expect(results[0].confidence).toBe(0.95);
  });

  it('banana matches banana entry at 0.95', async () => {
    const results = await search('banana');
    expect(results[0].id).toBe('base-banana');
    expect(results[0].confidence).toBe(0.95);
  });

  it('olio evo matches olive oil entry at 0.95', async () => {
    const results = await search('olio evo');
    expect(results[0].id).toBe('base-olio-evo');
    expect(results[0].confidence).toBe(0.95);
  });

  it('petto di pollo matches petto di pollo entry at 0.95', async () => {
    const results = await search('petto di pollo');
    expect(results[0].id).toBe('base-petto-di-pollo');
    expect(results[0].confidence).toBe(0.95);
  });
});

// ─── Starts-with / prefix matches (confidence 0.80) ──────────────────────────

describe('baseIngredientsProvider — starts-with / prefix matches', () => {
  it('banana media matches banana at 0.80 (query starts with alias)', async () => {
    const results = await search('banana media');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('base-banana');
    expect(results[0].confidence).toBe(0.80);
  });

  it('miele di acacia matches miele at 0.95 (it is an alias)', async () => {
    const results = await search('miele di acacia');
    expect(results[0].id).toBe('base-miele');
    // "miele di acacia" is an exact alias → 0.95
    expect(results[0].confidence).toBe(0.95);
  });

  it('carne macinata matches carne macinata di manzo via prefix at 0.80', async () => {
    const results = await search('carne macinata');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('base-carne-macinata');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.80);
  });

  it('latte scremato matches latte scremato entry at 0.95', async () => {
    const results = await search('latte scremato');
    expect(results[0].id).toBe('base-latte-scremato');
    expect(results[0].confidence).toBe(0.95);
  });
});

// ─── Contains matches (confidence 0.75) ──────────────────────────────────────

describe('baseIngredientsProvider — safe contains matches', () => {
  it("'miele opzionale' matches miele (query starts with alias)", async () => {
    const results = await search('miele opzionale');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('base-miele');
  });

  it("miele (5g, opzionale) matches miele after punctuation stripping", async () => {
    const results = await search('miele (5g, opzionale)');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('base-miele');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.75);
  });
});

// ─── Safety: "di X" compounds must NOT produce false positives ───────────────

describe('baseIngredientsProvider — "di X" compound safety', () => {
  it('farina di mandorle does NOT match farina 00', async () => {
    const results = await search('farina di mandorle');
    const farina00 = results.find(r => r.id === 'base-farina-00');
    expect(farina00).toBeUndefined();
  });

  it('latte di soia does NOT match latte intero or latte parzialmente scremato', async () => {
    const results = await search('latte di soia');
    const latteIntero = results.find(r => r.id === 'base-latte-intero');
    const latteParz   = results.find(r => r.id === 'base-latte-parzialmente-scremato');
    expect(latteIntero).toBeUndefined();
    expect(latteParz).toBeUndefined();
  });

  it('burro di arachidi does NOT match burro', async () => {
    const results = await search('burro di arachidi');
    const burro = results.find(r => r.id === 'base-burro');
    expect(burro).toBeUndefined();
  });

  it('olio di girasole does NOT match burro (no girasole entry, no cross-match)', async () => {
    const results = await search('olio di girasole');
    // olio is alias of olio-evo, but "olio di girasole" has "di" → no match
    const olioEvo = results.find(r => r.id === 'base-olio-evo');
    expect(olioEvo).toBeUndefined();
  });
});

// ─── Unknown ingredients → empty results ─────────────────────────────────────

describe('baseIngredientsProvider — unknown ingredients', () => {
  it('unknown ingredient returns empty array', async () => {
    const results = await search('ingrediente sconosciuto xyz');
    expect(results).toEqual([]);
  });

  it('empty query returns empty array', async () => {
    const results = await search('');
    expect(results).toEqual([]);
  });

  it('whitespace-only query returns empty array', async () => {
    const results = await search('   ');
    expect(results).toEqual([]);
  });
});

// ─── maxResults ───────────────────────────────────────────────────────────────

describe('baseIngredientsProvider — maxResults', () => {
  it('returns at most maxResults entries', async () => {
    // A broad query that may match several entries
    const results = await search('latte', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('maxResults=1 returns exactly one result when a match exists', async () => {
    const results = await search('cannella', 1);
    expect(results.length).toBe(1);
  });
});

// ─── Confidence ordering ──────────────────────────────────────────────────────

describe('baseIngredientsProvider — confidence ordering', () => {
  it('results are sorted descending by confidence', async () => {
    const results = await search('latte parzialmente scremato');
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].confidence).toBeGreaterThanOrEqual(results[i + 1].confidence);
    }
  });

  it('best match is always first', async () => {
    const results = await search('avena');
    if (results.length > 1) {
      for (let i = 1; i < results.length; i++) {
        expect(results[0].confidence).toBeGreaterThanOrEqual(results[i].confidence);
      }
    }
  });
});

// ─── Nutrition data sanity ────────────────────────────────────────────────────

describe('baseIngredientsProvider — nutrition data sanity', () => {
  it("fiocchi d'avena entry has sensible kcal", async () => {
    const results = await search("fiocchi d'avena");
    expect(results[0].nutritionPer100g.kcal).toBeGreaterThan(300);
    expect(results[0].nutritionPer100g.kcal).toBeLessThan(500);
  });

  it('latte parzialmente scremato has lower fat than latte intero', async () => {
    const [parz] = await search('latte parzialmente scremato');
    const [intero] = await search('latte intero');
    expect(parz.nutritionPer100g.fatG!).toBeLessThan(intero.nutritionPer100g.fatG!);
  });

  it('cannella has kcal defined', async () => {
    const [r] = await search('cannella');
    expect(r.nutritionPer100g.kcal).toBeGreaterThan(0);
  });

  it('mandorle have high fat content', async () => {
    const [r] = await search('mandorle');
    expect(r.nutritionPer100g.fatG!).toBeGreaterThan(40);
  });

  it('miele has high carbs', async () => {
    const [r] = await search('miele');
    expect(r.nutritionPer100g.carbsG!).toBeGreaterThan(70);
  });
});
