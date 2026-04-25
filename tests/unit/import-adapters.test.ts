import { describe, it, expect } from 'vitest';
import {
  getImportAdapterForDomain,
  getImportAdapterForUrl,
  importWebsiteRecipeWithAdapters,
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

const GZ_MARKDOWN_WITH_TEMPERATURE_AND_INLINE_IMAGE_REFS = `# Empanadas argentine

*   Difficoltà: **Media**
*   Preparazione: **60 min**
*   Cottura: **60 min**
*   Dosi per: **18 pezzi**

## PRESENTAZIONE

Descrizione.

## INGREDIENTI

[Farina 00](https://ricette.giallozafferano.it/) 210 g [Acqua](https://ricette.giallozafferano.it/) 70 g

[AGGIUNGI ALLA LISTA DELLA SPESA](https://ricette.giallozafferano.it/Empanadas-argentine.html#)

Preparazione

## Come preparare le Empanadas argentine

Dopo aver formato le empanadas riscaldate abbondante olio di semi in un pentolino fino alla temperatura di 160°. Friggete 1 o 2 pezzi per volta per 4-5 minuti 25. Quando saranno dorate, scolate le empanadas 26 e adagiatele su carta assorbente per eliminare l’olio in eccesso. Le vostre empanadas argentine sono pronte per essere gustate 27!

## Conservazione

Consumare subito.
`;

const RBN_MARKDOWN_WITH_STANDALONE_PARENTHESES_NOTE = `# Pancake allo yogurt Bimby

Tempo totale

15 min

Porzioni

4

### Ingredienti

* 190 gr farina 00
* 150 gr yogurt greco
* 2 uova

### Preparazione

1. 1

Mettere nel boccale le uova, lo yogurt, l'olio, il latte e la vaniglia, emulsionare: 30 sec. vel. 4.

2. 2

Unire la farina, lo zucchero, il lievito, il bicarbonato e il sale, amalgamare: 20 sec. vel. 3.

3. 3

Riscaldare una piastra o una padella, spennellare il fondo con del burro, versare un mestolino di composto e lasciare cuocere 2 minuti per lato coperti con un coperchio.

4. 4 (Il passaggio del coperchio aiuterà al composto a gonfiarsi).

5. 5

I pancake allo yogurt bimby sono pronti per essere serviti.

### Note

Fine.`;

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

  it('preserves temperatures and quantity ranges while removing inline image-reference numbers from steps', () => {
    const result = adapter.parse(GZ_MARKDOWN_WITH_TEMPERATURE_AND_INLINE_IMAGE_REFS, url);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[ 0 ]).toContain('temperatura di 160°');
    expect(result.steps[ 0 ]).toContain('Friggete 1 o 2 pezzi per volta per 4-5 minuti.');
    expect(result.steps[ 0 ]).not.toMatch(/\b25\b|\b26\b|\b27\b/);
  });
});

// ─── Vegolosi fixtures ────────────────────────────────────────────────────────

// Fixture 1: old h3 format — bullet ingredients, h3 section headings, Conservazione boundary
const VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE = `# Pasta al Pesto - Ricetta vegan - Vegolosi.it

**Dosi per:** 4 persone

### Ingredienti

* 320 g pasta
* 2 mazzetti basilico fresco
* 30 g pinoli
* 1 spicchio aglio
* 3 cucchiai olio EVO

### Si cucina

Frullare il basilico con pinoli, aglio e olio fino a ottenere una crema liscia.

Cuocere la pasta in abbondante acqua salata.

Scolare al dente e condire con il pesto.

### Conservazione

Conservare in frigo per 2 giorni.`;

// Fixture 2: new bold-text format — plain-text ingredients, **Preparazione** marker, **Step N** delimiters
const VEGOLOSI_NEW_BOLD_FORMAT = `# Cheesecake ai Frutti di Bosco Vegana

**Ingredienti per 8 persone:**

200 g biscotti secchi vegani
80 g burro di cocco
400 g tofu vellutato
100 ml sciroppo d'acero
200 g frutti di bosco misti

**Preparazione**

**Step 1**

Tritare i biscotti nel mixer e mescolare con il burro di cocco fuso.

**Step 2**

Frullare il tofu con lo sciroppo d'acero fino a ottenere una crema liscia.

**Step 3**

Distribuire la crema sulla base e decorare con i frutti di bosco.`;

// Fixture 3: old h3 format without Conservazione — steps end at noise marker
const VEGOLOSI_OLD_H3_NOISE_BOUNDARY = `# Zuppa di Lenticchie Rosse

**Dosi per:** 4 persone

### Ingredienti

* 300 g lenticchie rosse
* 1 cipolla
* 2 carote
* 1 litro brodo vegetale
* sale e pepe q.b.

### Preparazione

Scaldare l'olio in una pentola e soffriggere la cipolla tritata.

Aggiungere le carote a rondelle e le lenticchie sciacquate.

Coprire con il brodo e cuocere per 25 minuti a fuoco medio.

Iscriviti alla newsletter per ricevere nuove ricette ogni settimana.

Questo contenuto promozionale non deve apparire nei passi.`;

