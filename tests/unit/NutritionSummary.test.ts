import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia } from 'pinia';
import NutritionSummary from '../../src/components/NutritionCard.vue';

// ── Browser-API stubs ─────────────────────────────────────────────────────────
// Watches don't fire during SSR rendering, so animateDonut() is never called.
// Stub these APIs so any accidental synchronous reference doesn't crash node.

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => 0 });
  // prefers-reduced-motion: reduce → animateDonut exits early on any call
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
});

// ── Factories ─────────────────────────────────────────────────────────────────

function makeRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Porridge',
    ingredients: ['100g avena', '250ml latte'],
    nutrition: null,
    ...overrides,
  };
}

function makeContext(dataOverrides: Record<string, unknown> = {}) {
  return {
    data: {
      kcal:     400,
      proteinG: 20.5,
      carbsG:   50.3,
      fatG:     15.2,
      fiberG:    3.1,
      ...dataOverrides,
    },
    isPerServing: false,
    servingsUsed: undefined,
  };
}

async function render(props: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = createSSRApp(NutritionSummary as any, props);
  app.use(createPinia());
  return renderToString(app);
}

// ── 1. Renders kcal and macro rows ────────────────────────────────────────────

describe('NutritionSummary — renders kcal and macros', () => {
  it('renders kcal in donut hole when macros are present', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    // donutProgress starts at 1 → animatedNumbers.kcal = 400 * 1 = 400
    expect(html).toContain('400');
    expect(html).toContain('kcal');
  });

  it('renders protein macro row', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-macro-row--protein');
    // 20.5 * 1 (progress=1) → toFixed(1) → "20.5"
    expect(html).toContain('20.5');
  });

  it('renders carbs macro row', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-macro-row--carbs');
    expect(html).toContain('50.3');
  });

  it('renders fat macro row', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-macro-row--fat');
    expect(html).toContain('15.2');
  });

  it('renders fiber macro row', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-macro-row--fiber');
    expect(html).toContain('3.1');
  });
});

// ── 2. Calculate button ───────────────────────────────────────────────────────

describe('NutritionSummary — calculate button', () => {
  it('renders the calculate button when not calculating', async () => {
    const html = await render({
      recipe:           makeRecipe(),
      isCalculating:    false,
      nutritionContext: null,
    });
    expect(html).toContain('<button');
    // button must NOT be disabled
    expect(html).not.toMatch(/disabled/);
  });

  it('button is disabled and shows ellipsis when isCalculating is true', async () => {
    const html = await render({
      recipe:           makeRecipe(),
      isCalculating:    true,
      nutritionContext: null,
    });
    expect(html).toMatch(/disabled/);
    expect(html).toContain('…');
  });

  it('button is not disabled when isCalculating is false', async () => {
    const html = await render({
      recipe:           makeRecipe(),
      isCalculating:    false,
      nutritionContext: null,
    });
    expect(html).not.toMatch(/disabled/);
  });
});

// ── 3. Loading / calculating state ───────────────────────────────────────────

describe('NutritionSummary — loading state', () => {
  it('renders loading donut when isCalculating is true', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'partial' } }),
      isCalculating:    true,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-donut--loading');
  });

  it('does not render loading donut when isCalculating is false', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).not.toContain('nutrition-donut--loading');
  });

  it('renders spinner element inside loading donut', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'partial' } }),
      isCalculating:    true,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-spinner');
  });
});

// ── 4. Stale warning ──────────────────────────────────────────────────────────

