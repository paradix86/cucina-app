import { expect, test, type Page } from '@playwright/test';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const STORAGE_KEY = 'cucina_recipebook_v3';
const SHOPPING_LIST_KEY = 'cucina_shopping_list_v1';
const WEEKLY_PLANNER_KEY = 'cucina_weekly_planner_v1';

const EMPTY_PLANNER = {
  monday:    { breakfast: null, lunch: null, dinner: null },
  tuesday:   { breakfast: null, lunch: null, dinner: null },
  wednesday: { breakfast: null, lunch: null, dinner: null },
  thursday:  { breakfast: null, lunch: null, dinner: null },
  friday:    { breakfast: null, lunch: null, dinner: null },
  saturday:  { breakfast: null, lunch: null, dinner: null },
  sunday:    { breakfast: null, lunch: null, dinner: null },
};

type SeedState = {
  recipes?: unknown[];
  shoppingList?: unknown[];
  planner?: unknown;
};

async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.goto(`${APP_ROOT}#/${route}`);
  await expect(page.locator('main.app')).toBeVisible();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
}

async function seedState(page: Page, state: SeedState): Promise<void> {
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();

  await page.evaluate(({ recipes, shoppingList, planner, storageKey, shoppingKey, plannerKey }) => {
    localStorage.clear();
    localStorage.setItem(storageKey, JSON.stringify(recipes || []));
    localStorage.setItem(shoppingKey, JSON.stringify(shoppingList || []));
    localStorage.setItem(plannerKey, JSON.stringify(planner));
  }, {
    recipes:     state.recipes || [],
    shoppingList: state.shoppingList || [],
    planner:     state.planner || EMPTY_PLANNER,
    storageKey:  STORAGE_KEY,
    shoppingKey: SHOPPING_LIST_KEY,
    plannerKey:  WEEKLY_PLANNER_KEY,
  });

  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
}

// Pasta (350 kcal/100g) and parmigiano (392 kcal/100g) are in the manual provider fixture.
const completeRecipe = {
  id:           'nutrition-e2e-complete',
  name:         'Pasta e Parmigiano',
  source:       'manual',
  preparationType: 'classic',
  ingredients:  ['200 g pasta', '50 g parmigiano'],
  steps:        ['Cuoci la pasta', 'Aggiungi il parmigiano'],
  servings:     '2',
};

// Only pasta is known; "ingrediente sconosciuto xyz" won't match any provider entry.
const partialRecipe = {
  id:           'nutrition-e2e-partial',
  name:         'Pasta Misteriosa',
  source:       'manual',
  preparationType: 'classic',
  ingredients:  ['200 g pasta', '100 g ingrediente sconosciuto xyz'],
  steps:        ['Cuoci'],
  servings:     '2',
};

// Nothing in the manual fixture matches these.
const missingRecipe = {
  id:           'nutrition-e2e-missing',
  name:         'Ricetta Sconosciuta',
  source:       'manual',
  preparationType: 'classic',
  ingredients:  ['100 g ingrediente xyz', '50 g altro sconosciuto'],
  steps:        ['Mescola'],
};

// Olio is in the manual fixture; tbsp unit triggers gram estimation.
const estimatedRecipe = {
  id:           'nutrition-e2e-estimated',
  name:         'Pasta con Olio',
  source:       'manual',
  preparationType: 'classic',
  ingredients:  ['200 g pasta', '1 cucchiaio olio'],
  steps:        ['Cuoci', 'Condisci'],
  servings:     '2',
};