// Fixture 4: title containing both suffix patterns to strip
const VEGOLOSI_TITLE_CLEANUP = `# Hummus di Ceci - Ricette vegane - Vegolosi.it

### Ingredienti

* 400 g ceci cotti
* 2 cucchiai tahini
* succo di 1 limone
* 1 spicchio aglio
* sale q.b.

### Si cucina

Frullare i ceci scolati con tahini, succo di limone e aglio.

Aggiustare di sale e aggiungere un filo di olio EVO.

Servire con paprika affumicata e pane pita.`;

describe('Vegolosi adapter — old h3 format with Conservazione', () => {
  const adapter = getImportAdapterForDomain('vegolosi.it')!;
  const url = 'https://vegolosi.it/ricette-vegane/pasta-al-pesto/';

  it('extracts ingredients from bullet list', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE, url);
    expect(result.ingredients.length).toBeGreaterThanOrEqual(4);
    expect(result.ingredients.some(i => i.includes('basilico'))).toBe(true);
    expect(result.ingredients.some(i => i.includes('pinoli'))).toBe(true);
  });

  it('extracts steps and stops at Conservazione boundary', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    // Conservazione content must not bleed into steps
    expect(result.steps.some(s => s.toLowerCase().includes('frigo'))).toBe(false);
    expect(result.steps.some(s => s.includes('Frullare il basilico'))).toBe(true);
  });

  it('strips site suffix from title', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE, url);
    expect(result.name).toBe('Pasta al Pesto');
  });

  it('reads servings from **Dosi per:** pattern', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE, url);
    expect(result.servings).toBe('4');
  });

  it('sets source = web and sourceDomain = vegolosi.it', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE, url);
    expect(result.source).toBe('web');
    expect(result.sourceDomain).toBe('vegolosi.it');
  });
});

describe('Vegolosi adapter — new bold-text format with Step N markers', () => {
  const adapter = getImportAdapterForDomain('vegolosi.it')!;
  const url = 'https://vegolosi.it/ricette-vegane/cheesecake-frutti-bosco/';

  it('extracts ingredients from plain-text lines when no bullets are present', () => {
    const result = adapter.parse(VEGOLOSI_NEW_BOLD_FORMAT, url);
    expect(result.ingredients.length).toBeGreaterThanOrEqual(4);
    expect(result.ingredients.some(i => i.includes('biscotti'))).toBe(true);
    expect(result.ingredients.some(i => i.includes('tofu'))).toBe(true);
  });

  it('splits steps at **Step N** markers, not accumulating them into one block', () => {
    const result = adapter.parse(VEGOLOSI_NEW_BOLD_FORMAT, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.steps.some(s => s.includes('biscotti'))).toBe(true);
    expect(result.steps.some(s => s.includes('tofu'))).toBe(true);
  });

  it('reads servings from **Ingredienti per N persone:** pattern', () => {
    const result = adapter.parse(VEGOLOSI_NEW_BOLD_FORMAT, url);
    expect(result.servings).toBe('8');
  });
});

describe('Vegolosi adapter — noise marker as steps boundary', () => {
  const adapter = getImportAdapterForDomain('vegolosi.it')!;
  const url = 'https://vegolosi.it/ricette-vegane/zuppa-lenticchie/';

  it('stops extracting steps at "Iscriviti alla newsletter" noise marker', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_NOISE_BOUNDARY, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.steps.some(s => s.includes('newsletter'))).toBe(false);
    expect(result.steps.some(s => s.includes('promozionale'))).toBe(false);
  });

  it('extracts the real steps before the noise marker', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_NOISE_BOUNDARY, url);
    expect(result.steps.some(s => s.includes('cipolla'))).toBe(true);
    expect(result.steps.some(s => s.includes('lenticchie'))).toBe(true);
  });
});

describe('Vegolosi adapter — title cleanup', () => {
  const adapter = getImportAdapterForDomain('vegolosi.it')!;
  const url = 'https://vegolosi.it/ricette-vegane/hummus-di-ceci/';

  it('strips "- Ricette vegane - Vegolosi.it" suffix from title', () => {
    const result = adapter.parse(VEGOLOSI_TITLE_CLEANUP, url);
    expect(result.name).toBe('Hummus di Ceci');
  });

  it('throws VEGOLOSI_PARSE_INCOMPLETE when ingredient section is missing', () => {
    const noIngredients = `# Una Ricetta\n\n### Preparazione\n\nPasso uno.\n\nPasso due.`;
    expect(() => adapter.parse(noIngredients, url)).toThrow('VEGOLOSI_PARSE_INCOMPLETE');
  });
});

