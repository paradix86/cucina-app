import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { openFoodFactsProvider, getProvider } from '../../src/lib/nutritionProviders';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fakeResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// Build a minimal OFF product that passes all guards.
function makeProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code:             '3017620422003',
    product_name:     'Pasta',
    product_name_it:  'Pasta di semola',
    url:              'https://world.openfoodfacts.org/product/3017620422003',
    nutriments: {
      'energy-kcal_100g': 350,
      'proteins_100g':    12,
      'carbohydrates_100g': 70,
      'sugars_100g':      2,
      'fat_100g':         1.5,
      'saturated-fat_100g': 0.3,
      'fiber_100g':       3,
      'salt_100g':        0.01,
      'sodium_100g':      0.004,
    },
    ...overrides,
  };
}

function offResponse(products: unknown[]): Response {
  return fakeResponse({ count: products.length, products });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

describe('openFoodFactsProvider metadata', () => {
  it('has provider = "openfoodfacts"', () => {
    expect(openFoodFactsProvider.provider).toBe('openfoodfacts');
  });

  it('has displayName "OpenFoodFacts"', () => {
    expect(openFoodFactsProvider.displayName).toBe('OpenFoodFacts');
  });

  it('exposes a search function', () => {
    expect(typeof openFoodFactsProvider.search).toBe('function');
  });
});

// ─── Nutriment mapping ────────────────────────────────────────────────────────

describe('openFoodFactsProvider — nutriment mapping', () => {
  it('maps kcal / protein / carbs / fat / fiber', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([makeProduct()]));

    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });

    expect(results).toHaveLength(1);
    const n = results[0].nutritionPer100g;
    expect(n.kcal).toBe(350);
    expect(n.proteinG).toBe(12);
    expect(n.carbsG).toBe(70);
    expect(n.fatG).toBe(1.5);
    expect(n.fiberG).toBe(3);
  });

  it('maps sugars and saturated fat', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([makeProduct()]));

    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    const n = results[0].nutritionPer100g;
    expect(n.sugarsG).toBe(2);
    expect(n.saturatedFatG).toBe(0.3);
  });

  it('maps saltG from salt_100g', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([makeProduct()]));
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results[0].nutritionPer100g.saltG).toBeCloseTo(0.01);
  });

  it('converts sodium_100g (grams) to sodiumMg (milligrams)', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([
      makeProduct({ nutriments: { 'energy-kcal_100g': 100, 'sodium_100g': 0.5 } }),
    ]));

    const results = await openFoodFactsProvider.search({ query: 'test', maxResults: 5 });
    // 0.5 g/100g × 1000 = 500 mg
    expect(results[0].nutritionPer100g.sodiumMg).toBe(500);
  });

  it('converts small sodium value correctly', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([
      makeProduct({ nutriments: { 'energy-kcal_100g': 50, 'sodium_100g': 0.004 } }),
    ]));

    const results = await openFoodFactsProvider.search({ query: 'test', maxResults: 5 });
    expect(results[0].nutritionPer100g.sodiumMg).toBe(4);
  });

  it('handles dirty numeric strings in nutriments', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([
      makeProduct({
        nutriments: {
          'energy-kcal_100g': '350',
          'proteins_100g':    '12,5',
          'fat_100g':         '1.5',
        },
      }),
    ]));

    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results[0].nutritionPer100g.kcal).toBe(350);
    expect(results[0].nutritionPer100g.proteinG).toBe(12.5);
    expect(results[0].nutritionPer100g.fatG).toBe(1.5);
  });

  it('sets externalUrl when product url is present', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([makeProduct()]));
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results[0].externalUrl).toBe('https://world.openfoodfacts.org/product/3017620422003');
  });

  it('uses localized product name when available', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([makeProduct()]));
    // Default language is 'it', so product_name_it should be preferred
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results[0].name).toBe('Pasta di semola');
  });

  it('falls back to product_name when localized name is absent', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([
      makeProduct({ product_name_it: '', product_name: 'Pasta generica' }),
    ]));
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results[0].name).toBe('Pasta generica');
  });
});

// ─── Filtering ────────────────────────────────────────────────────────────────

describe('openFoodFactsProvider — filtering', () => {
  it('skips products with no nutriments object', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([
      makeProduct({ nutriments: undefined }),
      makeProduct({ product_name_it: 'Riso', product_name: 'Riso' }),
    ]));

    const results = await openFoodFactsProvider.search({ query: 'riso', maxResults: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Riso');
  });

  it('skips products with empty nutriments (no usable fields)', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([
      makeProduct({ nutriments: {} }),
      makeProduct({ product_name_it: 'Valido', product_name: 'Valido' }),
    ]));

    const results = await openFoodFactsProvider.search({ query: 'valido', maxResults: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Valido');
  });

  it('skips products with missing product name', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([
      makeProduct({ product_name_it: '', product_name: '' }),
      makeProduct({ product_name_it: 'Olio', product_name: 'Olio' }),
    ]));

    const results = await openFoodFactsProvider.search({ query: 'olio', maxResults: 5 });
    expect(results).toHaveLength(1);
  });

  it('skips non-object items in products array', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({
      products: [ null, undefined, 42, makeProduct({ product_name_it: 'Ok', product_name: 'Ok' }) ],
    }));

    const results = await openFoodFactsProvider.search({ query: 'ok', maxResults: 5 });
    expect(results).toHaveLength(1);
  });
});

