import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseJsonLdRecipeFromHtml,
  parseWprmRecipeFromHtml,
  extractHtmlMetaFields,
  extractMainContentImageUrl,
} from '../../src/lib/import/adapters';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_URL = 'https://example.com/ricetta/pasta';

function wrapJsonLd(json: string): string {
  return `<html><head><script type="application/ld+json">${json}</script></head></html>`;
}

function loadFixture(relativePath: string): string {
  return readFileSync(new URL(`../fixtures/import/${relativePath}`, import.meta.url), 'utf8');
}

const VALID_JSONLD_RECIPE = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Pasta al Pomodoro',
  recipeIngredient: ['400 g pasta', '500 g pomodori pelati', '2 spicchi aglio', '3 cucchiai olio EVO'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Cuocere la pasta in abbondante acqua salata.' },
    { '@type': 'HowToStep', text: 'Preparare il sugo con i pomodori e aglio.' },
    { '@type': 'HowToStep', text: 'Condire la pasta con il sugo e servire.' },
  ],
  totalTime: 'PT30M',
  recipeYield: '4 persone',
});

const WPRM_SCRIPT = (recipe: object) =>
  `<script>\nvar wprm_public_js_data = ${JSON.stringify({ recipe })};\n</script>`;

const VALID_WPRM_RECIPE = {
  name: 'Torta al Cioccolato',
  ingredients: [
    [
      { amount: '200', unit: 'g', name: 'farina', notes: '' },
      { amount: '100', unit: 'g', name: 'cacao amaro', notes: 'setacciato' },
      { amount: '3', unit: '', name: 'uova', notes: '' },
    ],
  ],
  instructions: [
    [
      { text: 'Setacciare farina e cacao in una ciotola.' },
      { text: 'Aggiungere le uova e mescolare fino a ottenere un impasto omogeneo.' },
      { text: 'Versare in una teglia e cuocere a 180°C per 35 minuti.' },
    ],
  ],
  total_time: 45,
  servings: 8,
};

// ─── JSON-LD: Valid happy paths ────────────────────────────────────────────────