// ─── Vegolosi servings edge-case fixtures ────────────────────────────────────

// No "persone" word after number — regex won't match, defaults to '4'
const VEGOLOSI_DOSI_NO_PERSONE = `# Torta di Mele Vegana

**Dosi per:** 4

### Ingredienti

* 300 g farina integrale
* 3 mele
* 100 ml olio di semi
* 150 g zucchero di canna

### Si cucina

Sbucciare le mele e tagliarle a fettine sottili.

Mescolare farina, zucchero e olio in una ciotola.

Incorporare le mele e versare in uno stampo oleato.

Infornare a 180° per 35 minuti.`;

// "Ingredienti per N:" — colon before closing ** (regression: the colon-leak bug)
const VEGOLOSI_INGREDIENTI_COLON_NO_PERSONE = `# Risotto ai Funghi

**Ingredienti per 2:**

200 g riso Carnaroli
300 g funghi champignon
1 scalogno
750 ml brodo vegetale
2 cucchiai olio EVO

**Preparazione**

**Step 1**

Soffriggere lo scalogno in olio.

**Step 2**

Aggiungere i funghi e tostarli per 5 minuti.

**Step 3**

Tostare il riso, sfumare e aggiungere brodo a mestoli.`;

// "Ingredienti per N persone:" — colon + persone (regression: combined form)
const VEGOLOSI_INGREDIENTI_COLON_WITH_PERSONE = `# Gazpacho

**Ingredienti per 6 persone:**

1 kg pomodori maturi
1 cetriolo
1 peperone rosso
2 spicchi aglio
3 cucchiai olio EVO
sale e aceto q.b.

**Preparazione**

**Step 1**

Tagliare a pezzi tutte le verdure e frullarle insieme all'olio.

**Step 2**

Aggiustare di sale e aceto, refrigerare almeno 2 ore prima di servire.`;

describe('Vegolosi adapter — servings edge cases', () => {
  const adapter = getImportAdapterForDomain('vegolosi.it')!;
  const url = 'https://vegolosi.it/ricette-vegane/test/';

  it('falls back to default servings when **Dosi per:** has no persone word', () => {
    const result = adapter.parse(VEGOLOSI_DOSI_NO_PERSONE, url);
    // Regex won't capture "4" without "persone", so fallback default applies
    expect(result.servings).toBe('4');
  });

  it('regression — **Ingredienti per N:** without persone does not leak colon into servings', () => {
    // Bug was: [^*\n]+? captured "2:" → normalizeImportedServings produced "2 :"
    const result = adapter.parse(VEGOLOSI_INGREDIENTI_COLON_NO_PERSONE, url);
    expect(result.servings).toBe('2');
    expect(result.servings).not.toContain(':');
  });

  it('regression — **Ingredienti per N persone:** with colon does not leak colon into servings', () => {
    // Same colon-leak bug: "6 persone:" was being captured before the fix
    const result = adapter.parse(VEGOLOSI_INGREDIENTI_COLON_WITH_PERSONE, url);
    expect(result.servings).toBe('6');
    expect(result.servings).not.toContain(':');
  });

  it('regression — title with singular "Ricetta vegan" suffix is stripped correctly', () => {
    // Bug was: Ricetta(?:e)? could not match "Ricette"; fixed to Ricett[ae]
    // Fixture 1 (VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE) covers the singular form end-to-end.
    // This inline fixture confirms the plural form too.
    const md = `# Torta al Cioccolato - Ricette vegane - Vegolosi.it\n\n### Ingredienti\n\n* 200 g farina\n* 100 g cacao\n\n### Si cucina\n\nMescolare e infornare.`;
    const result = adapter.parse(md, url);
    expect(result.name).toBe('Torta al Cioccolato');
    expect(result.name).not.toContain('Ricette');
    expect(result.name).not.toContain('Vegolosi');
  });
});

// ─── GialloZafferano editorial notes fixtures ────────────────────────────────

// Page with both Consiglio and Ascolta la ricetta (the latter must be excluded)
const GZ_MARKDOWN_WITH_CONSIGLIO_AND_ASCOLTA = `# Risotto ai Funghi

*   Difficoltà: **Facile**
*   Preparazione: **10 min**
*   Cottura: **25 min**
*   Dosi per: **4 persone**

## PRESENTAZIONE

Descrizione.

## INGREDIENTI

[Riso Carnaroli](https://ricette.giallozafferano.it/) 320 g [Funghi porcini](https://ricette.giallozafferano.it/) 300 g [Scalogno](https://ricette.giallozafferano.it/) 1

[AGGIUNGI ALLA LISTA DELLA SPESA](https://ricette.giallozafferano.it/Risotto-ai-funghi.html#)

Preparazione

## Come preparare il Risotto ai Funghi

Soffriggere lo scalogno con l'olio.

Tostare il riso e sfumare con il vino bianco.

Cuocere a fuoco lento aggiungendo il brodo.

## Consiglio

Usare funghi porcini secchi per un sapore più intenso. Reidratarli in acqua tiepida per 20 minuti.

## Ascolta la ricetta

[Podcast link](https://ricette.giallozafferano.it/podcast/risotto-funghi)`;