// ─── maxResults ───────────────────────────────────────────────────────────────

describe('openFoodFactsProvider — maxResults', () => {
  it('honours maxResults limit on results slice', async () => {
    const products = Array.from({ length: 10 }, (_, i) =>
      makeProduct({ code: String(i), product_name_it: `Item ${i}`, product_name: `Item ${i}` }),
    );
    fetchMock.mockResolvedValueOnce(offResponse(products));

    const results = await openFoodFactsProvider.search({ query: 'item', maxResults: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('passes maxResults as page_size in the fetch URL', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([]));

    await openFoodFactsProvider.search({ query: 'pasta', maxResults: 7 });

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('page_size=7');
  });

  it('defaults to 5 results when maxResults is omitted', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([]));

    await openFoodFactsProvider.search({ query: 'pasta' });

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('page_size=5');
  });
});

// ─── Confidence scoring & sorting ─────────────────────────────────────────────

describe('openFoodFactsProvider — confidence scoring', () => {
  it('exact name match has highest confidence', async () => {
    const exact   = makeProduct({ product_name_it: 'pasta', product_name: 'pasta' });
    const partial = makeProduct({ code: '999', product_name_it: 'pasta lunga', product_name: 'pasta lunga' });
    fetchMock.mockResolvedValueOnce(offResponse([ partial, exact ]));

    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results[0].name).toBe('pasta');
    expect(results[0].confidence).toBe(0.9);
  });

  it('results are sorted by confidence descending', async () => {
    const products = [
      makeProduct({ code: '1', product_name_it: 'riso integrale con cereali', product_name: 'riso' }),
      makeProduct({ code: '2', product_name_it: 'riso', product_name: 'riso' }),
      makeProduct({ code: '3', product_name_it: 'riso carnaroli', product_name: 'riso carnaroli' }),
    ];
    fetchMock.mockResolvedValueOnce(offResponse(products));

    const results = await openFoodFactsProvider.search({ query: 'riso', maxResults: 5 });
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].confidence).toBeGreaterThanOrEqual(results[i + 1].confidence);
    }
  });

  it('name-starts-with-query scores higher than name-contains-query', async () => {
    const startsWith = makeProduct({ code: '1', product_name_it: 'pasta al pomodoro', product_name: 'pasta al pomodoro' });
    const contains   = makeProduct({ code: '2', product_name_it: 'sugo con pasta fresca', product_name: 'sugo con pasta fresca' });
    fetchMock.mockResolvedValueOnce(offResponse([ contains, startsWith ]));

    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    const idxStart   = results.findIndex(r => r.id === '1');
    const idxContain = results.findIndex(r => r.id === '2');
    expect(idxStart).toBeLessThan(idxContain);
  });
});

// ─── Error / robustness ───────────────────────────────────────────────────────

describe('openFoodFactsProvider — error handling', () => {
  it('returns [] on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results).toEqual([]);
  });

  it('returns [] on non-200 response', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({}, false));
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results).toEqual([]);
  });

  it('returns [] when response JSON is not an object', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse('not-an-object'));
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results).toEqual([]);
  });

  it('returns [] when products field is missing', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ count: 0 }));
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results).toEqual([]);
  });

  it('returns [] when products is not an array', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ products: 'oops' }));
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results).toEqual([]);
  });

  it('returns [] for empty query', async () => {
    const results = await openFoodFactsProvider.search({ query: '', maxResults: 5 });
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] for whitespace-only query', async () => {
    const results = await openFoodFactsProvider.search({ query: '   ', maxResults: 5 });
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] when json() throws', async () => {
    fetchMock.mockResolvedValueOnce({
      ok:   true,
      json: () => Promise.reject(new Error('bad json')),
    } as unknown as Response);
    const results = await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });
    expect(results).toEqual([]);
  });
});

// ─── Query building ───────────────────────────────────────────────────────────

describe('openFoodFactsProvider — query building', () => {
  it('uses normalizedQuery when provided', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([]));

    await openFoodFactsProvider.search({
      query:           'parmigiano reggiano',
      normalizedQuery: 'parmigiano',
      maxResults:      5,
    });

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('search_terms=parmigiano');
    expect(calledUrl).not.toContain('reggiano');
  });

  it('falls back to query when normalizedQuery is absent', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([]));

    await openFoodFactsProvider.search({ query: 'pasta fresca', maxResults: 5 });

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('search_terms=pasta+fresca');
  });

  it('sends lc parameter for provided language', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([]));

    await openFoodFactsProvider.search({ query: 'pasta', language: 'en', maxResults: 5 });

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('lc=en');
  });

  it('defaults lc to "it" when no language is provided', async () => {
    fetchMock.mockResolvedValueOnce(offResponse([]));

    await openFoodFactsProvider.search({ query: 'pasta', maxResults: 5 });

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('lc=it');
  });
});

// ─── Registry ─────────────────────────────────────────────────────────────────

describe('provider registry', () => {
  it('getProvider("openfoodfacts") returns the client', () => {
    const provider = getProvider('openfoodfacts');
    expect(provider).toBeDefined();
    expect(provider?.provider).toBe('openfoodfacts');
  });

  it('getProvider("openfoodfacts") returns openFoodFactsProvider', () => {
    expect(getProvider('openfoodfacts')).toBe(openFoodFactsProvider);
  });
});