describe('parseJsonLdRecipeFromHtml — valid Recipe', () => {
  it('extracts name from a complete JSON-LD Recipe node', () => {
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(VALID_JSONLD_RECIPE), TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Pasta al Pomodoro');
  });

  it('extracts all ingredients', () => {
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(VALID_JSONLD_RECIPE), TEST_URL);
    expect(result!.ingredients).toHaveLength(4);
    expect(result!.ingredients[0]).toBe('400 g pasta');
  });

  it('extracts steps from HowToStep array', () => {
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(VALID_JSONLD_RECIPE), TEST_URL);
    expect(result!.steps).toHaveLength(3);
    expect(result!.steps[0]).toContain('pasta');
  });

  it('parses ISO 8601 totalTime to human-readable string', () => {
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(VALID_JSONLD_RECIPE), TEST_URL);
    expect(result!.time).toBe('30 min');
  });

  it('parses 1h 30min ISO duration', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Brasato',
      recipeIngredient: ['1 kg manzo'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Cuocere lentamente.' }],
      totalTime: 'PT1H30M',
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), TEST_URL);
    expect(result!.time).toBe('1h 30 min');
  });

  it('normalises recipeYield, stripping "persone"', () => {
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(VALID_JSONLD_RECIPE), TEST_URL);
    expect(result!.servings).toBe('4');
  });

  it('returns source = "web" and sourceDomain from URL', () => {
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(VALID_JSONLD_RECIPE), TEST_URL);
    expect(result!.source).toBe('web');
    expect(result!.sourceDomain).toBe('example.com');
  });

  it('sets time to n.d. when no duration field is present', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Insalata',
      recipeIngredient: ['lattuga', 'pomodori'],
      recipeInstructions: ['Lavare e mescolare.'],
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), TEST_URL);
    expect(result!.time).toBe('n.d.');
  });

  // Fix 1: prepTime + cookTime summing
  it('sums prepTime + cookTime when totalTime is absent', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Cheesecake',
      recipeIngredient: ['200 g biscotti', '100 g burro', '500 g formaggio'],
      recipeInstructions: ['Preparare la base.', 'Aggiungere la crema.', 'Raffreddare in frigo.'],
      prepTime: 'PT20M',
      cookTime: 'PT40M',
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), TEST_URL);
    expect(result!.time).toBe('1h'); // 20 + 40 = 60 min → formatted as 1h
    expect(result!.timerMinutes).toBe(60);
  });

  it('prefers totalTime over prepTime + cookTime sum', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Pasta',
      recipeIngredient: ['400 g pasta'],
      recipeInstructions: ['Cuocere.'],
      totalTime: 'PT25M',
      prepTime: 'PT10M',
      cookTime: 'PT15M',
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), TEST_URL);
    expect(result!.time).toBe('25 min');
    expect(result!.timerMinutes).toBe(25);
  });

  it('sums hours and minutes correctly across prepTime + cookTime', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Brasato',
      recipeIngredient: ['1 kg manzo'],
      recipeInstructions: ['Rosolare.', 'Cuocere lentamente.'],
      prepTime: 'PT30M',
      cookTime: 'PT1H30M',
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), TEST_URL);
    expect(result!.time).toBe('2h');
    expect(result!.timerMinutes).toBe(120);
  });

  // Fix 2: keywords extraction
  it('extracts keywords string (CSV) into tags', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Baklava',
      recipeIngredient: ['pasta fillo', 'noci', 'miele'],
      recipeInstructions: ['Stendere la pasta.', 'Aggiungere le noci.', 'Cuocere.'],
      keywords: 'dolci, mediorientale, noci',
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), TEST_URL);
    expect(result!.tags).toContain('dolci');
    expect(result!.tags).toContain('mediorientale');
    expect(result!.tags).toContain('noci');
  });

  it('extracts keywords array into tags', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Club Sandwich',
      recipeIngredient: ['pane', 'pollo', 'lattuga'],
      recipeInstructions: ['Assemblare.'],
      keywords: ['pranzo', 'sandwich', 'veloce'],
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), TEST_URL);
    expect(result!.tags).toContain('pranzo');
    expect(result!.tags).toContain('sandwich');
    expect(result!.tags).toContain('veloce');
  });

  it('deduplicates tags when keywords overlap with domain-inferred tags', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Risotto Bimby',
      recipeIngredient: ['riso', 'brodo'],
      recipeInstructions: ['Mettere nel bimby.', 'Cuocere.'],
      keywords: 'Bimby, primo piatto',
    });
    const url = 'https://www.ricette-bimby.net/ricetta/risotto';
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), url);
    const bimbyCount = result!.tags.filter(t => t === 'Bimby').length;
    expect(bimbyCount).toBe(1);
    expect(result!.tags).toContain('primo piatto');
  });

  it('extracts cover image URL from JSON-LD image field', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Lasagne',
      recipeIngredient: ['sfoglia', 'ragu'],
      recipeInstructions: ['Assemblare e cuocere.'],
      image: [
        { '@type': 'ImageObject', url: 'https://example.com/images/lasagne.jpg' },
      ],
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.coverImageUrl).toBe('https://example.com/images/lasagne.jpg');
  });

  it('resolves relative JSON-LD image URLs against page URL', () => {
    const recipe = JSON.stringify({
      '@type': 'Recipe',
      name: 'Piadina',
      recipeIngredient: ['farina', 'acqua'],
      recipeInstructions: ['Impastare e cuocere.'],
      image: '/media/piadina-cover.jpg',
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(recipe), 'https://example.com/recipes/piadina');
    expect(result).not.toBeNull();
    expect(result!.coverImageUrl).toBe('https://example.com/media/piadina-cover.jpg');
  });
});

// ─── JSON-LD: @graph structure ─────────────────────────────────────────────────