// Page with Conservazione only (same as GZ_MARKDOWN_WITH_AGGIUNGI — no dedicated fixture needed)

describe('GialloZafferano adapter — editorial notes extraction', () => {
  const adapter = getImportAdapterForDomain('giallozafferano.it')!;
  const url = 'https://ricette.giallozafferano.it/test.html';

  it('extracts Conservazione into notes (from GZ_MARKDOWN_WITH_AGGIUNGI)', () => {
    const result = adapter.parse(GZ_MARKDOWN_WITH_AGGIUNGI, url);
    expect(result.notes).toContain('Conservazione:');
    expect(result.notes).toContain('Consumare subito');
  });

  it('extracts Consiglio into notes', () => {
    const result = adapter.parse(GZ_MARKDOWN_WITH_CONSIGLIO_AND_ASCOLTA, url);
    expect(result.notes).toContain('Consiglio:');
    expect(result.notes).toContain('funghi porcini');
  });

  it('excludes Ascolta la ricetta from notes', () => {
    const result = adapter.parse(GZ_MARKDOWN_WITH_CONSIGLIO_AND_ASCOLTA, url);
    expect(result.notes ?? '').not.toContain('Ascolta');
    expect(result.notes ?? '').not.toContain('Podcast');
  });

  it('notes absent when no editorial sections (GZ_MARKDOWN_PLAIN_ING_HEADING_AND_JINA_TITLE)', () => {
    const result = adapter.parse(GZ_MARKDOWN_PLAIN_ING_HEADING_AND_JINA_TITLE, url);
    expect(result.notes ?? '').toBe('');
  });

  it('steps not polluted with Conservazione content', () => {
    const result = adapter.parse(GZ_MARKDOWN_WITH_AGGIUNGI, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.steps.every(s => !s.includes('Consumare'))).toBe(true);
  });

  it('steps not polluted with Consiglio content', () => {
    const result = adapter.parse(GZ_MARKDOWN_WITH_CONSIGLIO_AND_ASCOLTA, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.steps.every(s => !s.includes('Reidratarli'))).toBe(true);
  });

  it('ingredients unaffected', () => {
    const result = adapter.parse(GZ_MARKDOWN_WITH_AGGIUNGI, url);
    expect(result.ingredients.some(i => i.includes('Spaghetti'))).toBe(true);
  });
});

describe('Vegolosi adapter — Conservazione extracted into notes', () => {
  const adapter = getImportAdapterForDomain('vegolosi.it')!;
  const url = 'https://vegolosi.it/ricette-vegane/pasta-al-pesto/';
  const url2 = 'https://vegolosi.it/ricette-vegane/cheesecake-frutti-bosco/';

  it('extracts ### Conservazione content into notes', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE, url);
    expect(result.notes).toContain('Conservazione:');
    expect(result.notes).toContain('frigo');
  });

  it('notes absent when no Conservazione section (new bold format)', () => {
    const result = adapter.parse(VEGOLOSI_NEW_BOLD_FORMAT, url2);
    expect(result.notes ?? '').toBe('');
  });

  it('notes absent when no Conservazione section (noise-boundary fixture)', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_NOISE_BOUNDARY, 'https://vegolosi.it/ricette-vegane/zuppa-lenticchie/');
    expect(result.notes ?? '').toBe('');
  });

  it('steps not polluted with Conservazione content', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE, url);
    expect(result.steps.every(s => !s.toLowerCase().includes('2 giorni'))).toBe(true);
  });

  it('ingredients unaffected', () => {
    const result = adapter.parse(VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE, url);
    expect(result.ingredients.some(i => i.includes('basilico'))).toBe(true);
  });
});

