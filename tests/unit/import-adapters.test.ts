import { describe, it, expect } from 'vitest';
import {
  getImportAdapterForDomain,
  getImportAdapterForUrl,
  normalizeImportText,
  stripImportLinksAndImages,
  stripImportMarkdownNoise,
} from '../../src/lib/import/adapters';

describe('normalizeImportText', () => {
  it('should normalize carriage returns', () => {
    expect(normalizeImportText('hello\r\nworld')).toBe('hello\nworld');
  });

  it('should normalize non-breaking spaces', () => {
    expect(normalizeImportText('hello\u00a0world')).toBe('hello world');
  });

  it('should normalize multiple spaces', () => {
    expect(normalizeImportText('hello    world')).toBe('hello world');
  });

  it('should collapse multiple newlines to double newline', () => {
    expect(normalizeImportText('line1\n\n\n\nline2')).toBe('line1\n\nline2');
  });

  it('should trim whitespace', () => {
    expect(normalizeImportText('  hello  ')).toBe('hello');
  });

  it('should handle empty or null', () => {
    expect(normalizeImportText('')).toBe('');
    expect(normalizeImportText(null as any)).toBe('');
  });
});

describe('stripImportLinksAndImages', () => {
  it('should strip markdown image syntax', () => {
    expect(stripImportLinksAndImages('hello ![alt](url) world')).toContain('hello');
    expect(stripImportLinksAndImages('hello ![alt](url) world')).toContain('world');
  });

  it('should extract link text and discard URL', () => {
    const result = stripImportLinksAndImages('hello [link text](url) world');
    expect(result).toContain('link text');
    expect(result).not.toContain('url');
  });

  it('should handle multiple links', () => {
    const result = stripImportLinksAndImages('[text1](url1) and [text2](url2)');
    expect(result).toContain('text1');
    expect(result).toContain('text2');
  });
});

describe('stripImportMarkdownNoise', () => {
  it('should remove images and links', () => {
    const result = stripImportMarkdownNoise('hello ![alt](url) [link](url) world');
    expect(result).toContain('hello');
    expect(result).toContain('world');
    expect(result).not.toContain('](');
  });

  it('should remove noisy page numbers', () => {
    // Patterns like "1 2 3 4 5" (when length > 8)
    const withNoise = 'recipe text 1 2 3 4 5 more text';
    const result = stripImportMarkdownNoise(withNoise);
    expect(result).toContain('recipe');
    expect(result).toContain('more');
  });
});

describe('getImportAdapterForDomain', () => {
  it('should find giallozafferano adapter', () => {
    const adapter = getImportAdapterForDomain('giallozafferano.it');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('giallozafferano.it');
  });

  it('should find ricetteperbimby adapter', () => {
    const adapter = getImportAdapterForDomain('ricetteperbimby.it');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('ricetteperbimby.it');
  });

  it('should find ricette-bimby.net adapter', () => {
    const adapter = getImportAdapterForDomain('ricette-bimby.net');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('ricette-bimby.net');
  });

  it('should find vegolosi.it adapter', () => {
    const adapter = getImportAdapterForDomain('vegolosi.it');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('vegolosi.it');
  });

  it('should return null for unknown domain', () => {
    const adapter = getImportAdapterForDomain('unknown-domain.com');
    expect(adapter).toBeNull();
  });
});

