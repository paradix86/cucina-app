import { describe, it, expect } from 'vitest';
import {
  normalizeIngredientName,
  getIngredientAliases,
  buildNutritionSearchQueries,
} from '../../src/lib/ingredientMatching';

// ─── normalizeIngredientName ──────────────────────────────────────────────────

describe('normalizeIngredientName', () => {
  it('lowercases the input', () => {
    expect(normalizeIngredientName('Olio')).toBe('olio');
    expect(normalizeIngredientName('PASTA')).toBe('pasta');
    expect(normalizeIngredientName('Farina 00')).toBe('farina 00');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeIngredientName('  olio  ')).toBe('olio');
    expect(normalizeIngredientName('\tolio evo\n')).toBe('olio evo');
  });

  it('collapses internal whitespace to single spaces', () => {
    expect(normalizeIngredientName('olio  extravergine')).toBe('olio extravergine');
    expect(normalizeIngredientName('pasta   integrale')).toBe('pasta integrale');
  });

  it('lowercases and trims together', () => {
    expect(normalizeIngredientName('  Olio EVO  ')).toBe('olio evo');
    expect(normalizeIngredientName('RISO  Basmati')).toBe('riso basmati');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeIngredientName('')).toBe('');
  });

  it('preserves Italian diacritics', () => {
    expect(normalizeIngredientName('Pomodorò')).toBe('pomodorò');
  });
});

// ─── getIngredientAliases ─────────────────────────────────────────────────────

describe('getIngredientAliases — identity (no rule matches)', () => {
  it('returns just the name when no alias rule applies', () => {
    expect(getIngredientAliases('pomodoro')).toEqual(['pomodoro']);
    expect(getIngredientAliases('parmigiano')).toEqual(['parmigiano']);
    expect(getIngredientAliases('cipolla')).toEqual(['cipolla']);
    expect(getIngredientAliases('pasta')).toEqual(['pasta']);  // base name, no rule fires
    expect(getIngredientAliases('olio')).toEqual(['olio']);    // base name, no rule fires
  });
});

describe('getIngredientAliases — olio variants', () => {
  it('olio extravergine di oliva → includes olio', () => {
    const r = getIngredientAliases('olio extravergine di oliva');
    expect(r[0]).toBe('olio extravergine di oliva');
    expect(r).toContain('olio');
  });

  it('olio extravergine → includes olio', () => {
    const r = getIngredientAliases('olio extravergine');
    expect(r).toContain('olio');
  });

  it('olio evo → includes olio', () => {
    const r = getIngredientAliases('olio evo');
    expect(r[0]).toBe('olio evo');
    expect(r).toContain('olio');
  });

  it("olio d'oliva → includes olio", () => {
    const r = getIngredientAliases("olio d'oliva");
    expect(r).toContain('olio');
  });

  it('olio di oliva → includes olio', () => {
    const r = getIngredientAliases('olio di oliva');
    expect(r).toContain('olio');
  });

  it('primary name is always first', () => {
    const r = getIngredientAliases('olio evo');
    expect(r[0]).toBe('olio evo');
  });

  it('deduplicated when multiple rules fire with same base', () => {
    // 'olio extravergine di oliva' fires both 'olio extravergine di oliva' and
    // 'olio extravergine' rules — both point to base 'olio', so 'olio' appears once.
    const r = getIngredientAliases('olio extravergine di oliva');
    const olioCopies = r.filter(x => x === 'olio');
    expect(olioCopies).toHaveLength(1);
  });
});

describe('getIngredientAliases — farina variants', () => {
  it('farina 00 → includes farina', () => {
    const r = getIngredientAliases('farina 00');
    expect(r[0]).toBe('farina 00');
    expect(r).toContain('farina');
  });

  it('farina integrale → includes farina', () => {
    expect(getIngredientAliases('farina integrale')).toContain('farina');
  });

  it('farina di grano tenero → includes farina', () => {
    expect(getIngredientAliases('farina di grano tenero')).toContain('farina');
  });
});

describe('getIngredientAliases — riso variants', () => {
  it('riso basmati → includes riso', () => {
    const r = getIngredientAliases('riso basmati');
    expect(r[0]).toBe('riso basmati');
    expect(r).toContain('riso');
  });

  it('riso integrale → includes riso', () => {
    expect(getIngredientAliases('riso integrale')).toContain('riso');
  });
});

describe('getIngredientAliases — pasta variants', () => {
  it('pasta integrale → includes pasta', () => {
    const r = getIngredientAliases('pasta integrale');
    expect(r[0]).toBe('pasta integrale');
    expect(r).toContain('pasta');
  });

  it('pasta fresca → includes pasta', () => {
    expect(getIngredientAliases('pasta fresca')).toContain('pasta');
  });
});