describe('Ricette-Bimby.net adapter — Note section extracted into notes', () => {
  const adapterRbn = getImportAdapterForDomain('ricette-bimby.net')!;
  const rbnUrl = 'https://ricette-bimby.net/pancake-allo-yogurt-bimby/';
  const rbnUrl2 = 'https://ricette-bimby.net/risotto-funghi/';

  it('extracts ### Note content into notes', () => {
    const result = adapterRbn.parse(RBN_MARKDOWN_WITH_STANDALONE_PARENTHESES_NOTE, rbnUrl);
    expect(result.notes).toBe('Note: Fine.');
  });

  it('notes absent when no ### Note section', () => {
    const result = adapterRbn.parse(RBN_MARKDOWN_TITLE_HYPHEN, rbnUrl2);
    expect(result.notes ?? '').toBe('');
  });

  it('steps not polluted with Note content', () => {
    const result = adapterRbn.parse(RBN_MARKDOWN_WITH_STANDALONE_PARENTHESES_NOTE, rbnUrl);
    expect(result.steps.every(s => !s.includes('Fine.'))).toBe(true);
  });

  it('ingredients unaffected', () => {
    const result = adapterRbn.parse(RBN_MARKDOWN_WITH_STANDALONE_PARENTHESES_NOTE, rbnUrl);
    expect(result.ingredients.some(i => i.includes('farina'))).toBe(true);
  });
});

// ─── RicettePerBimby adapter fixtures ────────────────────────────────────────

const RPB_MARKDOWN_COME_FARE = `# Budino al Cioccolato Bimby

Difficoltà

Facile

Tempo totale

20 min

Quantità

4 persone

## Ingredienti

* 500 ml latte intero
* 50 g cacao amaro
* 100 g zucchero
* 30 g amido di mais

## Come fare il budino al cioccolato bimby

1. Inserire nel boccale latte, cacao, zucchero e amido: 8 min. 90°C vel. 4.
2. Versare negli stampini e lasciare raffreddare in frigo per almeno 2 ore.`;

const RPB_MARKDOWN_COME_CUCINARE = `# Zuppa di Verdure Bimby

Difficoltà

Facile

Tempo totale

30 min

Quantità

6 persone

## Ingredienti

* 2 zucchine
* 2 carote
* 1 patata
* 1 cipolla
* 1 litro brodo vegetale

## Come cucinare la zuppa di verdure con il bimby

1. Inserire la cipolla nel boccale e tritare: 5 sec. vel. 5.
2. Aggiungere le verdure a tocchetti e il brodo: 25 min. 100°C vel. 1.
3. Frullare a piacere: 20 sec. vel. 5.`;

describe('RicettePerBimby adapter — "Come fare" heading variant', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/budino-cioccolato/';

  it('parses steps from "## Come fare …" section heading', () => {
    const result = adapter.parse(RPB_MARKDOWN_COME_FARE, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.steps.some(s => s.includes('boccale'))).toBe(true);
  });

  it('extracts ingredients and metadata from "## Come fare" page', () => {
    const result = adapter.parse(RPB_MARKDOWN_COME_FARE, url);
    expect(result.name).toBe('Budino al Cioccolato Bimby');
    expect(result.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(result.servings).toBe('4');
    expect(result.preparationType).toBe('bimby');
  });
});

describe('RicettePerBimby adapter — "Come cucinare" heading variant', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/zuppa-verdure/';

  it('parses steps from "## Come cucinare …" section heading', () => {
    const result = adapter.parse(RPB_MARKDOWN_COME_CUCINARE, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.steps.some(s => s.includes('verdure'))).toBe(true);
  });

  it('extracts 6 servings from "Come cucinare" page', () => {
    const result = adapter.parse(RPB_MARKDOWN_COME_CUCINARE, url);
    expect(result.servings).toBe('6');
  });
});

// ─── RicettePerBimby adapter — hardening fixtures ────────────────────────────

// 1. No H1, but Title: metadata present
const RPB_NO_H1_TITLE_META = `Title: Torta al Cioccolato Bimby - Ricette Bimby

URL Source: https://www.ricetteperbimby.it/ricette/torta-al-cioccolato-bimby

Difficoltà

Facile

Tempo totale

45 min

Quantità

8 persone

## Ingredienti

* 200 g farina 00
* 150 g burro
* 200 g cioccolato fondente
* 4 uova
* 150 g zucchero

## Come fare la torta al cioccolato con il Bimby

1. Sciogliere cioccolato e burro nel boccale: 5 min. 60°C vel. 2.
2. Aggiungere uova, zucchero e farina, mescolare: 30 sec. vel. 4.
3. Versare in uno stampo e cuocere a 180° per 35 minuti.`;

// 2. Intermediate prose and ## sub-section between Ingredienti and Come fare
const RPB_PROSE_BETWEEN_SECTIONS = `# Pasta Risottata Pesto Gamberi Bimby

Difficoltà

Media

Tempo totale

30 min

Quantità

4 persone

## Ingredienti

* 320 g pasta
* 200 g gamberi
* 1 spicchio aglio
* 2 cucchiai olio EVO
* 500 ml brodo di pesce

## Nota sugli ingredienti

Usare gamberi freschi per un risultato migliore. Per i vegani sostituire il brodo.

## Come fare la pasta risottata con gamberi con il Bimby

1. Tritare l'aglio nel boccale: 3 sec. vel. 7.
2. Aggiungere olio e soffriggere: 3 min. 120°C vel. 1.
3. Unire pasta e brodo: 12 min. 100°C vel. 1, antiorario.`;