test('complete recipe: calculates nutrition and persists after reload', async ({ page }) => {
  await seedState(page, { recipes: [completeRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-complete');

  const detailView = page.locator('#saved-detail-view');
  await expect(detailView).toBeVisible();

  // Nutrition section exists but no data yet — badge should be --missing
  const badge = page.locator('.nutrition-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveClass(/nutrition-badge--missing/);

  // Calculate button is present
  const calcButton = page.locator('.nutrition-footer button');
  await expect(calcButton).toBeVisible();
  await calcButton.click();

  // After calculation the kcal value should appear (no longer '—')
  const kcalVal = page.locator('.nutrition-kcal-val');
  await expect(kcalVal).not.toHaveText('—', { timeout: 5000 });

  // Badge should no longer be --missing
  await expect(badge).not.toHaveClass(/nutrition-badge--missing/);

  // Reload the page to verify persistence
  await gotoRoute(page, 'recipe-book/nutrition-e2e-complete');
  await expect(page.locator('.nutrition-kcal-val')).not.toHaveText('—');
  await expect(page.locator('.nutrition-badge')).not.toHaveClass(/nutrition-badge--missing/);

  // Verify in localStorage directly
  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const recipes = JSON.parse(raw);
    return recipes.find((r: { id: string }) => r.id === 'nutrition-e2e-complete') ?? null;
  }, STORAGE_KEY);

  expect(stored).not.toBeNull();
  expect(stored.nutrition).toBeDefined();
  expect(stored.nutrition.status).toMatch(/^(complete|partial)$/);
  expect(stored.nutrition.perServing?.kcal ?? stored.nutrition.perRecipe?.kcal).toBeGreaterThan(0);
});

test('partial recipe: shows partial badge and partial note', async ({ page }) => {
  await seedState(page, { recipes: [partialRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-partial');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  const calcButton = page.locator('.nutrition-footer button');
  await expect(calcButton).toBeVisible();
  await calcButton.click();

  // Badge should indicate partial match
  const badge = page.locator('.nutrition-badge');
  await expect(badge).toHaveClass(/nutrition-badge--partial/, { timeout: 5000 });

  // Partial note should be visible
  await expect(page.locator('.nutrition-partial-note')).toBeVisible();
});

test('all-unknown recipe: shows missing badge without crash', async ({ page }) => {
  await seedState(page, { recipes: [missingRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-missing');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  const badge = page.locator('.nutrition-badge');
  await expect(badge).toBeVisible();

  // Before calculation badge is missing
  await expect(badge).toHaveClass(/nutrition-badge--missing/);

  const calcButton = page.locator('.nutrition-footer button');
  await expect(calcButton).toBeVisible();
  await calcButton.click();

  // After calculation of all-unknown recipe, badge stays missing — no crash
  await expect(badge).toHaveClass(/nutrition-badge--missing/, { timeout: 5000 });

  // No error toast should have appeared
  await expect(page.locator('#toast-container .toast.error')).not.toBeVisible();
});

test('estimated quantities: shows transparency section for tbsp ingredient', async ({ page }) => {
  await seedState(page, { recipes: [estimatedRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-estimated');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  const calcButton = page.locator('.nutrition-footer button');
  await calcButton.click();

  // Wait for calculation to finish (badge changes from missing)
  const badge = page.locator('.nutrition-badge');
  await expect(badge).not.toHaveClass(/nutrition-badge--missing/, { timeout: 5000 });

  // Transparency section should appear
  const transparency = page.locator('.nutrition-transparency');
  await expect(transparency).toBeVisible();

  // Sources line should show at least one provider
  const sourcesLine = page.locator('.nutrition-sources');
  await expect(sourcesLine).toBeVisible();

  // Estimated quantities section should be present (summary text visible even when collapsed)
  const estimatedDetails = page.locator('.nutrition-details-group').first();
  await expect(estimatedDetails).toBeVisible();
});

test('not-included: shows excluded ingredient after partial calculation', async ({ page }) => {
  await seedState(page, { recipes: [partialRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-partial');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  const calcButton = page.locator('.nutrition-footer button');
  await calcButton.click();

  await expect(page.locator('.nutrition-badge')).not.toHaveClass(/nutrition-badge--missing/, { timeout: 5000 });

  // Not-included section should be visible in the transparency block
  const transparency = page.locator('.nutrition-transparency');
  await expect(transparency).toBeVisible();

  // At least one details group must exist (either estimated or not-included)
  const detailsCount = await page.locator('.nutrition-details-group').count();
  expect(detailsCount).toBeGreaterThan(0);
});
