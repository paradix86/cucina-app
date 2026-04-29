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

// ─── New entries: Mexican recipe ingredients ──────────────────────────────────

describe('baseIngredientsProvider — new Mexican recipe entries', () => {
  it('mais matches base-mais at >=0.95', async () => {
    const results = await search('mais');
    expect(results[0].id).toBe('base-mais');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('mais dolce matches base-mais at >=0.95', async () => {
    const results = await search('mais dolce');
    expect(results[0].id).toBe('base-mais');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('peperone rosso matches base-peperone at >=0.95', async () => {
    const results = await search('peperone rosso');
    expect(results[0].id).toBe('base-peperone');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('origano matches base-origano at 0.95', async () => {
    const results = await search('origano');
    expect(results[0].id).toBe('base-origano');
    expect(results[0].confidence).toBe(0.95);
  });

  it('paprika matches base-paprika at 0.95', async () => {
    const results = await search('paprika');
    expect(results[0].id).toBe('base-paprika');
    expect(results[0].confidence).toBe(0.95);
  });

  it('cumino matches base-cumino at 0.95', async () => {
    const results = await search('cumino');
    expect(results[0].id).toBe('base-cumino');
    expect(results[0].confidence).toBe(0.95);
  });

  it('cacao amaro matches base-cacao at >=0.95', async () => {
    const results = await search('cacao amaro');
    expect(results[0].id).toBe('base-cacao');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('brodo matches base-brodo at 0.95', async () => {
    const results = await search('brodo');
    expect(results[0].id).toBe('base-brodo');
    expect(results[0].confidence).toBe(0.95);
  });

  it('lime matches base-lime at 0.95', async () => {
    const results = await search('lime');
    expect(results[0].id).toBe('base-lime');
    expect(results[0].confidence).toBe(0.95);
  });

  it('coriandolo matches base-coriandolo at 0.95', async () => {
    const results = await search('coriandolo');
    expect(results[0].id).toBe('base-coriandolo');
    expect(results[0].confidence).toBe(0.95);
  });

  it('fagioli rossi matches base-fagioli', async () => {
    const results = await search('fagioli rossi');
    expect(results[0].id).toBe('base-fagioli');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.75);
  });
});

// ─── New entries: built-in recipe coverage ────────────────────────────────────

describe('baseIngredientsProvider — built-in recipe coverage (dairy)', () => {
  it('mascarpone matches base-mascarpone at 0.95', async () => {
    const results = await search('mascarpone');
    expect(results[0].id).toBe('base-mascarpone');
    expect(results[0].confidence).toBe(0.95);
  });

  it('panna da cucina matches base-panna-cucina at 0.95', async () => {
    const results = await search('panna da cucina');
    expect(results[0].id).toBe('base-panna-cucina');
    expect(results[0].confidence).toBe(0.95);
  });

  it('pecorino sardo matches base-pecorino at 0.95', async () => {
    const results = await search('pecorino sardo');
    expect(results[0].id).toBe('base-pecorino');
    expect(results[0].confidence).toBe(0.95);
  });

  it('tuorli matches base-uova at >=0.95', async () => {
    const results = await search('tuorli');
    expect(results[0].id).toBe('base-uova');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.95);
  });
});

describe('baseIngredientsProvider — built-in recipe coverage (cereals)', () => {
  it('gnocchi di patate matches base-gnocchi-patate at 0.95', async () => {
    const results = await search('gnocchi di patate');
    expect(results[0].id).toBe('base-gnocchi-patate');
    expect(results[0].confidence).toBe(0.95);
  });

  it('gnocchi matches base-gnocchi-patate at 0.95', async () => {
    const results = await search('gnocchi');
    expect(results[0].id).toBe('base-gnocchi-patate');
    expect(results[0].confidence).toBe(0.95);
  });

  it('savoiardi matches base-savoiardi at 0.95', async () => {
    const results = await search('savoiardi');
    expect(results[0].id).toBe('base-savoiardi');
    expect(results[0].confidence).toBe(0.95);
  });

  it('amido di mais matches base-amido-mais at 0.95', async () => {
    const results = await search('amido di mais');
    expect(results[0].id).toBe('base-amido-mais');
    expect(results[0].confidence).toBe(0.95);
  });
});

describe('baseIngredientsProvider — built-in recipe coverage (vegetables)', () => {
  it('zucca matches base-zucca at 0.95', async () => {
    const results = await search('zucca');
    expect(results[0].id).toBe('base-zucca');
    expect(results[0].confidence).toBe(0.95);
  });

  it('fagiolini matches base-fagiolini at 0.95', async () => {
    const results = await search('fagiolini');
    expect(results[0].id).toBe('base-fagiolini');
    expect(results[0].confidence).toBe(0.95);
  });

  it('costa sedano matches base-sedano at 0.95', async () => {
    const results = await search('costa sedano');
    expect(results[0].id).toBe('base-sedano');
    expect(results[0].confidence).toBe(0.95);
  });

  it('coste sedano matches base-sedano at 0.95', async () => {
    const results = await search('coste sedano');
    expect(results[0].id).toBe('base-sedano');
    expect(results[0].confidence).toBe(0.95);
  });

  it('scalogno matches base-scalogno at 0.95', async () => {
    const results = await search('scalogno');
    expect(results[0].id).toBe('base-scalogno');
    expect(results[0].confidence).toBe(0.95);
  });

  it('cannellini in scatola matches base-fagioli at 0.95', async () => {
    const results = await search('cannellini in scatola');
    expect(results[0].id).toBe('base-fagioli');
    expect(results[0].confidence).toBe(0.95);
  });
});

describe('baseIngredientsProvider — built-in recipe coverage (nuts)', () => {
  it('pinoli matches base-pinoli at 0.95', async () => {
    const results = await search('pinoli');
    expect(results[0].id).toBe('base-pinoli');
    expect(results[0].confidence).toBe(0.95);
  });

  it('tahini matches base-tahini at 0.95', async () => {
    const results = await search('tahini');
    expect(results[0].id).toBe('base-tahini');
    expect(results[0].confidence).toBe(0.95);
  });
});

describe('baseIngredientsProvider — built-in recipe coverage (herbs / condiments)', () => {
  it('rosmarino matches base-rosmarino at 0.95', async () => {
    const results = await search('rosmarino');
    expect(results[0].id).toBe('base-rosmarino');
    expect(results[0].confidence).toBe(0.95);
  });

  it('noce moscata matches base-noce-moscata at 0.95', async () => {
    const results = await search('noce moscata');
    expect(results[0].id).toBe('base-noce-moscata');
    expect(results[0].confidence).toBe(0.95);
  });

  it('vino bianco secco matches base-vino-bianco at 0.95', async () => {
    const results = await search('vino bianco secco');
    expect(results[0].id).toBe('base-vino-bianco');
    expect(results[0].confidence).toBe(0.95);
  });

  it('vino rosso matches base-vino-rosso at 0.95', async () => {
    const results = await search('vino rosso');
    expect(results[0].id).toBe('base-vino-rosso');
    expect(results[0].confidence).toBe(0.95);
  });

  it('zafferano matches base-zafferano at 0.95', async () => {
    const results = await search('zafferano');
    expect(results[0].id).toBe('base-zafferano');
    expect(results[0].confidence).toBe(0.95);
  });

  it('alloro matches base-alloro at 0.95', async () => {
    const results = await search('alloro');
    expect(results[0].id).toBe('base-alloro');
    expect(results[0].confidence).toBe(0.95);
  });

  it('caffè forte matches base-caffe at 0.95', async () => {
    const results = await search('caffè forte');
    expect(results[0].id).toBe('base-caffe');
    expect(results[0].confidence).toBe(0.95);
  });

  it('aglio in polvere matches base-aglio at >=0.95', async () => {
    const results = await search('aglio in polvere');
    expect(results[0].id).toBe('base-aglio');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.95);
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

// ─── Multilingual helpers ─────────────────────────────────────────────────────

async function searchLang(q: string, lang: string, max = 5) {
  return baseIngredientsProvider.search({ query: q, normalizedQuery: q, language: lang, maxResults: max });
}

// ─── Multilingual EN queries ──────────────────────────────────────────────────

describe('baseIngredientsProvider — multilingual EN queries', () => {
  it('oats → base-avena at 0.95', async () => {
    const [r] = await searchLang('oats', 'en');
    expect(r?.id).toBe('base-avena');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('tomato → base-pomodoro at 0.95', async () => {
    const [r] = await searchLang('tomato', 'en');
    expect(r?.id).toBe('base-pomodoro');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('milk → base-latte-intero at 0.95', async () => {
    const [r] = await searchLang('milk', 'en');
    expect(r?.id).toBe('base-latte-intero');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('banana → base-banana at 0.95', async () => {
    const [r] = await searchLang('banana', 'en');
    expect(r?.id).toBe('base-banana');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('rice → base-riso-bianco at 0.95', async () => {
    const [r] = await searchLang('rice', 'en');
    expect(r?.id).toBe('base-riso-bianco');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('pasta → base-pasta-secca at 0.95', async () => {
    const [r] = await searchLang('pasta', 'en');
    expect(r?.id).toBe('base-pasta-secca');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('egg → base-uova at 0.95', async () => {
    const [r] = await searchLang('egg', 'en');
    expect(r?.id).toBe('base-uova');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('chicken → base-pollo at 0.95', async () => {
    const [r] = await searchLang('chicken', 'en');
    expect(r?.id).toBe('base-pollo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('beans → base-fagioli at 0.95', async () => {
    const [r] = await searchLang('beans', 'en');
    expect(r?.id).toBe('base-fagioli');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('corn → base-mais at 0.95', async () => {
    const [r] = await searchLang('corn', 'en');
    expect(r?.id).toBe('base-mais');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });
});

// ─── Multilingual DE queries ──────────────────────────────────────────────────

describe('baseIngredientsProvider — multilingual DE queries', () => {
  it('haferflocken → base-avena at 0.95', async () => {
    const [r] = await searchLang('haferflocken', 'de');
    expect(r?.id).toBe('base-avena');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('tomate → base-pomodoro at 0.95', async () => {
    const [r] = await searchLang('tomate', 'de');
    expect(r?.id).toBe('base-pomodoro');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('milch → base-latte-intero at 0.95', async () => {
    const [r] = await searchLang('milch', 'de');
    expect(r?.id).toBe('base-latte-intero');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('banane → base-banana at 0.95', async () => {
    const [r] = await searchLang('banane', 'de');
    expect(r?.id).toBe('base-banana');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('reis → base-riso-bianco at 0.95', async () => {
    const [r] = await searchLang('reis', 'de');
    expect(r?.id).toBe('base-riso-bianco');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('nudeln → base-pasta-secca at 0.95', async () => {
    const [r] = await searchLang('nudeln', 'de');
    expect(r?.id).toBe('base-pasta-secca');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('eier → base-uova at 0.95', async () => {
    const [r] = await searchLang('eier', 'de');
    expect(r?.id).toBe('base-uova');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('hähnchen → base-pollo at 0.95', async () => {
    const [r] = await searchLang('hähnchen', 'de');
    expect(r?.id).toBe('base-pollo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('bohnen → base-fagioli at 0.95', async () => {
    const [r] = await searchLang('bohnen', 'de');
    expect(r?.id).toBe('base-fagioli');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('mais → base-mais at 0.95', async () => {
    const [r] = await searchLang('mais', 'de');
    expect(r?.id).toBe('base-mais');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });
});

// ─── Multilingual FR queries ──────────────────────────────────────────────────

describe('baseIngredientsProvider — multilingual FR queries', () => {
  it("flocons d'avoine → base-avena at 0.95", async () => {
    const [r] = await searchLang("flocons d'avoine", 'fr');
    expect(r?.id).toBe('base-avena');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('tomate → base-pomodoro at 0.95', async () => {
    const [r] = await searchLang('tomate', 'fr');
    expect(r?.id).toBe('base-pomodoro');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('lait → base-latte-intero at 0.95', async () => {
    const [r] = await searchLang('lait', 'fr');
    expect(r?.id).toBe('base-latte-intero');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('banane → base-banana at 0.95', async () => {
    const [r] = await searchLang('banane', 'fr');
    expect(r?.id).toBe('base-banana');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('riz → base-riso-bianco at 0.95', async () => {
    const [r] = await searchLang('riz', 'fr');
    expect(r?.id).toBe('base-riso-bianco');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('pâtes → base-pasta-secca at 0.95', async () => {
    const [r] = await searchLang('pâtes', 'fr');
    expect(r?.id).toBe('base-pasta-secca');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('oeuf → base-uova at 0.95', async () => {
    const [r] = await searchLang('oeuf', 'fr');
    expect(r?.id).toBe('base-uova');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('poulet → base-pollo at 0.95', async () => {
    const [r] = await searchLang('poulet', 'fr');
    expect(r?.id).toBe('base-pollo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('haricots → base-fagioli at 0.95', async () => {
    const [r] = await searchLang('haricots', 'fr');
    expect(r?.id).toBe('base-fagioli');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('maïs → base-mais at 0.95', async () => {
    const [r] = await searchLang('maïs', 'fr');
    expect(r?.id).toBe('base-mais');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });
});

// ─── Multilingual ES queries ──────────────────────────────────────────────────

describe('baseIngredientsProvider — multilingual ES queries', () => {
  it('avena → base-avena at 0.95', async () => {
    const [r] = await searchLang('avena', 'es');
    expect(r?.id).toBe('base-avena');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('tomate → base-pomodoro at 0.95', async () => {
    const [r] = await searchLang('tomate', 'es');
    expect(r?.id).toBe('base-pomodoro');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('leche → base-latte-intero at 0.95', async () => {
    const [r] = await searchLang('leche', 'es');
    expect(r?.id).toBe('base-latte-intero');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('plátano → base-banana at 0.95', async () => {
    const [r] = await searchLang('plátano', 'es');
    expect(r?.id).toBe('base-banana');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('arroz → base-riso-bianco at 0.95', async () => {
    const [r] = await searchLang('arroz', 'es');
    expect(r?.id).toBe('base-riso-bianco');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('pasta → base-pasta-secca at 0.95', async () => {
    const [r] = await searchLang('pasta', 'es');
    expect(r?.id).toBe('base-pasta-secca');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('huevo → base-uova at 0.95', async () => {
    const [r] = await searchLang('huevo', 'es');
    expect(r?.id).toBe('base-uova');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('pollo → base-pollo at 0.95', async () => {
    const [r] = await searchLang('pollo', 'es');
    expect(r?.id).toBe('base-pollo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('alubias → base-fagioli at 0.95', async () => {
    const [r] = await searchLang('alubias', 'es');
    expect(r?.id).toBe('base-fagioli');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('maíz → base-mais at 0.95', async () => {
    const [r] = await searchLang('maíz', 'es');
    expect(r?.id).toBe('base-mais');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });
});

// ─── Cross-language safety ────────────────────────────────────────────────────

describe('baseIngredientsProvider — cross-language safety', () => {
  it('almond flour must not match base-farina-00 (strictly undefined)', async () => {
    const results = await searchLang('almond flour', 'en');
    const wheatFlour = results.find(r => r.id === 'base-farina-00');
    expect(wheatFlour).toBeUndefined();
  });

  it('soy milk must score below 0.80 for base-latte-intero', async () => {
    const results = await searchLang('soy milk', 'en');
    const wholeMilk = results.find(r => r.id === 'base-latte-intero');
    if (wholeMilk) {
      expect(wholeMilk.confidence).toBeLessThan(0.80);
    }
  });

  it('peanut butter must score below 0.80 for base-burro', async () => {
    const results = await searchLang('peanut butter', 'en');
    const butter = results.find(r => r.id === 'base-burro');
    if (butter) {
      expect(butter.confidence).toBeLessThan(0.80);
    }
  });
});

// ─── Cross-language fallback ──────────────────────────────────────────────────

describe('baseIngredientsProvider — cross-language fallback', () => {
  it('EN query with IT app language matches at 0.90 (cross-lang)', async () => {
    const [r] = await searchLang('sweet corn', 'it');
    expect(r?.id).toBe('base-mais');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.90);
  });

  it('IT query with EN app language matches at 0.90 (cross-lang)', async () => {
    const [r] = await searchLang('mais dolce', 'en');
    expect(r?.id).toBe('base-mais');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.90);
  });

  it('garlic (EN) with IT app language matches base-aglio', async () => {
    const [r] = await searchLang('garlic', 'it');
    expect(r?.id).toBe('base-aglio');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.90);
  });

  it('aglio (IT) with EN app language matches base-aglio', async () => {
    const [r] = await searchLang('aglio', 'en');
    expect(r?.id).toBe('base-aglio');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.90);
  });

  it('cilantro (EN) with IT app language matches base-coriandolo', async () => {
    const [r] = await searchLang('cilantro', 'it');
    expect(r?.id).toBe('base-coriandolo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.90);
  });

  it('vegetable broth (EN) with IT app language matches base-brodo', async () => {
    const [r] = await searchLang('vegetable broth', 'it');
    expect(r?.id).toBe('base-brodo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.90);
  });

  it('beef broth (EN) with DE app language matches base-brodo', async () => {
    const [r] = await searchLang('beef broth', 'de');
    expect(r?.id).toBe('base-brodo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.90);
  });
});

// ─── Hardened ingredient aliases ──────────────────────────────────────────────

describe('baseIngredientsProvider — hardened ingredient aliases', () => {
  it('peeled tomatoes (EN) matches base-pomodoro', async () => {
    const [r] = await searchLang('peeled tomatoes', 'en');
    expect(r?.id).toBe('base-pomodoro');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('canned tomatoes (EN) matches base-pomodoro', async () => {
    const [r] = await searchLang('canned tomatoes', 'en');
    expect(r?.id).toBe('base-pomodoro');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('red kidney beans (EN) matches base-fagioli', async () => {
    const [r] = await searchLang('red kidney beans', 'en');
    expect(r?.id).toBe('base-fagioli');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('frijoles rojos (ES) matches base-fagioli', async () => {
    const [r] = await searchLang('frijoles rojos', 'es');
    expect(r?.id).toBe('base-fagioli');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('rote Bohnen (DE) matches base-fagioli', async () => {
    const [r] = await searchLang('rote bohnen', 'de');
    expect(r?.id).toBe('base-fagioli');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('haricots rouges (FR) matches base-fagioli', async () => {
    const [r] = await searchLang('haricots rouges', 'fr');
    expect(r?.id).toBe('base-fagioli');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('red bell pepper (EN) matches base-peperone', async () => {
    const [r] = await searchLang('red bell pepper', 'en');
    expect(r?.id).toBe('base-peperone');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('mais dolce in scatola (IT) matches base-mais via prefix', async () => {
    const [r] = await search('mais dolce in scatola');
    expect(r?.id).toBe('base-mais');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.80);
  });

  it('brodo vegetale (IT) matches base-brodo', async () => {
    const [r] = await search('brodo vegetale');
    expect(r?.id).toBe('base-brodo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('brodo di carne (IT) matches base-brodo', async () => {
    const [r] = await search('brodo di carne');
    expect(r?.id).toBe('base-brodo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('coriandolo fresco (IT) matches base-coriandolo', async () => {
    const [r] = await search('coriandolo fresco');
    expect(r?.id).toBe('base-coriandolo');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('paprika affumicata (IT) matches base-paprika', async () => {
    const [r] = await search('paprika affumicata');
    expect(r?.id).toBe('base-paprika');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('peperone rosso (IT) matches base-peperone', async () => {
    const [r] = await search('peperone rosso');
    expect(r?.id).toBe('base-peperone');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95);
  });
});