// 3. Multi-subsection steps with plain-text sub-headers
const RPB_MULTI_SUBSECTION_STEPS = `# Samosa Bimby

Difficoltà

Media

Tempo totale

60 min

Quantità

6 porzioni

## Ingredienti

* 200 g farina 00
* 100 ml acqua tiepida
* 2 patate
* 100 g piselli
* 2 cucchiaini curry

## Come fare i samosa con il Bimby

Per la pasta

1. Mescolare farina e acqua nel boccale: 1 min. vel. spiga.
2. Far riposare l'impasto avvolto nella pellicola.

Per il ripieno

3. Cuocere patate e piselli nel Varoma: 20 min. vel. 1, Varoma.
4. Condire con curry e sale.

Assemblare

5. Stendere la pasta, farcire e friggere le samose.`;

// 4a. ## Procedimento as steps heading
const RPB_PROCEDIMENTO_HEADING = `# Crema Pasticcera Bimby

Difficoltà

Facile

Tempo totale

15 min

Quantità

4 persone

## Ingredienti

* 500 ml latte intero
* 4 tuorli
* 150 g zucchero
* 50 g amido di mais

## Procedimento

1. Mettere tutti gli ingredienti nel boccale: 8 min. 90°C vel. 4.
2. Versare in una ciotola e coprire con pellicola a contatto.`;

// 4b. ## Preparazione as steps heading
const RPB_PREPARAZIONE_HEADING = `# Tiramisù Bimby

Difficoltà

Media

Tempo totale

30 min

Quantità

6 persone

## Ingredienti

* 500 g mascarpone
* 4 uova
* 100 g zucchero
* savoiardi q.b.
* caffè q.b.

## Preparazione

1. Montare i tuorli con lo zucchero nel boccale: 5 min. vel. 4.
2. Aggiungere il mascarpone e amalgamare: 30 sec. vel. 3.
3. Comporre a strati con i savoiardi imbevuti nel caffè.`;

// 5. Truncated — no Ingredienti or Come fare sections
const RPB_TRUNCATED_NO_SECTIONS = `Title: Cappuccino Cremoso Bimby - Ricette Bimby

URL Source: https://www.ricetteperbimby.it/ricette/cappuccino-cremoso-bimby

Preparate una crema spumosa con il Bimby.

Scopri la ricetta completa nel nostro libro.`;

// 6–10. Notes extraction: Consigli, Come conservare, Conservazione + promo stop
const RPB_WITH_NOTES = `# Pizza Bimby

Difficoltà

Facile

Tempo totale

90 min

Quantità

4 persone

## Ingredienti

* 500 g farina 00
* 250 ml acqua tiepida
* 25 g lievito di birra
* 10 g sale

## Come fare la pizza con il Bimby

1. Sciogliere il lievito nell'acqua tiepida.
2. Aggiungere nel boccale farina, acqua con lievito e sale: 2 min. vel. spiga.
3. Far lievitare l'impasto per 1 ora.

## Consigli

Usare farina manitoba per un impasto più elastico. Stendere sottile.

## Come conservare

Conservare la pizza avanzata in frigorifero per 2 giorni avvolta nella pellicola.

### Ti potrebbe interessare anche

[promo link 1]

### Accessori

[accessory promo]`;

const RPB_WITH_CONSERVAZIONE = `# Pasta Frolla Bimby

Difficoltà

Facile

Tempo totale

20 min

Quantità

1 dose

## Ingredienti

* 300 g farina 00
* 150 g burro freddo
* 100 g zucchero
* 2 tuorli

## Come fare la pasta frolla con il Bimby

1. Inserire tutti gli ingredienti nel boccale: 20 sec. vel. 6.
2. Compattare l'impasto e far riposare in frigo per 30 minuti.

## Conservazione

Conservare in frigo avvolta nella pellicola per 3 giorni o in freezer per 1 mese.`;

describe('RicettePerBimby adapter — title fallback to Title: metadata', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/torta-al-cioccolato-bimby';

  it('extracts title from Title: metadata when H1 is absent', () => {
    const result = adapter.parse(RPB_NO_H1_TITLE_META, url);
    expect(result.name).toBe('Torta al Cioccolato Bimby');
  });

  it('strips "- Ricette Bimby" suffix from metadata title', () => {
    const result = adapter.parse(RPB_NO_H1_TITLE_META, url);
    expect(result.name).not.toContain('Ricette Bimby');
  });

  it('extracts ingredients and steps correctly despite absent H1', () => {
    const result = adapter.parse(RPB_NO_H1_TITLE_META, url);
    expect(result.ingredients.length).toBeGreaterThanOrEqual(4);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
  });
});

