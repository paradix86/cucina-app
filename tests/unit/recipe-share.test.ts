import { describe, it, expect } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';
import {
  encodeSharePayload,
  decodeShareData,
  sharedPayloadToRecipe,
  SHARE_SCHEMA_VERSION,
} from '../../src/lib/recipeShare';
import type { Recipe } from '../../src/types';

const BASE_RECIPE: Recipe = {
  id: 'test-id-123',
  name: 'Pasta al Pomodoro',
  category: 'Primi',
  emoji: '🍝',
  time: '20 min',
  servings: '4',
  preparationType: 'classic',
  bimby: false,
  source: 'manual',
  ingredients: [ '200g pasta', '400g pomodori', '1 spicchio aglio' ],
  steps: [ 'Cuoci la pasta', 'Prepara il sugo', 'Unisci e servi' ],
  timerMinutes: 10,
  notes: 'Ottima con basilico fresco',
  favorite: true,
  lastViewedAt: 1700000000000,
  tags: [ 'veloce', 'vegetariano' ],
};

describe('encodeSharePayload + decodeShareData roundtrip', () => {
  it('roundtrip preserves required fields', () => {
    const encoded = encodeSharePayload(BASE_RECIPE);
    const decoded = decodeShareData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.v).toBe(SHARE_SCHEMA_VERSION);
    expect(decoded!.name).toBe('Pasta al Pomodoro');
    expect(decoded!.ingredients).toEqual([ '200g pasta', '400g pomodori', '1 spicchio aglio' ]);
    expect(decoded!.steps).toEqual([ 'Cuoci la pasta', 'Prepara il sugo', 'Unisci e servi' ]);
  });

  it('roundtrip preserves optional fields', () => {
    const encoded = encodeSharePayload(BASE_RECIPE);
    const decoded = decodeShareData(encoded);
    expect(decoded!.category).toBe('Primi');
    expect(decoded!.emoji).toBe('🍝');
    expect(decoded!.time).toBe('20 min');
    expect(decoded!.servings).toBe('4');
    expect(decoded!.preparationType).toBe('classic');
    expect(decoded!.timerMinutes).toBe(10);
    expect(decoded!.notes).toBe('Ottima con basilico fresco');
    expect(decoded!.tags).toEqual([ 'veloce', 'vegetariano' ]);
  });

  it('strips internal fields: id, favorite, lastViewedAt, source, bimby', () => {
    const encoded = encodeSharePayload(BASE_RECIPE);
    // Cast is intentional: the test probes for fields that are deliberately
    // NOT in SharedRecipePayload (id, favorite, lastViewedAt, source, bimby).
    const decoded = decodeShareData(encoded) as unknown as Record<string, unknown>;
    expect(decoded[ 'id' ]).toBeUndefined();
    expect(decoded[ 'favorite' ]).toBeUndefined();
    expect(decoded[ 'lastViewedAt' ]).toBeUndefined();
    expect(decoded[ 'source' ]).toBeUndefined();
    expect(decoded[ 'bimby' ]).toBeUndefined();
  });

  it('sanitizes coverImageUrl: keeps valid https URL', () => {
    const r: Recipe = { ...BASE_RECIPE, coverImageUrl: 'https://example.com/img.jpg' };
    const decoded = decodeShareData(encodeSharePayload(r));
    expect(decoded!.coverImageUrl).toBe('https://example.com/img.jpg');
  });

  it('sanitizes coverImageUrl: strips javascript: protocol', () => {
    const r: Recipe = { ...BASE_RECIPE, coverImageUrl: 'javascript:alert(1)' };
    const decoded = decodeShareData(encodeSharePayload(r));
    expect(decoded!.coverImageUrl).toBeUndefined();
  });

  it('sanitizes coverImageUrl: strips data: URL', () => {
    const r: Recipe = { ...BASE_RECIPE, coverImageUrl: 'data:text/html,<h1>xss</h1>' };
    const decoded = decodeShareData(encodeSharePayload(r));
    expect(decoded!.coverImageUrl).toBeUndefined();
  });

  it('omits notes when empty', () => {
    const r: Recipe = { ...BASE_RECIPE, notes: '' };
    const decoded = decodeShareData(encodeSharePayload(r));
    expect(decoded!.notes).toBeUndefined();
  });

  it('omits timerMinutes when zero', () => {
    const r: Recipe = { ...BASE_RECIPE, timerMinutes: 0 };
    const decoded = decodeShareData(encodeSharePayload(r));
    expect(decoded!.timerMinutes).toBeUndefined();
  });
});