describe('getImportAdapterForUrl', () => {
  it('should match giallozafferano.it from URL', () => {
    const adapter = getImportAdapterForUrl('https://www.giallozafferano.it/ricette/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('giallozafferano.it');
  });

  it('should handle giallozafferano.com via canHandle', () => {
    const adapter = getImportAdapterForUrl('https://www.giallozafferano.com/ricette/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('giallozafferano.it');
  });

  it('should match ricetteperbimby.it', () => {
    const adapter = getImportAdapterForUrl('https://ricetteperbimby.it/ricetta/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('ricetteperbimby.it');
  });

  it('should match ricette-bimby.net', () => {
    const adapter = getImportAdapterForUrl('https://ricette-bimby.net/ricetta/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('ricette-bimby.net');
  });

  it('should match vegolosi.it', () => {
    const adapter = getImportAdapterForUrl('https://www.vegolosi.it/ricette/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('vegolosi.it');
  });

  it('should return null for unknown domain', () => {
    const adapter = getImportAdapterForUrl('https://unknown-domain.com/recipe/');
    expect(adapter).toBeNull();
  });

  it('should prefer exact domain match over canHandle', () => {
    // GialloZafferano has both exact match and canHandle
    const adapter = getImportAdapterForUrl('https://www.giallozafferano.it/ricette/');
    expect(adapter?.domain).toBe('giallozafferano.it');
  });

  it('should handle URLs with protocol variations', () => {
    const adapter1 = getImportAdapterForUrl('http://giallozafferano.it/ricette/');
    const adapter2 = getImportAdapterForUrl('https://giallozafferano.it/ricette/');
    expect(adapter1).not.toBeNull();
    expect(adapter2).not.toBeNull();
  });
});

// ─── GZ ingredient parsing ────────────────────────────────────────────────────

const GZ_MARKDOWN_WITH_AGGIUNGI = `# Spaghetti alla Carbonara

*   Difficoltà: **Facile**
*   Preparazione: **15 min**
*   Cottura: **15 min**
*   Dosi per: **4 persone**

## PRESENTAZIONE

Descrizione.

## INGREDIENTI

**Attenzione.** In caso di dubbi, è consigliabile consultare uno specialista.

[Spaghetti](https://ricette.giallozafferano.it/ricette-con-gli-Spaghetti/) 320 g [Guanciale](https://ricette.giallozafferano.it/ricette-con-il-Guanciale/) 150 g [Tuorli](https://ricette.giallozafferano.it/ricette-con-Tuorli/) 6 [Pecorino Romano DOP](https://ricette.giallozafferano.it/ricette-con-Pecorino-romano/) 50 g

[AGGIUNGI ALLA LISTA DELLA SPESA](https://ricette.giallozafferano.it/Spaghetti-alla-carbonara.html#)

Preparazione

## Come preparare gli Spaghetti alla Carbonara

Cuoci la pasta. Soffriggi il guanciale.

Sbatti i tuorli con il pecorino e il pepe.

## Conservazione

Consumare subito.`;

const GZ_MARKDOWN_NO_AGGIUNGI = `# Pizzoccheri alla Valtellinese

*   Difficoltà: **Media**
*   Preparazione: **50 min**
*   Cottura: **15 min**
*   Dosi per: **4 persone**

## PRESENTAZIONE

Descrizione.

## INGREDIENTI

**Attenzione.** In caso di dubbi, è consigliabile consultare uno specialista.

Per i pizzoccheri[Farina di grano saraceno](https://ricette.giallozafferano.it/ricette-con-Farina-di-grano-saraceno/) (macinato a pietra) 400 g [Farina 0](https://ricette.giallozafferano.it/ricette-con-Farina-0/) 100 g [Acqua](https://ricette.giallozafferano.it/ricette-con-l-Acqua/) 285 g Per condire[Burro](https://ricette.giallozafferano.it/ricette-con-il-Burro/) (di malga) 80 g [Grana Padano DOP](https://ricette.giallozafferano.it/ricette-con-il-Grana-Padano/) 40 g

Preparazione

## Come preparare i Pizzoccheri

Versare le farine in una ciotola e aggiungere l'acqua calda.

Lavorare l'impasto energicamente fino a ottenere una consistenza elastica.

## Conservazione

Conservare in frigo.`;

const GZ_MARKDOWN_NO_DUBBI_SENTENCE = `# Pizzoccheri alla Valtellinese

*   Difficoltà: **Media**
*   Preparazione: **50 min**
*   Cottura: **15 min**
*   Dosi per: **4 persone**

## PRESENTAZIONE

Descrizione.

## INGREDIENTI

850,9

Calorie per porzione

*   Energia Kcal 850,9
*   Carboidrati g 105,4

Dati forniti da

[Edamam](https://www.edamam.com/)

Per i pizzoccheri[Farina di grano saraceno](https://ricette.giallozafferano.it/ricette-con-Farina-di-grano-saraceno/) (macinato a pietra) 400 g [Farina 0](https://ricette.giallozafferano.it/ricette-con-Farina-0/) 100 g [Acqua](https://ricette.giallozafferano.it/ricette-con-l-Acqua/) (alla temperatura di 50°) 285 g Per condire[Verza](https://ricette.giallozafferano.it/ricette-con-la-Verza/) 200 g [Burro](https://ricette.giallozafferano.it/ricette-con-il-Burro/) (di malga) 80 g [Grana Padano DOP](https://ricette.giallozafferano.it/ricette-con-il-Grana-Padano/) 40 g

Preparazione

## Come preparare i Pizzoccheri

Versare le farine in una ciotola e aggiungere l'acqua calda.

Lavorare l'impasto energicamente fino a ottenere una consistenza elastica.

## Conservazione

Conservare in frigo.`;

const GZ_MARKDOWN_PLAIN_ING_HEADING_AND_JINA_TITLE = `Title: Pizzoccheri

URL Source: https://ricette.giallozafferano.it/Pizzoccheri-alla-valtellinese.html

*   Difficoltà: **Media**
*   Preparazione: **50 min**
*   Cottura: **15 min**
*   Dosi per: **4 persone**

## PRESENTAZIONE

Descrizione.

INGREDIENTI

850,9

Calorie per porzione

*   Energia Kcal 850,9
*   Carboidrati g 105,4

Dati forniti da

[![Image 5: Edamam](https://ricette.giallozafferano.it/style/images/logo-edamam.png)](https://www.edamam.com/)

**Attenzione.** I valori nutrizionali sono forniti da Edamam. In caso di dubbi, consultare uno specialista.

Per i pizzoccheri[Farina di grano saraceno](https://ricette.giallozafferano.it/ricette-con-Farina-di-grano-saraceno/) (macinato a pietra) 400 g [Farina 0](https://ricette.giallozafferano.it/ricette-con-Farina-0/) 100 g [Acqua](https://ricette.giallozafferano.it/ricette-con-l-Acqua/) 285 g Per condire[Burro](https://ricette.giallozafferano.it/ricette-con-il-Burro/) 80 g

Preparazione

## Come preparare i Pizzoccheri

Versare le farine in una ciotola e aggiungere l'acqua calda.

Lavorare l'impasto energicamente fino a ottenere una consistenza elastica.
`;

const GZ_MARKDOWN_MULTI_SECTION_PREPARATION = `# Lasagne alla Bolognese

*   Difficoltà: **Media**
*   Preparazione: **90 min**
*   Cottura: **150 min**
*   Dosi per: **6 persone**

## PRESENTAZIONE

Descrizione.

## INGREDIENTI

per la sfoglia[Semola di grano duro rimacinata](https://www.giallozafferano.it/) 175 g [Farina 00](https://www.giallozafferano.it/) 75 g [Spinaci](https://www.giallozafferano.it/) 125 g per il ragù[Macinato di manzo](https://www.giallozafferano.it/) 700 g [Passata di pomodoro](https://www.giallozafferano.it/) 350 g per la besciamella[Latte intero](https://www.giallozafferano.it/) 800 g [Burro](https://www.giallozafferano.it/) 50 g per la superficie[Parmigiano Reggiano DOP](https://www.giallozafferano.it/) 150 g

[AGGIUNGI ALLA LISTA DELLA SPESA](https://www.giallozafferano.it/)

## Ragù

Preparate il soffritto e rosolate la carne.

Unite passata e brodo, poi fate sobbollire a lungo.

## Pasta fresca

Impastate farina, semola, spinaci e uova.

Stendete la sfoglia e ricavate i rettangoli.

## Besciamella

Sciogliete il burro, unite la farina e poi il latte.

Mescolate fino a ottenere una salsa liscia.

## Composizione

Alternate strati di pasta, ragù, besciamella e parmigiano.

Infornate fino a doratura.

## Conservazione

Conservare in frigo.
`;

const GZ_MARKDOWN_PAGE_NOT_FOUND = `Title: Pagina non trovata - Le ricette di GialloZafferano

URL Source: https://ricette.giallozafferano.it/Fiori-di-zucca-fritti.html

Warning: Target URL returned error 404: Not Found

Markdown Content:
# Pagina non trovata - Le ricette di GialloZafferano

## ops... c'è stato un errore

La pagina richiesta non è disponibile.
`;

describe('GialloZafferano adapter — ingredient parsing', () => {
  const adapter = getImportAdapterForDomain('giallozafferano.it')!;
  const url = 'https://ricette.giallozafferano.it/test.html';

  it('standard format (with AGGIUNGI button) extracts ingredients', () => {
    const result = adapter.parse(GZ_MARKDOWN_WITH_AGGIUNGI, url);
    expect(result.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(result.ingredients.some(i => i.includes('Spaghetti'))).toBe(true);
    expect(result.ingredients.some(i => i.includes('Guanciale'))).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('no-AGGIUNGI format (Pizzoccheri-style) extracts ingredients without throwing', () => {
    const result = adapter.parse(GZ_MARKDOWN_NO_AGGIUNGI, url);
    expect(result.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(result.ingredients.some(i => i.includes('Farina di grano saraceno'))).toBe(true);
    expect(result.ingredients.some(i => i.includes('Burro'))).toBe(true);
    expect(result.ingredients.some(i => i.includes('Grana Padano DOP'))).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('no-AGGIUNGI format preserves name and metadata', () => {
    const result = adapter.parse(GZ_MARKDOWN_NO_AGGIUNGI, url);
    expect(result.name).toBe('Pizzoccheri alla Valtellinese');
    expect(result.time).toContain('50 min');
    expect(result.servings).toBe('4');
  });

  it('extracts ingredients when INGREDIENTI exists but "In caso di dubbi" sentence is absent', () => {
    const result = adapter.parse(GZ_MARKDOWN_NO_DUBBI_SENTENCE, url);
    expect(result.ingredients.length).toBeGreaterThanOrEqual(4);
    expect(result.ingredients.some(i => i.includes('Farina di grano saraceno'))).toBe(true);
    expect(result.ingredients.some(i => i.includes('Verza'))).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('supports Jina-style plain "INGREDIENTI" heading and "Title:" fallback without treating nutrition text as ingredient', () => {
    const result = adapter.parse(GZ_MARKDOWN_PLAIN_ING_HEADING_AND_JINA_TITLE, url);
    expect(result.name).toBe('Pizzoccheri');
    expect(result.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(result.ingredients.some(i => i.includes('Farina di grano saraceno'))).toBe(true);
    expect(result.ingredients.some(i => i.includes('Burro'))).toBe(true);
    expect(result.ingredients.some(i => /Attenzione|Edamam/i.test(i))).toBe(false);
  });

  it('supports multi-section preparation pages without a "Come preparare" heading', () => {
    const result = adapter.parse(GZ_MARKDOWN_MULTI_SECTION_PREPARATION, url);
    expect(result.name).toBe('Lasagne alla Bolognese');
    expect(result.ingredients.length).toBeGreaterThanOrEqual(5);
    expect(result.ingredients.some(i => i.includes('Macinato di manzo'))).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(6);
    expect(result.steps.some(step => step.includes('Preparate il soffritto'))).toBe(true);
    expect(result.steps.some(step => step.includes('Alternate strati di pasta'))).toBe(true);
  });

  it('classifies obvious GialloZafferano 404 pages as page-not-found instead of ingredient parser failures', () => {
    expect(() => adapter.parse(GZ_MARKDOWN_PAGE_NOT_FOUND, url)).toThrowError('GZ_PAGE_NOT_FOUND');
  });
});