describe('RicettePerBimby adapter — intermediate prose between sections is ignored', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/pasta-risottata-pesto-gamberetti-bimby';

  it('does not include intermediate ## sub-heading as an ingredient', () => {
    const result = adapter.parse(RPB_PROSE_BETWEEN_SECTIONS, url);
    expect(result.ingredients.every(i => !i.startsWith('#'))).toBe(true);
    expect(result.ingredients.some(i => /nota|usare|vegani/i.test(i))).toBe(false);
  });

  it('extracts only bullet ingredients, not prose lines', () => {
    const result = adapter.parse(RPB_PROSE_BETWEEN_SECTIONS, url);
    expect(result.ingredients.length).toBeGreaterThanOrEqual(4);
    expect(result.ingredients.some(i => i.includes('pasta'))).toBe(true);
    expect(result.ingredients.some(i => i.includes('gamberi'))).toBe(true);
  });

  it('parses steps correctly despite the extra ## section', () => {
    const result = adapter.parse(RPB_PROSE_BETWEEN_SECTIONS, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.steps.some(s => s.includes('aglio'))).toBe(true);
  });
});

describe('RicettePerBimby adapter — multi-subsection numbered steps', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/samosa-bimby';

  it('collects all numbered steps across subsection prose headers', () => {
    const result = adapter.parse(RPB_MULTI_SUBSECTION_STEPS, url);
    expect(result.steps.length).toBe(5);
  });

  it('step 1 is about mixing dough (Per la pasta)', () => {
    const result = adapter.parse(RPB_MULTI_SUBSECTION_STEPS, url);
    expect(result.steps.some(s => /farina|acqua/i.test(s))).toBe(true);
  });

  it('step 3 is about cooking filling (Per il ripieno)', () => {
    const result = adapter.parse(RPB_MULTI_SUBSECTION_STEPS, url);
    expect(result.steps.some(s => /patate|piselli/i.test(s))).toBe(true);
  });

  it('does not include prose sub-headers (Per la pasta, Assemblare) as steps', () => {
    const result = adapter.parse(RPB_MULTI_SUBSECTION_STEPS, url);
    expect(result.steps.every(s => !/^Per la|^Per il|^Assembl/i.test(s))).toBe(true);
  });
});

describe('RicettePerBimby adapter — ## Procedimento heading', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/crema-pasticcera-veloce-bimby';

  it('parses steps when heading is ## Procedimento', () => {
    const result = adapter.parse(RPB_PROCEDIMENTO_HEADING, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.steps.some(s => s.includes('boccale'))).toBe(true);
  });

  it('extracts ingredients correctly with Procedimento heading', () => {
    const result = adapter.parse(RPB_PROCEDIMENTO_HEADING, url);
    expect(result.ingredients.length).toBeGreaterThanOrEqual(4);
    expect(result.ingredients.some(i => i.includes('latte'))).toBe(true);
  });
});

describe('RicettePerBimby adapter — ## Preparazione heading', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/tiramisu-classico-al-mascarpone-bimby';

  it('parses steps when heading is ## Preparazione', () => {
    const result = adapter.parse(RPB_PREPARAZIONE_HEADING, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.steps.some(s => s.includes('mascarpone'))).toBe(true);
  });

  it('Preparazione metadata time is not confused with steps heading', () => {
    const result = adapter.parse(RPB_PREPARAZIONE_HEADING, url);
    // Steps must be actual instructions, not the prep-time value
    expect(result.steps.every(s => !/^\d+\s*min/.test(s))).toBe(true);
  });
});

describe('RicettePerBimby adapter — truncated page fails cleanly', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/cappuccino-cremoso-bimby';

  it('throws RPB_SECTIONS_NOT_FOUND when neither Ingredienti nor steps heading exists', () => {
    expect(() => adapter.parse(RPB_TRUNCATED_NO_SECTIONS, url)).toThrowError('RPB_SECTIONS_NOT_FOUND');
  });

  it('error message includes diagnostic headings info', () => {
    let errorMsg = '';
    try { adapter.parse(RPB_TRUNCATED_NO_SECTIONS, url); } catch (e) { errorMsg = String(e); }
    expect(errorMsg).toContain('ingredientsFound=false');
    expect(errorMsg).toContain('stepsFound=false');
  });
});

