import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  stripMarkdown,
  extractListLines,
  extractNumberedSteps,
  inferPreparationType,
  parseDuemmeRecipe,
} from '../../src/lib/duemmePack';

describe('duemmePack text helpers', () => {
  it('normalizes spaces/newlines and handles nullish values', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
    expect(normalizeText('line1\r\nline2')).toBe('line1\nline2');
    expect(normalizeText('hello\u00a0world')).toBe('hello world');
    expect(normalizeText('  text  ')).toBe('text');
    expect(normalizeText(null as unknown as string)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });

  it('strips markdown noise from inline text', () => {
    expect(stripMarkdown('**bold text**')).toBe('bold text');
    expect(stripMarkdown('`code` text')).toBe('code text');
    expect(stripMarkdown('[link text](url)')).toBe('link text');
    expect(stripMarkdown('![img](url) **bold** and `code` with [link](url)')).toBe('bold and code with link');
  });

  it('extracts list lines from dash, star and numbered formats', () => {
    const block = '- item 1\n* item 2\n1) item 3';
    expect(extractListLines(block)).toEqual(['item 1', 'item 2', 'item 3']);
  });

  it('extracts numbered steps with continuation lines', () => {
    const block = `
1. First step:
   - detail one
2) Second step
additional sentence
`;
    expect(extractNumberedSteps(block)).toEqual([
      'First step: detail one',
      'Second step additional sentence',
    ]);
  });

  it('infers preparation type from compatibility and section hints', () => {
    expect(inferPreparationType('**Compatibilità**: 🤖 Bimby-ready')).toBe('bimby');
    expect(inferPreparationType('# Recipe\n### 🤖 Metodo Bimby\nsteps')).toBe('bimby');
    expect(inferPreparationType('Ricetta per friggitrice ad aria')).toBe('airfryer');
    expect(inferPreparationType('Ricetta classica')).toBe('classic');
  });
});

describe('duemmePack parser', () => {
  it('builds a recipe from canonical markdown and marks it subset-eligible', () => {
    const markdown = `
# Pasta al Pomodoro

**Categoria**: Pranzo
**Tempo preparazione**: 20 minuti
**Porzioni**: 1

## Ingredienti
- 400 g pasta
- 600 ml tomato sauce
- 2 cloves garlic
- Salt and pepper

## Preparazione
### 🍳 Metodo Classico
1. Cook pasta in salted water
2. Heat oil and garlic
3. Add tomato sauce
4. Mix with cooked pasta
    `.trim();

    const parsed = parseDuemmeRecipe('src/content/duemme/ricette/pranzi/pasta.md', markdown);
    expect(parsed.recipe).toBeTruthy();
    expect(parsed.recipe?.name).toBe('Pasta al Pomodoro');
    expect(parsed.recipe?.ingredients).toHaveLength(4);
    expect(parsed.recipe?.steps).toHaveLength(4);
    expect(parsed.recipe?.mealOccasion).toEqual(['Pranzo']);
    expect(parsed.quality.warnings).toEqual([]);
    expect(parsed.quality.eligibleForSubset).toBe(true);
  });

  it('uses preparation fallback with warning when subsection heading is missing', () => {
    const markdown = `
# Hummus veloce
**Compatibilità**: 🤖 Bimby-ready

## Ingredienti
- ceci
- tahini
- limone
- acqua

## Preparazione
1. Inserire ingredienti nel boccale
2. Frullare 30 sec vel 8
3. Servire
    `.trim();
    const parsed = parseDuemmeRecipe('src/content/duemme/ricette/spuntini/hummus.md', markdown);
    expect(parsed.recipe).toBeTruthy();
    expect(parsed.quality.sectionUsed).toBe('full');
    expect(parsed.quality.warnings).toContain('DUEMME_FALLBACK_SECTION_USED');
  });

  it('returns null recipe when ingredient list is missing', () => {
    const markdown = `
# Ricetta incompleta
## Ingredienti
Nessuna lista disponibile
## Preparazione
1. Step uno
2. Step due
3. Step tre
    `.trim();
    const parsed = parseDuemmeRecipe('src/content/duemme/ricette/cene/incompleta.md', markdown);
    expect(parsed.recipe).toBeNull();
    expect(parsed.quality.warnings).toContain('DUEMME_INGREDIENTS_MISSING');
  });
});
