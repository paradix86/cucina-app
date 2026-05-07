import { describe, it, expect } from 'vitest';
import {
  decodeImportEntities,
  buildImportedRecipe,
} from '../../src/lib/import/adapters/utils';
import { migrateRecipeEntities } from '../../src/lib/htmlEntityMigration';
import type { Recipe } from '../../src/types';

// In the Vitest 'node' environment DOMParser is undefined, so these tests
// exercise the hand-rolled fallback path of decodeImportEntities. The
// browser-runtime DOMParser path is exercised by users at runtime; both paths
// produce the same output for the entities under test.

describe('decodeImportEntities', () => {
  it('decodes the numeric entity for the curly apostrophe (the user-reported bug)', () => {
    expect(decodeImportEntities('Tuorlo d&#8217;uovo'))
      .toBe('Tuorlo d’uovo');
  });

  it('decodes numeric entities for accented vowels', () => {
    expect(decodeImportEntities('Caff&#232;')).toBe('Caffè');
    expect(decodeImportEntities('Ros&#233;')).toBe('Rosé');
    expect(decodeImportEntities('Citt&#224;')).toBe('Città');
  });

  it('decodes hex entities', () => {
    expect(decodeImportEntities('Caf&#xE9;')).toBe('Café');
    expect(decodeImportEntities('Caf&#xe9;')).toBe('Café'); // case-insensitive hex
  });

  it('decodes named entities', () => {
    expect(decodeImportEntities('Salt &amp; pepper')).toBe('Salt & pepper');
    expect(decodeImportEntities('&rsquo;Tis the season')).toBe('’Tis the season');
    expect(decodeImportEntities('Three dots&hellip;')).toBe('Three dots…');
    expect(decodeImportEntities('&eacute;clair')).toBe('éclair');
    expect(decodeImportEntities('&deg;C')).toBe('°C');
  });

  it('handles mixed entities in one string', () => {
    expect(decodeImportEntities('Caff&#232; &amp; cornetto'))
      .toBe('Caffè & cornetto');
  });

  it('returns input unchanged when there are no entities (fast path)', () => {
    const input = 'Already decoded text with no entities';
    expect(decodeImportEntities(input)).toBe(input);
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(decodeImportEntities(null)).toBe('');
    expect(decodeImportEntities(undefined)).toBe('');
    expect(decodeImportEntities('')).toBe('');
  });

  it('preserves non-entity text alongside entities', () => {
    expect(decodeImportEntities('Hello &amp; goodbye, world!'))
      .toBe('Hello & goodbye, world!');
  });

  it('leaves unknown named entities untouched', () => {
    expect(decodeImportEntities('a &fakeentity; b'))
      .toBe('a &fakeentity; b');
  });

  it('rejects out-of-range numeric refs without crashing', () => {
    // A code point above U+10FFFF is invalid Unicode; decoder leaves it.
    expect(decodeImportEntities('boom &#9999999;')).toContain('&#9999999;');
  });
});

describe('buildImportedRecipe with entities', () => {
  it('decodes the name field at the chokepoint', () => {
    const result = buildImportedRecipe('https://example.com/recipe', {
      name: 'Tuorlo d&#8217;uovo',
      ingredients: ['320g spaghetti'],
      steps: ['Mix.'],
    });
    expect(result.name).toBe('Tuorlo d’uovo');
  });

  it('decodes each ingredient', () => {
    const result = buildImportedRecipe('https://example.com/recipe', {
      name: 'Test',
      ingredients: ['Caff&#232;', '200g zucchero', 'cioccolato &amp; vaniglia'],
      steps: [],
    });
    expect(result.ingredients).toEqual([
      'Caffè',
      '200g zucchero',
      'cioccolato & vaniglia',
    ]);
  });

  it('decodes each step', () => {
    const result = buildImportedRecipe('https://example.com/recipe', {
      name: 'Test',
      ingredients: [],
      steps: ['Mescola l&#8217;impasto', 'Cuoci 30 min'],
    });
    expect(result.steps).toEqual([
      'Mescola l’impasto',
      'Cuoci 30 min',
    ]);
  });

  it('does not decode the URL (entities in URL query strings are valid syntax)', () => {
    const result = buildImportedRecipe('https://example.com/path?a=1&amp;b=2', {
      name: 'Test',
      ingredients: [],
      steps: [],
    });
    expect(result.url).toBe('https://example.com/path?a=1&amp;b=2');
  });
});

describe('migrateRecipeEntities', () => {
  function makeRecipe(overrides: Partial<Recipe>): Recipe {
    return {
      id: 'r1',
      name: 'Stub',
      ingredients: [],
      steps: [],
      ...overrides,
    };
  }

  it('migrates a recipe with an entity in name (the user-reported case)', () => {
    const before = [
      makeRecipe({ id: '1', name: 'Tuorlo d&#8217;uovo' }),
      makeRecipe({ id: '2', name: 'Pasta al pomodoro' }),
    ];
    const { recipes, migratedCount } = migrateRecipeEntities(before);
    expect(migratedCount).toBe(1);
    expect(recipes[0].name).toBe('Tuorlo d’uovo');
    expect(recipes[1].name).toBe('Pasta al pomodoro');
  });

  it('migrates entities in ingredients and steps', () => {
    const before = [
      makeRecipe({
        id: '1',
        name: 'Test',
        ingredients: ['Caff&#232;', 'Latte'],
        steps: ['Mescola l&#8217;impasto'],
      }),
    ];
    const { recipes, migratedCount } = migrateRecipeEntities(before);
    expect(migratedCount).toBe(1);
    expect(recipes[0].ingredients).toEqual(['Caffè', 'Latte']);
    expect(recipes[0].steps).toEqual(['Mescola l’impasto']);
  });

  it('is idempotent: a second run is a no-op (zero migrations)', () => {
    const dirty = [makeRecipe({ id: '1', name: 'Tuorlo d&#8217;uovo' })];
    const first = migrateRecipeEntities(dirty);
    const second = migrateRecipeEntities(first.recipes);
    expect(second.migratedCount).toBe(0);
    expect(second.recipes).toEqual(first.recipes);
  });

  it('returns the same object reference for unchanged recipes (no needless cloning)', () => {
    const r = makeRecipe({ id: '1', name: 'Pasta al pomodoro' });
    const { recipes, migratedCount } = migrateRecipeEntities([r]);
    expect(migratedCount).toBe(0);
    expect(recipes[0]).toBe(r);
  });

  it('handles empty input', () => {
    const { recipes, migratedCount } = migrateRecipeEntities([]);
    expect(migratedCount).toBe(0);
    expect(recipes).toEqual([]);
  });

  it('handles recipes with missing arrays defensively', () => {
    const before = [
      { id: '1', name: 'Tuorlo d&#8217;uovo' } as Recipe,
    ];
    const { recipes, migratedCount } = migrateRecipeEntities(before);
    expect(migratedCount).toBe(1);
    expect(recipes[0].name).toBe('Tuorlo d’uovo');
  });
});