describe('RicettePerBimby adapter — ## Consigli extracted into notes', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/pizza-bimby';

  it('notes contains the Consigli section', () => {
    const result = adapter.parse(RPB_WITH_NOTES, url);
    expect(result.notes).toContain('Consigli:');
    expect(result.notes).toContain('farina manitoba');
  });

  it('notes contains the Come conservare section', () => {
    const result = adapter.parse(RPB_WITH_NOTES, url);
    expect(result.notes).toContain('Come conservare:');
    expect(result.notes).toContain('frigorifero');
  });

  it('notes content is not included in steps', () => {
    const result = adapter.parse(RPB_WITH_NOTES, url);
    expect(result.steps.every(s => !s.includes('farina manitoba'))).toBe(true);
    expect(result.steps.every(s => !s.includes('frigorifero'))).toBe(true);
  });

  it('promo sections (Ti potrebbe interessare, Accessori) are excluded from notes', () => {
    const result = adapter.parse(RPB_WITH_NOTES, url);
    expect(result.notes ?? '').not.toMatch(/promo|Accessori|Ti potrebbe/i);
  });

  it('cooking steps are preserved correctly', () => {
    const result = adapter.parse(RPB_WITH_NOTES, url);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.steps.some(s => s.includes('lievito'))).toBe(true);
  });
});

describe('RicettePerBimby adapter — ## Conservazione extracted into notes', () => {
  const adapter = getImportAdapterForDomain('ricetteperbimby.it')!;
  const url = 'https://www.ricetteperbimby.it/ricette/pasta-frolla-classica-bimby';

  it('notes contains the Conservazione section', () => {
    const result = adapter.parse(RPB_WITH_CONSERVAZIONE, url);
    expect(result.notes).toContain('Conservazione:');
    expect(result.notes).toContain('frigo');
  });

  it('Conservazione content does not bleed into steps', () => {
    const result = adapter.parse(RPB_WITH_CONSERVAZIONE, url);
    // "pellicola" and "3 giorni" are distinctive to the Conservazione section, not in the cooking steps
    expect(result.steps.every(s => !s.includes('pellicola'))).toBe(true);
    expect(result.steps.every(s => !s.includes('3 giorni'))).toBe(true);
  });

  it('extracts correct steps count', () => {
    const result = adapter.parse(RPB_WITH_CONSERVAZIONE, url);
    expect(result.steps.length).toBe(2);
  });
});

describe('RicettePerBimby adapter — other adapters unaffected by RPB changes', () => {
  it('GialloZafferano adapter still parses steps and now extracts editorial notes', () => {
    const adapter = getImportAdapterForDomain('giallozafferano.it')!;
    const result = adapter.parse(GZ_MARKDOWN_WITH_AGGIUNGI, 'https://ricette.giallozafferano.it/test.html');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.notes).toContain('Conservazione'); // GZ now extracts editorial notes
  });

  it('Vegolosi adapter still parses steps and now extracts Conservazione notes', () => {
    const adapter = getImportAdapterForDomain('vegolosi.it')!;
    const result = adapter.parse(VEGOLOSI_OLD_H3_WITH_CONSERVAZIONE, 'https://vegolosi.it/ricette-vegane/pasta-al-pesto/');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.notes).toContain('Conservazione'); // Vegolosi now extracts Conservazione notes
  });
});

// ─── RBN title cleanup ────────────────────────────────────────────────────────

const RBN_MARKDOWN_TITLE_HYPHEN = `# Risotto ai Funghi - Ricette-Bimby

Tempo totale

25 min

Porzioni

4

### Ingredienti

* 320 g riso Carnaroli
* 300 g funghi misti
* 1 scalogno

### Preparazione

1. Tritare lo scalogno nel boccale: 5 sec. vel. 5.
2. Soffriggere con olio: 3 min. 100°C vel. 1.
3. Aggiungere riso e funghi, cuocere con il brodo.`;

describe('Ricette-Bimby.net adapter — step cleanup', () => {
  it('folds standalone parenthetical cooking notes into the previous step instead of leaving them as an isolated step', () => {
    const result = importWebsiteRecipeWithAdapters(
      RBN_MARKDOWN_WITH_STANDALONE_PARENTHESES_NOTE,
      'https://ricette-bimby.net/pancake-allo-yogurt-bimby/',
    );

    expect(result.preparationType).toBe('bimby');
    expect(result.steps.some(step => step === '(Il passaggio del coperchio aiuterà al composto a gonfiarsi).')).toBe(false);
    expect(result.steps.some(step => step.includes('gonfiarsi'))).toBe(true);
  });

  it('strips "- Ricette-Bimby" hyphenated title suffix', () => {
    const adapter = getImportAdapterForDomain('ricette-bimby.net')!;
    const result = adapter.parse(RBN_MARKDOWN_TITLE_HYPHEN, 'https://ricette-bimby.net/risotto-funghi/');
    expect(result.name).toBe('Risotto ai Funghi');
    expect(result.name).not.toContain('Ricette');
    expect(result.name).not.toContain('Bimby');
  });
});