describe('decodeShareData validation', () => {
  it('returns null for non-string input', () => {
    expect(decodeShareData(null)).toBeNull();
    expect(decodeShareData(42)).toBeNull();
    expect(decodeShareData({})).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeShareData('')).toBeNull();
  });

  it('returns null for oversized input', () => {
    const oversized = 'A'.repeat(13000);
    expect(decodeShareData(oversized)).toBeNull();
  });

  it('returns null for wrong schema version', () => {
    const encoded = encodeSharePayload(BASE_RECIPE);
    // Cast is intentional: tampering by adding 'v: 99' which isn't a field
    // of SharedRecipePayload — purpose of the test is to inject an invalid one.
    const decoded = decodeShareData(encoded) as unknown as Record<string, unknown>;
    const tampered = JSON.stringify({ ...decoded, v: 99 });
    const reencoded = compressToEncodedURIComponent(tampered);
    expect(decodeShareData(reencoded)).toBeNull();
  });

  it('returns null when name is missing', () => {
    const payload = { v: 1, name: '', ingredients: [ 'a' ], steps: [ 'b' ] };
    expect(decodeShareData(compressToEncodedURIComponent(JSON.stringify(payload)))).toBeNull();
  });

  it('returns null when ingredients is empty', () => {
    const payload = { v: 1, name: 'Test', ingredients: [], steps: [ 'b' ] };
    expect(decodeShareData(compressToEncodedURIComponent(JSON.stringify(payload)))).toBeNull();
  });

  it('returns null when steps is empty', () => {
    const payload = { v: 1, name: 'Test', ingredients: [ 'a' ], steps: [] };
    expect(decodeShareData(compressToEncodedURIComponent(JSON.stringify(payload)))).toBeNull();
  });

  it('returns null for random garbage string', () => {
    expect(decodeShareData('not-valid-lz-string-data!!!!')).toBeNull();
  });

  it('rejects invalid preparationType silently (field omitted)', () => {
    const payload = { v: 1, name: 'Test', ingredients: [ 'a' ], steps: [ 'b' ], preparationType: 'microwave' };
    const result = decodeShareData(compressToEncodedURIComponent(JSON.stringify(payload)));
    expect(result).not.toBeNull();
    expect(result!.preparationType).toBeUndefined();
  });
});

describe('sharedPayloadToRecipe', () => {
  it('builds a full Recipe with the given id', () => {
    const encoded = encodeSharePayload(BASE_RECIPE);
    const payload = decodeShareData(encoded)!;
    const recipe = sharedPayloadToRecipe(payload, 'new-id-abc');
    expect(recipe.id).toBe('new-id-abc');
    expect(recipe.name).toBe('Pasta al Pomodoro');
    expect(recipe.source).toBe('shared');
    expect(recipe.favorite).toBe(false);
    expect(recipe.lastViewedAt).toBe(0);
    expect(recipe.notes).toBe('');
  });

  it('sets bimby=true when preparationType is bimby', () => {
    const payload = { v: 1, name: 'Bimby Test', ingredients: [ 'a' ], steps: [ 'b' ], preparationType: 'bimby' };
    const decoded = decodeShareData(compressToEncodedURIComponent(JSON.stringify(payload)))!;
    const recipe = sharedPayloadToRecipe(decoded, 'x');
    expect(recipe.bimby).toBe(true);
    expect(recipe.preparationType).toBe('bimby');
  });
});