describe('NutritionSummary — stale warning', () => {
  it('shows stale warning when ingredients fingerprint does not match', async () => {
    const recipe = makeRecipe({
      ingredients: ['100g avena', '250ml latte', '1 banana'],  // 3 ingredients
      nutrition: {
        status: 'complete',
        ingredientsFingerprint: '100g avena|250ml latte',      // fingerprint for 2
      },
    });
    const html = await render({
      recipe,
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-stale-warning');
  });

  it('does not show stale warning when fingerprint matches', async () => {
    const recipe = makeRecipe({
      ingredients: ['100g avena', '250ml latte'],
      nutrition: {
        status: 'complete',
        ingredientsFingerprint: '100g avena|250ml latte',
      },
    });
    const html = await render({
      recipe,
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).not.toContain('nutrition-stale-warning');
  });

  it('does not show stale warning when no fingerprint is stored', async () => {
    const recipe = makeRecipe({
      nutrition: { status: 'complete' },
    });
    const html = await render({
      recipe,
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).not.toContain('nutrition-stale-warning');
  });
});

// ── 5. Status notes ───────────────────────────────────────────────────────────

describe('NutritionSummary — status notes', () => {
  it('shows partial note when status is partial', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'partial' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-partial-note');
  });

  it('does not show partial note when status is complete', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).not.toContain('nutrition-partial-note');
  });

  it('shows estimation note when status is complete', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-estimation-note');
  });

  it('shows estimation note when status is partial', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'partial' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-estimation-note');
  });

  it('does not show estimation note when status is manual', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'manual' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).not.toContain('nutrition-estimation-note');
  });

  it('shows manual note when status is manual', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'manual' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('nutrition-manual-note');
  });

  it('does not show manual note when status is complete', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).not.toContain('nutrition-manual-note');
  });
});

// ── 6. Missing or zero macro data ─────────────────────────────────────────────

describe('NutritionSummary — missing or zero macro data', () => {
  it('does not crash when nutritionContext is null', async () => {
    await expect(render({
      recipe:           makeRecipe(),
      isCalculating:    false,
      nutritionContext: null,
    })).resolves.toContain('nutrition-summary-card');
  });

  it('does not render macro rows when all macros are null', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext({ proteinG: null, carbsG: null, fatG: null, fiberG: null }),
    });
    expect(html).not.toContain('nutrition-macro-row--protein');
    expect(html).not.toContain('nutrition-macro-row--carbs');
    expect(html).not.toContain('nutrition-macro-row--fat');
    expect(html).not.toContain('nutrition-macro-row--fiber');
  });

  it('renders kcal-solo (no donut ring) when all macros are zero', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext({ proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }),
    });
    // macroDonut returns null when total = 0 → no conic-gradient → solo kcal circle
    expect(html).toContain('nutrition-kcal-solo');
    // rows still render (v-if checks != null, not > 0), showing "0.0g"
    expect(html).toContain('0.0g');
  });

  it('renders no-macros note when all macros are zero', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext({ proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }),
    });
    expect(html).toContain('nutrition-no-macros-note');
  });

  it('renders kcal=0 without crashing', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }),
    });
    expect(html).toContain('nutrition-summary-card');
  });

  it('hides protein row when proteinG is null but renders other macros', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext({ proteinG: null }),
    });
    expect(html).not.toContain('nutrition-macro-row--protein');
    expect(html).toContain('nutrition-macro-row--carbs');
  });
});

// ── 7. Accessibility: donut role and aria-label ───────────────────────────────

describe('NutritionSummary — accessibility', () => {
  it('donut ring has role="img"', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('role="img"');
  });

  it('donut ring has nutrition_distribution aria-label', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    // The i18n key nutrition_distribution maps to the distribution label
    expect(html).toMatch(/aria-label="[^"]+"/);
    // aria-label must not be empty
    expect(html).not.toMatch(/aria-label=""/);
  });

  it('loading donut has role="img" with calculate label', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'partial' } }),
      isCalculating:    true,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('role="img"');
  });

  it('animated numeric spans have aria-live="off"', async () => {
    const html = await render({
      recipe:           makeRecipe({ nutrition: { status: 'complete' } }),
      isCalculating:    false,
      nutritionContext: makeContext(),
    });
    expect(html).toContain('aria-live="off"');
  });
});