describe('parseJsonLdRecipeFromHtml — @graph', () => {
  it('finds Recipe nested inside @graph alongside other node types', () => {
    const graphJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Ricette Facili', url: 'https://example.com' },
        { '@type': 'Organization', name: 'Example Site' },
        {
          '@type': 'Recipe',
          name: 'Risotto ai Funghi',
          recipeIngredient: ['300 g riso Carnaroli', '200 g funghi porcini', '1 lt brodo vegetale'],
          recipeInstructions: [
            { '@type': 'HowToStep', text: 'Tostare il riso in padella.' },
            { '@type': 'HowToStep', text: 'Aggiungere il brodo poco per volta.' },
          ],
          totalTime: 'PT40M',
          recipeYield: '2',
        },
      ],
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(graphJson), TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Risotto ai Funghi');
    expect(result!.ingredients).toHaveLength(3);
    expect(result!.steps).toHaveLength(2);
    expect(result!.time).toBe('40 min');
  });

  it('returns null when @graph contains no Recipe node', () => {
    const graphJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'About' },
        { '@type': 'Organization', name: 'Example' },
      ],
    });
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(graphJson), TEST_URL);
    expect(result).toBeNull();
  });
});

// ─── JSON-LD: instruction format variations ────────────────────────────────────

describe('parseJsonLdRecipeFromHtml — instruction format variations', () => {
  function makeRecipe(instructions: unknown) {
    return wrapJsonLd(
      JSON.stringify({
        '@type': 'Recipe',
        name: 'Test',
        recipeIngredient: ['ingrediente 1'],
        recipeInstructions: instructions,
      }),
    );
  }

  it('accepts a plain string split by newlines', () => {
    const result = parseJsonLdRecipeFromHtml(
      makeRecipe('1. Scaldare il forno.\n2. Mescolare gli ingredienti.\n3. Cuocere per 20 minuti.'),
      TEST_URL,
    );
    expect(result).not.toBeNull();
    expect(result!.steps).toHaveLength(3);
    expect(result!.steps[0]).toBe('Scaldare il forno.');
  });

  it('accepts a plain string array', () => {
    const result = parseJsonLdRecipeFromHtml(
      makeRecipe(['Mettere l\'acqua a bollire.', 'Aggiungere il sale.', 'Cuocere la pasta.']),
      TEST_URL,
    );
    expect(result).not.toBeNull();
    expect(result!.steps).toHaveLength(3);
    expect(result!.steps[1]).toBe('Aggiungere il sale.');
  });

  it('accepts HowToStep array using text field', () => {
    const result = parseJsonLdRecipeFromHtml(
      makeRecipe([
        { '@type': 'HowToStep', text: 'Preparare gli ingredienti.' },
        { '@type': 'HowToStep', text: 'Cuocere a fuoco medio.' },
      ]),
      TEST_URL,
    );
    expect(result).not.toBeNull();
    expect(result!.steps).toHaveLength(2);
  });

  it('accepts HowToSection with nested itemListElement', () => {
    const result = parseJsonLdRecipeFromHtml(
      makeRecipe([
        {
          '@type': 'HowToSection',
          name: 'Preparazione base',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Lavare le verdure.' },
            { '@type': 'HowToStep', text: 'Tagliare a cubetti.' },
          ],
        },
        {
          '@type': 'HowToSection',
          name: 'Cottura',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Rosolare in padella con olio.' },
          ],
        },
      ]),
      TEST_URL,
    );
    expect(result).not.toBeNull();
    expect(result!.steps).toHaveLength(3);
    expect(result!.steps[0]).toBe('Lavare le verdure.');
    expect(result!.steps[2]).toBe('Rosolare in padella con olio.');
  });

  it('accepts plain object with text field (no @type)', () => {
    const result = parseJsonLdRecipeFromHtml(
      makeRecipe([{ text: 'Cuocere per 15 minuti.' }, { text: 'Lasciare riposare.' }]),
      TEST_URL,
    );
    expect(result).not.toBeNull();
    expect(result!.steps).toHaveLength(2);
  });
});

// ─── JSON-LD: fallback name ────────────────────────────────────────────────────

describe('parseJsonLdRecipeFromHtml — fallback name from OG title', () => {
  it('uses fallbackName when Recipe node has no name field', () => {
    const noNameRecipe = wrapJsonLd(
      JSON.stringify({
        '@type': 'Recipe',
        recipeIngredient: ['200 g pasta'],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Cuocere la pasta.' }],
      }),
    );
    const result = parseJsonLdRecipeFromHtml(noNameRecipe, TEST_URL, 'Pasta Semplice (da OG)');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Pasta Semplice (da OG)');
  });

  it('returns null when Recipe node has no name and no fallback is provided', () => {
    const noNameRecipe = wrapJsonLd(
      JSON.stringify({
        '@type': 'Recipe',
        recipeIngredient: ['200 g pasta'],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Cuocere la pasta.' }],
      }),
    );
    const result = parseJsonLdRecipeFromHtml(noNameRecipe, TEST_URL);
    expect(result).toBeNull();
  });
});