describe('decodeShareData — backward compat (base64url fallback)', () => {
  it('decodes plain base64url-encoded JSON as legacy fallback', () => {
    const legacyPayload = {
      v: 1,
      name: 'Legacy Pasta',
      ingredients: ['200g pasta', '400g pomodori'],
      steps: ['Cuoci', 'Servi'],
    };
    // base64url: replace + with -, / with _, strip padding
    const b64 = btoa(JSON.stringify(legacyPayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const result = decodeShareData(b64);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Legacy Pasta');
    expect(result!.ingredients).toHaveLength(2);
  });

  it('returns null for base64url input with invalid structure', () => {
    const bad = btoa(JSON.stringify({ foo: 'bar' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(decodeShareData(bad)).toBeNull();
  });

  it('returns null for base64url with wrong schema version', () => {
    const bad = btoa(JSON.stringify({ v: 99, name: 'x', ingredients: ['a'], steps: ['b'] }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(decodeShareData(bad)).toBeNull();
  });
});

describe('compression ratio', () => {
  it('compressed payload is shorter than plain JSON for a typical recipe', () => {
    const longRecipe: Recipe = {
      ...BASE_RECIPE,
      ingredients: Array(20).fill('100 grammi di ingrediente molto lungo con descrizione dettagliata'),
      steps: Array(15).fill('Prendere gli ingredienti e procedere con la preparazione seguendo attentamente le istruzioni'),
      notes: 'Queste note sono molto lunghe e contengono molti dettagli sulla ricetta, incluse varianti e suggerimenti di presentazione.',
    };
    const compressed = encodeSharePayload(longRecipe);
    const plainJson = JSON.stringify({
      v: 1,
      name: longRecipe.name,
      ingredients: longRecipe.ingredients,
      steps: longRecipe.steps,
      notes: longRecipe.notes,
    });
    expect(compressed.length).toBeLessThan(plainJson.length);
  });

  it('compressed payload decodes correctly for a large recipe', () => {
    const largeRecipe: Recipe = {
      ...BASE_RECIPE,
      ingredients: Array(30).fill('200 grammi di ingrediente vario'),
      steps: Array(20).fill('Procedere con la preparazione degli ingredienti'),
    };
    const encoded = encodeSharePayload(largeRecipe);
    const decoded = decodeShareData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.ingredients).toHaveLength(30);
    expect(decoded!.steps).toHaveLength(20);
  });
});

describe('buildShareUrl URL format', () => {
  // Note: buildShareUrl requires browser context (window + import.meta.env)
  // These tests verify the URL format logic when available

  it('encodes recipe to URL-safe format', () => {
    const encoded = encodeSharePayload(BASE_RECIPE);
    // Should be valid LZ-string compressed data
    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded).toMatch(/^[A-Za-z0-9+/=_-]+$/);
  });

  it('decoded data contains expected fields for URL query', () => {
    const encoded = encodeSharePayload(BASE_RECIPE);
    const decoded = decodeShareData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Pasta al Pomodoro');
    expect(decoded!.ingredients).toHaveLength(3);
    expect(decoded!.steps).toHaveLength(3);
  });

  it('handles recipe with minimal data', () => {
    const minimalRecipe: Recipe = {
      id: 'x',
      name: 'Simple',
      category: '',
      emoji: '',
      time: '',
      servings: '',
      preparationType: 'classic',
      bimby: false,
      source: 'manual',
      ingredients: [ '1 cup flour' ],
      steps: [ 'Mix' ],
      timerMinutes: 0,
      notes: '',
      favorite: false,
      lastViewedAt: 0,
    };
    const encoded = encodeSharePayload(minimalRecipe);
    const decoded = decodeShareData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Simple');
    expect(decoded!.ingredients).toEqual([ '1 cup flour' ]);
    expect(decoded!.steps).toEqual([ 'Mix' ]);
  });

  it('handles recipe with maximum fields', () => {
    const maxRecipe: Recipe = {
      id: 'x',
      name: 'Max Recipe',
      category: 'Dessert',
      emoji: '🎂',
      time: '60 min',
      servings: '8',
      preparationType: 'bimby',
      bimby: true,
      source: 'manual',
      ingredients: Array(50).fill('ingredient'),
      steps: Array(50).fill('step'),
      timerMinutes: 30,
      notes: 'Some notes',
      favorite: true,
      lastViewedAt: Date.now(),
      tags: [ 'tag1', 'tag2', 'tag3' ],
      coverImageUrl: 'https://example.com/image.jpg',
    };
    const encoded = encodeSharePayload(maxRecipe);
    const decoded = decodeShareData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Max Recipe');
    expect(decoded!.ingredients).toHaveLength(50);
    expect(decoded!.steps).toHaveLength(50);
    expect(decoded!.tags).toHaveLength(3);
    expect(decoded!.coverImageUrl).toBe('https://example.com/image.jpg');
  });
});