describe('getIngredientAliases — zucchero variants', () => {
  it('zucchero bianco → includes zucchero', () => {
    const r = getIngredientAliases('zucchero bianco');
    expect(r[0]).toBe('zucchero bianco');
    expect(r).toContain('zucchero');
  });

  it('zucchero di canna → includes zucchero', () => {
    expect(getIngredientAliases('zucchero di canna')).toContain('zucchero');
  });
});

describe('getIngredientAliases — uova/uovo', () => {
  it('uova → includes uovo', () => {
    const r = getIngredientAliases('uova');
    expect(r[0]).toBe('uova');
    expect(r).toContain('uovo');
  });

  it('uove → includes uovo', () => {
    expect(getIngredientAliases('uove')).toContain('uovo');
  });
});

describe('getIngredientAliases — prefix word-boundary rule', () => {
  it('fires when normalizedName starts with trigger followed by space', () => {
    // 'pasta integrale bio' starts with 'pasta integrale '
    expect(getIngredientAliases('pasta integrale bio')).toContain('pasta');
  });

  it('does NOT fire when trigger is embedded mid-word', () => {
    // 'zucchero bianchissimo' starts with 'zucchero bianco'? No — 'bianchissimo' ≠ 'bianco'
    expect(getIngredientAliases('zucchero bianchissimo')).toEqual(['zucchero bianchissimo']);
  });
});

// ─── buildNutritionSearchQueries ─────────────────────────────────────────────

describe('buildNutritionSearchQueries — query order', () => {
  it('first query is always the primary normalised name', () => {
    const qs = buildNutritionSearchQueries('olio evo', 'original olio evo');
    expect(qs[0]).toBe('olio evo');
  });

  it('olio evo → [olio evo, olio]', () => {
    expect(buildNutritionSearchQueries('olio evo', '')).toEqual(['olio evo', 'olio']);
  });

  it('olio extravergine di oliva → [olio extravergine di oliva, olio]', () => {
    expect(buildNutritionSearchQueries('olio extravergine di oliva', '')).toEqual([
      'olio extravergine di oliva',
      'olio',
    ]);
  });

  it('farina 00 → [farina 00, farina]', () => {
    expect(buildNutritionSearchQueries('farina 00', '')).toEqual(['farina 00', 'farina']);
  });

  it('pasta integrale → [pasta integrale, pasta]', () => {
    expect(buildNutritionSearchQueries('pasta integrale', '')).toEqual(['pasta integrale', 'pasta']);
  });

  it('riso basmati → [riso basmati, riso]', () => {
    expect(buildNutritionSearchQueries('riso basmati', '')).toEqual(['riso basmati', 'riso']);
  });

  it('zucchero bianco → [zucchero bianco, zucchero]', () => {
    expect(buildNutritionSearchQueries('zucchero bianco', '')).toEqual(['zucchero bianco', 'zucchero']);
  });

  it('uova → [uova, uovo]', () => {
    expect(buildNutritionSearchQueries('uova', '')).toEqual(['uova', 'uovo']);
  });

  it('returns single-element list when no alias rule applies', () => {
    expect(buildNutritionSearchQueries('pomodoro', '')).toEqual(['pomodoro']);
    expect(buildNutritionSearchQueries('parmigiano', '')).toEqual(['parmigiano']);
    expect(buildNutritionSearchQueries('cipolla', '')).toEqual(['cipolla']);
  });
});

describe('buildNutritionSearchQueries — normalisation', () => {
  it('normalises the primary query', () => {
    const qs = buildNutritionSearchQueries('Olio EVO', '');
    expect(qs[0]).toBe('olio evo');
  });

  it('uses originalName when normalizedName is undefined', () => {
    const qs = buildNutritionSearchQueries(undefined, 'Pasta Integrale');
    expect(qs[0]).toBe('pasta integrale');
    expect(qs).toContain('pasta');
  });

  it('returns [] for blank input', () => {
    expect(buildNutritionSearchQueries('', '')).toEqual([]);
    expect(buildNutritionSearchQueries(undefined, '')).toEqual([]);
    expect(buildNutritionSearchQueries('   ', '   ')).toEqual([]);
  });
});

describe('buildNutritionSearchQueries — deduplication', () => {
  it('does not repeat the primary name in alias positions', () => {
    // Base case: 'olio' has no alias rules, so only ['olio']
    const qs = buildNutritionSearchQueries('olio', '');
    expect(qs).toEqual(['olio']);
    expect(qs).toHaveLength(1);
  });

  it('alias base never duplicates the primary', () => {
    // If somehow a rule produced primary === base, dedup removes it
    const qs = buildNutritionSearchQueries('farina 00', '');
    const farinaCount = qs.filter(q => q === 'farina 00').length;
    expect(farinaCount).toBe(1);
  });
});