// ─── JSON-LD: incomplete data ──────────────────────────────────────────────────

describe('parseJsonLdRecipeFromHtml — incomplete data returns null (no fake success)', () => {
  it('returns null when recipeIngredient is missing', () => {
    const html = wrapJsonLd(
      JSON.stringify({
        '@type': 'Recipe',
        name: 'Ricetta Incompleta',
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Procedimento.' }],
      }),
    );
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('returns null when recipeIngredient is an empty array', () => {
    const html = wrapJsonLd(
      JSON.stringify({
        '@type': 'Recipe',
        name: 'Ricetta Vuota',
        recipeIngredient: [],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Procedimento.' }],
      }),
    );
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('returns null when recipeInstructions is missing', () => {
    const html = wrapJsonLd(
      JSON.stringify({
        '@type': 'Recipe',
        name: 'Ricetta Senza Passi',
        recipeIngredient: ['200 g pasta'],
      }),
    );
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('returns null when recipeInstructions is an empty array', () => {
    const html = wrapJsonLd(
      JSON.stringify({
        '@type': 'Recipe',
        name: 'Ricetta Senza Passi',
        recipeIngredient: ['200 g pasta'],
        recipeInstructions: [],
      }),
    );
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('returns null when there is no Recipe @type at all', () => {
    const html = wrapJsonLd(JSON.stringify({ '@type': 'WebPage', name: 'Una pagina' }));
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('returns null when there is no JSON-LD script at all', () => {
    const html = '<html><head><title>Ricetta</title></head><body><p>Testo senza dati strutturati.</p></body></html>';
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
  });
});

// ─── JSON-LD: multiple script blocks ──────────────────────────────────────────

describe('parseJsonLdRecipeFromHtml — multiple ld+json blocks', () => {
  it('finds Recipe in second block when first block has no Recipe @type', () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
          {"@type": "WebPage", "name": "My Page"}
        </script>
        <script type="application/ld+json">
          ${VALID_JSONLD_RECIPE}
        </script>
      </head>
      </html>`;
    const result = parseJsonLdRecipeFromHtml(html, TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Pasta al Pomodoro');
  });

  it('finds Recipe in a top-level JSON array containing multiple nodes', () => {
    const arrayJson = JSON.stringify([
      { '@type': 'BreadcrumbList', itemListElement: [] },
      {
        '@type': 'Recipe',
        name: 'Gnocchi al Burro',
        recipeIngredient: ['500 g gnocchi', '80 g burro'],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Lessare gli gnocchi.' }],
      },
    ]);
    const result = parseJsonLdRecipeFromHtml(wrapJsonLd(arrayJson), TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Gnocchi al Burro');
  });
});

// ─── JSON-LD: malformed / sanitization ────────────────────────────────────────

describe('parseJsonLdRecipeFromHtml — malformed JSON-LD', () => {
  it('recovers from literal unescaped newline inside a string value (real-world CMS output)', () => {
    // A literal \n inside a JSON string value is invalid JSON but common in CMS output.
    // sanitizeJsonLdText should escape it to \\n so JSON.parse succeeds.
    const rawJson = `{
      "@type": "Recipe",
      "name": "Pasta\ncon Verdure",
      "recipeIngredient": ["400 g pasta", "200 g zucchine"],
      "recipeInstructions": [{"@type":"HowToStep","text":"Cuocere\ntutto insieme."}]
    }`;
    // Inject as a raw string (not JSON.stringify) so the literal \n is preserved
    const html = `<html><head><script type="application/ld+json">${rawJson}</script></head></html>`;
    const result = parseJsonLdRecipeFromHtml(html, TEST_URL);
    expect(result).not.toBeNull();
    // Name with embedded newline is normalised (collapsed to space by normalizeImportText)
    expect(result!.name).toMatch(/Pasta/);
    expect(result!.ingredients).toHaveLength(2);
  });

  it('recovers from literal unescaped tab inside a string value', () => {
    const rawJson = `{
      "@type": "Recipe",
      "name": "Minestra\tCalda",
      "recipeIngredient": ["1 lt brodo"],
      "recipeInstructions": [{"@type":"HowToStep","text":"Scaldare il brodo."}]
    }`;
    const html = `<html><head><script type="application/ld+json">${rawJson}</script></head></html>`;
    const result = parseJsonLdRecipeFromHtml(html, TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.name).toMatch(/Minestra/);
  });

  it('returns null for completely unrecoverable / invalid JSON (not a fixable control char issue)', () => {
    const broken = `{ "@type": "Recipe", "name": "Broken" INVALID_SYNTAX "x" }`;
    const html = `<html><head><script type="application/ld+json">${broken}</script></head></html>`;
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('skips a malformed block and still finds a valid Recipe in a later block', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          { "broken": json_syntax_error }
        </script>
        <script type="application/ld+json">
          ${VALID_JSONLD_RECIPE}
        </script>
      </head></html>`;
    const result = parseJsonLdRecipeFromHtml(html, TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Pasta al Pomodoro');
  });

  it('handles an empty JSON-LD script block without throwing', () => {
    const html = `<html><head><script type="application/ld+json"></script></head></html>`;
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('regression fixture: recovers cucchiaio-style JSON-LD with raw control chars in strings', () => {
    const html = loadFixture('jsonld-cucchiaio-control-chars.html');
    const result = parseJsonLdRecipeFromHtml(html, 'https://www.cucchiaio.it/ricetta/pasta-al-forno/');
    expect(result).not.toBeNull();
    expect(result!.name).toContain('Pasta al Forno');
    expect(result!.ingredients).toHaveLength(3);
    expect(result!.steps).toHaveLength(2);
  });
});

// ─── WPRM: valid extraction ────────────────────────────────────────────────────

describe('parseWprmRecipeFromHtml — valid WPRM data', () => {
  it('extracts name, ingredients, and steps from a well-formed WPRM block', () => {
    const html = `<html><body>${WPRM_SCRIPT(VALID_WPRM_RECIPE)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Torta al Cioccolato');
    expect(result!.ingredients).toHaveLength(3);
    expect(result!.steps).toHaveLength(3);
  });

  it('formats ingredients from amount/unit/name parts with notes in parentheses', () => {
    const html = `<html><body>${WPRM_SCRIPT(VALID_WPRM_RECIPE)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    expect(result!.ingredients[0]).toBe('200 g farina');
    expect(result!.ingredients[1]).toBe('100 g cacao amaro (setacciato)');
    expect(result!.ingredients[2]).toBe('3 uova');
  });

  it('converts total_time number to a "N min" string', () => {
    const html = `<html><body>${WPRM_SCRIPT(VALID_WPRM_RECIPE)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    expect(result!.time).toBe('45 min');
    expect(result!.timerMinutes).toBe(45);
  });

  it('returns servings as a string', () => {
    const html = `<html><body>${WPRM_SCRIPT(VALID_WPRM_RECIPE)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    expect(result!.servings).toBe('8');
  });

  it('returns time = n.d. when total_time is 0', () => {
    const recipe = { ...VALID_WPRM_RECIPE, total_time: 0 };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    expect(result!.time).toBe('n.d.');
  });

  it('uses metaTitle fallback when recipe name is absent', () => {
    const recipe = { ...VALID_WPRM_RECIPE, name: '' };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL, 'Torta (da OG)');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Torta (da OG)');
  });

  it('sets source = "web" and sourceDomain from URL', () => {
    const html = `<html><body>${WPRM_SCRIPT(VALID_WPRM_RECIPE)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    expect(result!.source).toBe('web');
    expect(result!.sourceDomain).toBe('example.com');
  });

  it('extracts cover image URL from WPRM image fields', () => {
    const recipe = {
      ...VALID_WPRM_RECIPE,
      image_url: 'https://example.com/images/torta.jpg',
    };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.coverImageUrl).toBe('https://example.com/images/torta.jpg');
  });

  it('resolves relative WPRM image URLs against page URL', () => {
    const recipe = {
      ...VALID_WPRM_RECIPE,
      image_url: '/images/torta-rel.jpg',
    };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, 'https://example.com/dolci/torta');
    expect(result).not.toBeNull();
    expect(result!.coverImageUrl).toBe('https://example.com/images/torta-rel.jpg');
  });
});

// ─── WPRM: incomplete / missing data ──────────────────────────────────────────

describe('parseWprmRecipeFromHtml — incomplete data returns null (no fake success)', () => {
  it('returns null when name and metaTitle are both absent', () => {
    const recipe = { ...VALID_WPRM_RECIPE, name: '' };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    expect(parseWprmRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('returns null when ingredients array is empty', () => {
    const recipe = { ...VALID_WPRM_RECIPE, ingredients: [[]] };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    expect(parseWprmRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('returns null when instructions array is empty', () => {
    const recipe = { ...VALID_WPRM_RECIPE, instructions: [[]] };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    expect(parseWprmRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('fast-bails and returns null when the WPRM nested-ingredient marker is absent', () => {
    // No "ingredients":[[ substring in HTML → returns null without scanning scripts
    const html = `<html><body><script>var x = {"name":"test"};</script></body></html>`;
    expect(parseWprmRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('returns null for malformed JSON in the WPRM script block', () => {
    const html = `<html><body>
      <script>
        var wprm_public_js_data = { "recipe": { "ingredients":[[BROKEN }};
      </script>
    </body></html>`;
    expect(parseWprmRecipeFromHtml(html, TEST_URL)).toBeNull();
  });
});

// ─── WPRM: Fix 2 — site-provided tags ─────────────────────────────────────────

describe('parseWprmRecipeFromHtml — site-provided tags (Fix 2)', () => {
  it('extracts tags array of {name} objects into recipe tags', () => {
    const recipe = {
      ...VALID_WPRM_RECIPE,
      tags: [{ name: 'dolci' }, { name: 'torta' }, { name: 'cioccolato' }],
    };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    expect(result!.tags).toContain('dolci');
    expect(result!.tags).toContain('torta');
    expect(result!.tags).toContain('cioccolato');
  });

  it('ignores malformed tag entries gracefully', () => {
    const recipe = {
      ...VALID_WPRM_RECIPE,
      tags: [{ name: 'dolci' }, null, '', { name: '' }, 42],
    };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    expect(result!.tags).toContain('dolci');
    expect(result!.tags.filter(Boolean)).toEqual(result!.tags);
  });

  it('deduplicates when WPRM tags overlap with domain-inferred tags', () => {
    const recipe = {
      ...VALID_WPRM_RECIPE,
      tags: [{ name: 'Bimby' }, { name: 'torta' }],
    };
    const url = 'https://www.ricette-bimby.net/ricetta/torta';
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, url);
    const bimbyCount = result!.tags.filter(t => t === 'Bimby').length;
    expect(bimbyCount).toBe(1);
    expect(result!.tags).toContain('torta');
  });

  it('produces no extra tags when WPRM tags field is absent', () => {
    const html = `<html><body>${WPRM_SCRIPT(VALID_WPRM_RECIPE)}</body></html>`;
    const result = parseWprmRecipeFromHtml(html, TEST_URL);
    // VALID_WPRM_RECIPE has no tags field — result.tags should only have domain-inferred tags
    expect(Array.isArray(result!.tags)).toBe(true);
  });
});

// ─── HTML meta extraction ──────────────────────────────────────────────────────

describe('extractHtmlMetaFields', () => {
  it('extracts og:title with property-before-content attribute order', () => {
    const html = `<html><head>
      <meta property="og:title" content="Ricetta Speciale" />
    </head></html>`;
    expect(extractHtmlMetaFields(html).title).toBe('Ricetta Speciale');
  });

  it('extracts og:title with content-before-property attribute order', () => {
    const html = `<html><head>
      <meta content="Ricetta Alternativa" property="og:title" />
    </head></html>`;
    expect(extractHtmlMetaFields(html).title).toBe('Ricetta Alternativa');
  });

  it('falls back to <title> tag when og:title is absent', () => {
    const html = `<html><head><title>Ricetta da Title Tag</title></head></html>`;
    expect(extractHtmlMetaFields(html).title).toBe('Ricetta da Title Tag');
  });

  it('extracts og:description', () => {
    const html = `<html><head>
      <meta property="og:description" content="Una descrizione della ricetta." />
    </head></html>`;
    expect(extractHtmlMetaFields(html).description).toBe('Una descrizione della ricetta.');
  });

  it('extracts og:image', () => {
    const html = `<html><head>
      <meta property="og:image" content="https://example.com/img.jpg" />
    </head></html>`;
    expect(extractHtmlMetaFields(html).image).toBe('https://example.com/img.jpg');
  });

  it('extracts og:image from name attribute variant', () => {
    const html = `<html><head>
      <meta name="og:image" content="/images/cover.jpg" />
    </head></html>`;
    expect(extractHtmlMetaFields(html).image).toBe('/images/cover.jpg');
  });

  it('returns nulls when no meta fields are present', () => {
    const html = `<html><head></head></html>`;
    const result = extractHtmlMetaFields(html);
    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
    expect(result.image).toBeNull();
  });

  it('decodes HTML entities in meta content values', () => {
    const html = `<html><head>
      <meta property="og:title" content="Pasta &amp; Fagioli" />
    </head></html>`;
    expect(extractHtmlMetaFields(html).title).toBe('Pasta & Fagioli');
  });
});

describe('extractMainContentImageUrl', () => {
  it('extracts the first safe image inside main/article and resolves relative URLs', () => {
    const html = `<html><body>
      <article>
        <img src="/assets/recipe-cover.jpg" alt="cover" />
      </article>
    </body></html>`;
    expect(extractMainContentImageUrl(html, 'https://example.com/recipes/pasta')).toBe('https://example.com/assets/recipe-cover.jpg');
  });

  it('skips obvious non-content images like logos', () => {
    const html = `<html><body>
      <main>
        <img src="/assets/logo.png" alt="logo" />
        <img src="/assets/pasta-cover.jpg" alt="recipe" />
      </main>
    </body></html>`;
    expect(extractMainContentImageUrl(html, 'https://example.com/recipes/pasta')).toBe('https://example.com/assets/pasta-cover.jpg');
  });
});

// ─── Fallback behavior ─────────────────────────────────────────────────────────

describe('fallback behavior — structured data vs. absent data', () => {
  it('JSON-LD present and sufficient → returns a recipe (non-null)', () => {
    const html = wrapJsonLd(VALID_JSONLD_RECIPE);
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).not.toBeNull();
  });

  it('JSON-LD present but missing ingredients → returns null, does not fake success', () => {
    const incomplete = wrapJsonLd(
      JSON.stringify({
        '@type': 'Recipe',
        name: 'Ricetta Incompleta',
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Un passo.' }],
      }),
    );
    expect(parseJsonLdRecipeFromHtml(incomplete, TEST_URL)).toBeNull();
  });

  it('WPRM present and sufficient → returns a recipe (non-null)', () => {
    const html = `<html><body>${WPRM_SCRIPT(VALID_WPRM_RECIPE)}</body></html>`;
    expect(parseWprmRecipeFromHtml(html, TEST_URL)).not.toBeNull();
  });

  it('WPRM present but missing steps → returns null, does not fake success', () => {
    const recipe = { ...VALID_WPRM_RECIPE, instructions: [[]] };
    const html = `<html><body>${WPRM_SCRIPT(recipe)}</body></html>`;
    expect(parseWprmRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('no structured data at all → both parsers return null', () => {
    const html = '<html><body><p>Pagina senza dati strutturati.</p></body></html>';
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
    expect(parseWprmRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('malformed structured data (JSON-LD) → returns null, does not fake success', () => {
    const html = `<html><head>
      <script type="application/ld+json">{ completely: broken json </script>
    </head></html>`;
    expect(parseJsonLdRecipeFromHtml(html, TEST_URL)).toBeNull();
  });

  it('malformed structured data (WPRM) → returns null, does not fake success', () => {
    // Marker present but JSON is broken
    const html = `<html><body>
      <script>var wprm_public_js_data = { "recipe": {"ingredients":[[BROKEN}}</script>
    </body></html>`;
    expect(parseWprmRecipeFromHtml(html, TEST_URL)).toBeNull();
  });
});
