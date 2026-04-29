import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  stripMarkdown,
  extractListLines,
  extractNumberedSteps,
  inferPreparationType,
  normalizeBimbyStep,
  parseDuemmeRecipe,
} from '../../src/lib/duemmePack';

describe('duemmePack text helpers', () => {
  it('normalizes spaces and newlines and handles nullish values', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
    expect(normalizeText('line1\r\nline2')).toBe('line1\nline2');
    expect(normalizeText('hello world')).toBe('hello world');
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
    const block = [
      '',
      '1. First step:',
      '   - detail one',
      '2) Second step',
      'additional sentence',
      '',
    ].join('\n');
    expect(extractNumberedSteps(block)).toEqual([
      'First step: detail one',
      'Second step additional sentence',
    ]);
  });

  it('infers preparation type from compatibility and section hints', () => {
    expect(inferPreparationType('**Compatibilita**: Bimby-ready')).toBe('bimby');
    expect(inferPreparationType('# Recipe\n### Metodo Bimby\nsteps')).toBe('bimby');
    expect(inferPreparationType('Ricetta per friggitrice ad aria')).toBe('airfryer');
    expect(inferPreparationType('Ricetta classica')).toBe('classic');
  });
});

describe('normalizeBimbyStep', () => {
  it('formats compound notation without leaving // or stray slash artifacts', () => {
    const result = normalizeBimbyStep('Cottura: 20 min/100C/vel 1');
    expect(result).not.toContain('//');
    expect(result).not.toMatch(/\s\/\s/);
    expect(result).toContain('Vel. 1');
    expect(result).toContain('20 min');
  });

  it('removes stray slash before senso antiorario in compound notation', () => {
    const result = normalizeBimbyStep('Cuocere 15 min/100C/vel 1 senso antiorario');
    expect(result).not.toMatch(/\s\/\s/);
    expect(result).toContain('senso antiorario');
    expect(result).toContain('Vel. 1');
  });

  it('does not generate uti fragment from minuti text', () => {
    const result = normalizeBimbyStep('Cuocere 30 minuti a fuoco lento');
    expect(result).not.toMatch(/\buti\b/);
    expect(result).not.toMatch(/\d+-uti\b/);
  });

  it('handles // senso antiorario in source text', () => {
    const result = normalizeBimbyStep('Mescolare: 15 min/vel 1 senso antiorario');
    expect(result).not.toContain('//');
  });

  it('returns clean text for steps with no Bimby markers', () => {
    const result = normalizeBimbyStep('Aggiungere sale e pepe a piacere');
    expect(result).toBe('Aggiungere sale e pepe a piacere');
  });

  it('normalizes // marker indicating reverse counterclockwise mode', () => {
    const result = normalizeBimbyStep('Cuocere //');
    expect(result).not.toContain('//');
    expect(result).not.toMatch(/\s\/\s/);
    expect(result.trim()).not.toBe('');
  });

  it('normalizes // followed by senso antiorario to readable format', () => {
    const result = normalizeBimbyStep('Cuocere: 20 min // senso antiorario');
    expect(result).not.toContain('//');
    expect(result).toContain('senso antiorario');
    expect(result).toContain('20 min');
  });

  it('handles Varoma marker (high-temperature cooking mode)', () => {
    const result = normalizeBimbyStep('Cuocere 15 min Varoma vel 1');
    expect(result).not.toContain('//');
    expect(result).toContain('Varoma');
    expect(result).toContain('Vel. 1');
    expect(result).toContain('15 min');
  });

  it('cleans up double slashes left by marker removal', () => {
    const result = normalizeBimbyStep('Cuocere: // senso antiorario');
    expect(result).not.toContain('//');
    expect(result).not.toMatch(/:\s*$/);
  });
});

describe('extractNumberedSteps - bloated-step protection', () => {
  it('stops accumulating bullets at a bold section-header line', () => {
    const block = [
      '',
      '1. Cuocere la carne nel sugo',
      '2. Servire con riso',
      '**BATCH MEAL PREP (x4 porzioni)**:',
      '- Quadruplicare gli ingredienti',
      '- Cottura finale: 20 min',
      '- Conservare in frigo',
      '',
    ].join('\n');
    const steps = extractNumberedSteps(block);
    expect(steps).toHaveLength(2);
    expect(steps[1]).not.toContain('BATCH');
    expect(steps[1]).not.toContain('Quadruplicare');
  });

  it('still appends normal bullet detail lines to the current step', () => {
    const block = [
      '',
      '1. Tritare aglio e cipolla:',
      '   - finemente',
      '2. Aggiungere al soffritto',
      '',
    ].join('\n');
    const steps = extractNumberedSteps(block);
    expect(steps[0]).toContain('finemente');
    expect(steps).toHaveLength(2);
  });
});

describe('duemmePack parser', () => {
  it('builds a recipe from canonical markdown and marks it subset-eligible', () => {
    const markdown = [
      '# Pasta al Pomodoro',
      '',
      '**Categoria**: Pranzo',
      '**Tempo preparazione**: 20 minuti',
      '**Porzioni**: 1',
      '',
      '## Ingredienti',
      '- 400 g pasta',
      '- 600 ml tomato sauce',
      '- 2 cloves garlic',
      '- Salt and pepper',
      '',
      '## Preparazione',
      '### Metodo Classico',
      '1. Cook pasta in salted water',
      '2. Heat oil and garlic',
      '3. Add tomato sauce',
      '4. Mix with cooked pasta',
    ].join('\n');

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
    const markdown = [
      '# Hummus veloce',
      '**Compatibilita**: Bimby-ready',
      '',
      '## Ingredienti',
      '- ceci',
      '- tahini',
      '- limone',
      '- acqua',
      '',
      '## Preparazione',
      '1. Inserire ingredienti nel boccale',
      '2. Frullare 30 sec vel 8',
      '3. Servire',
    ].join('\n');
    const parsed = parseDuemmeRecipe('src/content/duemme/ricette/spuntini/hummus.md', markdown);
    expect(parsed.recipe).toBeTruthy();
    expect(parsed.quality.sectionUsed).toBe('full');
    expect(parsed.quality.warnings).toContain('DUEMME_FALLBACK_SECTION_USED');
  });

  it('returns null recipe when ingredient list is missing', () => {
    const markdown = [
      '# Ricetta incompleta',
      '## Ingredienti',
      'Nessuna lista disponibile',
      '## Preparazione',
      '1. Step uno',
      '2. Step due',
      '3. Step tre',
    ].join('\n');
    const parsed = parseDuemmeRecipe('src/content/duemme/ricette/cene/incompleta.md', markdown);
    expect(parsed.recipe).toBeNull();
    expect(parsed.quality.warnings).toContain('DUEMME_INGREDIENTS_MISSING');
  });
});
