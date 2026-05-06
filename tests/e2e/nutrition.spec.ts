import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const STORAGE_KEY = 'cucina_recipebook_v3';
const SHOPPING_LIST_KEY = 'cucina_shopping_list_v1';
const WEEKLY_PLANNER_KEY = 'cucina_weekly_planner_v1';
const GOALS_KEY = 'cucina_nutrition_goals_v1';

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
  goals?: Record<string, number>;
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

  await page.evaluate(({ recipes, shoppingList, planner, goals, storageKey, shoppingKey, plannerKey, goalsKey }) => {
    localStorage.clear();
    localStorage.setItem(storageKey, JSON.stringify(recipes || []));
    localStorage.setItem(shoppingKey, JSON.stringify(shoppingList || []));
    localStorage.setItem(plannerKey, JSON.stringify(planner));
    if (goals !== null) {
      localStorage.setItem(goalsKey, JSON.stringify(goals));
    }
  }, {
    recipes:     state.recipes || [],
    shoppingList: state.shoppingList || [],
    planner:     state.planner || EMPTY_PLANNER,
    goals:       state.goals ?? null,
    storageKey:  STORAGE_KEY,
    shoppingKey: SHOPPING_LIST_KEY,
    plannerKey:  WEEKLY_PLANNER_KEY,
    goalsKey:    GOALS_KEY,
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

  // Open details section (collapsed by default)
  const detailsToggle = page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)');
  await expect(detailsToggle).toBeVisible();
  await detailsToggle.click();

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

test('manual override: edit quantities updates kcal, sets manual badge, persists on reload', async ({ page }) => {
  // Seed a recipe that already has calculated nutrition so the editor button is immediately visible.
  // pasta: 350 kcal/100g, proteinG 13, carbsG 70, fatG 1.5 → at 200g: 700 kcal
  const preCalculatedRecipe = {
    id:              'nutrition-e2e-override',
    name:            'Override Test',
    source:          'manual',
    preparationType: 'classic',
    ingredients:     ['200 g pasta'],
    steps:           ['Cuoci'],
    servings:        '2',
    ingredientNutrition: [
      {
        ingredientName: '200 g pasta',
        grams: 200,
        gramsEstimated: false,
        source: { provider: 'openfoodfacts' },
        nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      },
    ],
    nutrition: {
      status: 'complete',
      perServing: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      perRecipe:  { kcal: 700, proteinG: 26, carbsG: 140, fatG: 3.0, fiberG: 5.4 },
      servingsUsed: 2,
      calculatedAt: new Date().toISOString(),
      ingredientsFingerprint: '200 g pasta',
    },
  };

  await seedState(page, { recipes: [preCalculatedRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-override');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Badge should show complete initially
  const badge = page.locator('.nutrition-badge');
  await expect(badge).toHaveClass(/nutrition-badge--complete/);

  // Open details section (collapsed by default) to reveal the edit button
  const detailsToggle = page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)');
  await expect(detailsToggle).toBeVisible();
  await detailsToggle.click();

  // "Edit quantities" button should be visible
  const editBtn = page.locator('.nutrition-details-edit button').filter({ hasText: /edit|quantit/i }).first();
  await expect(editBtn).toBeVisible();
  await editBtn.click();

  // Editor rows should appear
  const editorRow = page.locator('.nutrition-editor-row').first();
  await expect(editorRow).toBeVisible();

  // Change grams from 200 to 100
  const input = page.locator('.nutrition-editor-input').first();
  await input.fill('100');

  // Save
  const saveBtn = page.locator('.nutrition-editor-actions button').first();
  await saveBtn.click();

  // Editor should close
  await expect(page.locator('.nutrition-editor')).not.toBeVisible();

  // Badge should now be "manual"
  await expect(badge).toHaveClass(/nutrition-badge--manual/);

  // Kcal should be lower (100g → 350 kcal per recipe vs 700 kcal before)
  const kcalVal = page.locator('.nutrition-kcal-val');
  await page.waitForTimeout(800); // wait for count-up animation (700ms) to finish
  const kcalText = await kcalVal.textContent();
  const kcal = parseInt(kcalText ?? '0', 10);
  // At 100g pasta (350 kcal/100g), per serving of 2: 175 kcal each
  expect(kcal).toBeLessThan(400);
  expect(kcal).toBeGreaterThan(0);

  // Reload and verify persistence
  await gotoRoute(page, 'recipe-book/nutrition-e2e-override');
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--manual/);

  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const recipes = JSON.parse(raw);
    return recipes.find((r: { id: string }) => r.id === 'nutrition-e2e-override') ?? null;
  }, STORAGE_KEY);

  expect(stored?.nutrition?.status).toBe('manual');
  expect(stored?.ingredientNutrition?.[0]?.grams).toBe(100);
  expect(stored?.ingredientNutrition?.[0]?.gramsEstimated).toBe(false);
  expect(stored?.ingredientNutrition?.[0]?.source?.provider).toBe('manual');
});

test('not-included: shows excluded ingredient after partial calculation', async ({ page }) => {
  await seedState(page, { recipes: [partialRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-partial');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  const calcButton = page.locator('.nutrition-footer button');
  await calcButton.click();

  await expect(page.locator('.nutrition-badge')).not.toHaveClass(/nutrition-badge--missing/, { timeout: 5000 });

  // Open details section (collapsed by default)
  const detailsToggle = page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)');
  await expect(detailsToggle).toBeVisible();
  await detailsToggle.click();

  // Not-included section should be visible in the transparency block
  const transparency = page.locator('.nutrition-transparency');
  await expect(transparency).toBeVisible();

  // At least one details group must exist (either estimated or not-included)
  const detailsCount = await page.locator('.nutrition-details-group').count();
  expect(detailsCount).toBeGreaterThan(0);
});

// ─── per-100g override tests ──────────────────────────────────────────────────

// Recipe pre-seeded with pasta at 350kcal/100g (200g → 700kcal, 26g protein per recipe)
const per100gBaseRecipe = {
  id:              'nutrition-e2e-per100g',
  name:            'Per100g Test',
  source:          'manual',
  preparationType: 'classic',
  ingredients:     ['200 g pasta'],
  steps:           ['Cuoci'],
  servings:        '2',
  ingredientNutrition: [
    {
      ingredientName: '200 g pasta',
      grams: 200,
      gramsEstimated: false,
      source: { provider: 'openfoodfacts' },
      nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
    },
  ],
  nutrition: {
    status: 'complete',
    perServing: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
    perRecipe:  { kcal: 700, proteinG: 26, carbsG: 140, fatG: 3.0, fiberG: 5.4 },
    servingsUsed: 2,
    calculatedAt: new Date().toISOString(),
    ingredientsFingerprint: '200 g pasta',
  },
};

test('per-100g edit: protein change updates macro display and persists', async ({ page }) => {
  await seedState(page, { recipes: [per100gBaseRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-per100g');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Open details section (collapsed by default)
  await page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)').click();

  // Open the editor
  const editBtn = page.locator('.nutrition-details-edit button').filter({ hasText: /edit|quantit/i }).first();
  await expect(editBtn).toBeVisible();
  await editBtn.click();

  // Expand per-100g panel for pasta
  const expandBtn = page.locator('.nutrition-editor-expand-btn').first();
  await expect(expandBtn).toBeVisible();
  await expandBtn.click();

  // Per-100g fields should now be visible
  const per100gSection = page.locator('.nutrition-editor-per100g').first();
  await expect(per100gSection).toBeVisible();

  // Find the protein input (second field row: kcal, proteinG, carbsG, fatG, fiberG)
  // The per100g fields contain 5 inputs total; protein is the 2nd
  const per100gInputs = page.locator('.nutrition-editor-per100g .nutrition-editor-input');
  await expect(per100gInputs).toHaveCount(5);

  // Change proteinG from 13 to 26 (double)
  await per100gInputs.nth(1).fill('26');

  // Save
  await page.locator('.nutrition-editor-actions button').first().click();

  // Editor closed
  await expect(page.locator('.nutrition-editor')).not.toBeVisible();

  // Badge is manual
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--manual/);

  // Protein macro row should now reflect the doubled value
  const proteinRow = page.locator('.nutrition-macro-row--protein .nutrition-macro-val');
  await expect(proteinRow).toBeVisible();
  await page.waitForTimeout(800); // wait for count-up animation (700ms) to finish
  const proteinText = await proteinRow.textContent();
  const proteinVal = parseFloat(proteinText?.replace('g', '') ?? '0');
  // At 200g with 26g protein/100g → 52g protein per recipe, per serving = 26g
  expect(proteinVal).toBeGreaterThan(20);

  // Reload and verify persistence
  await gotoRoute(page, 'recipe-book/nutrition-e2e-per100g');
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--manual/);

  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const recipes = JSON.parse(raw);
    return recipes.find((r: { id: string }) => r.id === 'nutrition-e2e-per100g') ?? null;
  }, STORAGE_KEY);

  expect(stored?.nutrition?.status).toBe('manual');
  expect(stored?.ingredientNutrition?.[0]?.nutritionPer100g?.proteinG).toBe(26);
  expect(stored?.ingredientNutrition?.[0]?.source?.provider).toBe('manual');
});

test('per-100g edit: comma decimal accepted (10,5 → 10.5)', async ({ page }) => {
  await seedState(page, { recipes: [per100gBaseRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-per100g');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Open details section (collapsed by default)
  await page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)').click();

  const editBtn = page.locator('.nutrition-details-edit button').filter({ hasText: /edit|quantit/i }).first();
  await editBtn.click();

  const expandBtn = page.locator('.nutrition-editor-expand-btn').first();
  await expandBtn.click();

  // Change fatG (4th field, index 3) to "1,5" (comma decimal)
  const per100gInputs = page.locator('.nutrition-editor-per100g .nutrition-editor-input');
  await per100gInputs.nth(3).fill('1,5');

  await page.locator('.nutrition-editor-actions button').first().click();

  // Verify stored value is 1.5 (not NaN or 0)
  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const recipes = JSON.parse(raw);
    return recipes.find((r: { id: string }) => r.id === 'nutrition-e2e-per100g') ?? null;
  }, STORAGE_KEY);

  expect(stored?.ingredientNutrition?.[0]?.nutritionPer100g?.fatG).toBeCloseTo(1.5, 5);
});

test('per-100g edit: expand panel toggle works — expand then collapse', async ({ page }) => {
  await seedState(page, { recipes: [per100gBaseRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-per100g');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Open details section (collapsed by default)
  await page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)').click();

  const editBtn = page.locator('.nutrition-details-edit button').filter({ hasText: /edit|quantit/i }).first();
  await editBtn.click();

  const expandBtn = page.locator('.nutrition-editor-expand-btn').first();

  // Initially collapsed
  await expect(page.locator('.nutrition-editor-per100g')).not.toBeVisible();

  // Expand
  await expandBtn.click();
  await expect(page.locator('.nutrition-editor-per100g').first()).toBeVisible();

  // Collapse again
  await expandBtn.click();
  await expect(page.locator('.nutrition-editor-per100g')).not.toBeVisible();
});

// ─── transparency integration QA tests ───────────────────────────────────────

test('QA: missing grams → setting grams removes ingredient from not-included list', async ({ page }) => {
  // ingredientName must equal the raw ingredient string (parsed.original) for deriveExcludedIngredients to match
  const recipe = {
    id:              'nutrition-qa-missing-grams',
    name:            'QA Missing Grams',
    source:          'manual',
    preparationType: 'classic',
    ingredients:     ['sale q.b.', '200 g pasta'],
    steps:           ['Mescola'],
    servings:        '2',
    ingredientNutrition: [
      {
        ingredientName: 'sale q.b.',  // exact raw string match
        grams: undefined,
        gramsEstimated: undefined,
        source: { provider: 'manual' },
        nutritionPer100g: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
      },
      {
        ingredientName: '200 g pasta',
        grams: 200,
        gramsEstimated: false,
        source: { provider: 'openfoodfacts', confidence: 0.9 },
        nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      },
    ],
    nutrition: {
      status: 'partial',
      perServing: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      perRecipe:  { kcal: 700, proteinG: 26, carbsG: 140, fatG: 3.0, fiberG: 5.4 },
      servingsUsed: 2,
      calculatedAt: new Date().toISOString(),
      ingredientsFingerprint: 'sale q.b.|200 g pasta',
      sources: [{ provider: 'openfoodfacts', confidence: 0.9 }],
    },
  };

  await seedState(page, { recipes: [recipe] });
  await gotoRoute(page, 'recipe-book/nutrition-qa-missing-grams');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Badge is partial (salt excluded)
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--partial/);

  // Open details section (collapsed by default)
  await page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)').click();

  // Transparency section and "not included" details must be visible
  await expect(page.locator('.nutrition-transparency')).toBeVisible();
  const notIncludedDetails = page.locator('.nutrition-details-group').filter({ hasText: /non inclus|not includ/i });
  await expect(notIncludedDetails).toBeVisible();

  // Open editor
  const editBtn = page.locator('.nutrition-details-edit button').filter({ hasText: /edit|quantit|modific/i }).first();
  await editBtn.click();

  // Find the "sale q.b." row — it's the first (index 0 based on ingredient order)
  const gramsInputs = page.locator('.nutrition-editor-row .nutrition-editor-input');
  // sale q.b. row is index 0, pasta is index 1
  await gramsInputs.first().fill('5');

  // Save
  await page.locator('.nutrition-editor-actions button').first().click();
  await expect(page.locator('.nutrition-editor')).not.toBeVisible();

  // Badge flips to manual
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--manual/);

  // "Not included" section should be gone (sale is now counted — grams=5 + per100g defined)
  await expect(notIncludedDetails).not.toBeVisible();

  // Persisted correctly
  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).find((r: { id: string }) => r.id === 'nutrition-qa-missing-grams') ?? null;
  }, STORAGE_KEY);

  expect(stored?.ingredientNutrition?.[0]?.grams).toBe(5);
  expect(stored?.ingredientNutrition?.[0]?.gramsEstimated).toBe(false);
  expect(stored?.nutrition?.status).toBe('manual');
});

test('QA: missing nutrition → per-100g edit removes ingredient from not-included list', async ({ page }) => {
  const recipe = {
    id:              'nutrition-qa-missing-nutrition',
    name:            'QA Missing Nutrition',
    source:          'manual',
    preparationType: 'classic',
    ingredients:     ['ingrediente speciale 100g', '200 g pasta'],
    steps:           ['Mescola'],
    servings:        '2',
    ingredientNutrition: [
      {
        ingredientName: 'ingrediente speciale 100g',
        grams: 100,
        gramsEstimated: false,
        source: { provider: 'openfoodfacts', confidence: 0.5 },
        nutritionPer100g: undefined,  // matched but no nutrition data → missing_nutrition
      },
      {
        ingredientName: '200 g pasta',
        grams: 200,
        gramsEstimated: false,
        source: { provider: 'openfoodfacts', confidence: 0.9 },
        nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      },
    ],
    nutrition: {
      status: 'partial',
      perServing: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      perRecipe:  { kcal: 700, proteinG: 26, carbsG: 140, fatG: 3.0, fiberG: 5.4 },
      servingsUsed: 2,
      calculatedAt: new Date().toISOString(),
      ingredientsFingerprint: 'ingrediente speciale 100g|200 g pasta',
      sources: [{ provider: 'openfoodfacts', confidence: 0.9 }],
    },
  };

  await seedState(page, { recipes: [recipe] });
  await gotoRoute(page, 'recipe-book/nutrition-qa-missing-nutrition');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Open details section (collapsed by default)
  await page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)').click();

  // Confirm not-included section visible
  await expect(page.locator('.nutrition-transparency')).toBeVisible();
  const notIncludedDetails = page.locator('.nutrition-details-group').filter({ hasText: /non inclus|not includ/i });
  await expect(notIncludedDetails).toBeVisible();

  // Open editor
  const editBtn = page.locator('.nutrition-details-edit button').filter({ hasText: /edit|quantit|modific/i }).first();
  await editBtn.click();

  // Expand per-100g for the first ingredient ("ingrediente speciale 100g")
  const expandBtns = page.locator('.nutrition-editor-expand-btn');
  await expandBtns.first().click();
  await expect(page.locator('.nutrition-editor-per100g').first()).toBeVisible();

  // Fill in kcal=100, proteinG=5, carbsG=10, fatG=2, fiberG=1
  const per100gInputs = page.locator('.nutrition-editor-per100g').first().locator('.nutrition-editor-input');
  await per100gInputs.nth(0).fill('100');  // kcal
  await per100gInputs.nth(1).fill('5');    // proteinG
  await per100gInputs.nth(2).fill('10');   // carbsG
  await per100gInputs.nth(3).fill('2');    // fatG
  await per100gInputs.nth(4).fill('1');    // fiberG

  // Save
  await page.locator('.nutrition-editor-actions button').first().click();
  await expect(page.locator('.nutrition-editor')).not.toBeVisible();

  // Badge is now manual
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--manual/);

  // Not-included section should be gone (ingredient now has nutritionPer100g)
  await expect(notIncludedDetails).not.toBeVisible();

  // Kcal increased (ingrediente added 100 kcal/100g × 100g = 100 more kcal to recipe)
  await page.waitForTimeout(800); // wait for count-up animation (700ms) to finish
  const kcalText = await page.locator('.nutrition-kcal-val').textContent();
  const kcal = parseInt(kcalText ?? '0', 10);
  expect(kcal).toBeGreaterThan(350); // was 350 per serving (pasta only), now includes speciale

  // Persisted
  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).find((r: { id: string }) => r.id === 'nutrition-qa-missing-nutrition') ?? null;
  }, STORAGE_KEY);

  expect(stored?.ingredientNutrition?.[0]?.nutritionPer100g?.kcal).toBe(100);
  expect(stored?.ingredientNutrition?.[0]?.nutritionPer100g?.proteinG).toBe(5);
  expect(stored?.ingredientNutrition?.[0]?.source?.provider).toBe('manual');
  expect(stored?.nutrition?.status).toBe('manual');
});

test('QA: estimated grams → manual grams removes ingredient from estimated section', async ({ page }) => {
  const recipe = {
    id:              'nutrition-qa-estimated',
    name:            'QA Estimated Grams',
    source:          'manual',
    preparationType: 'classic',
    ingredients:     ['1 cucchiaio olio', '200 g pasta'],
    steps:           ['Cuoci', 'Condisci'],
    servings:        '2',
    ingredientNutrition: [
      {
        ingredientName: '1 cucchiaio olio',
        grams: 10,
        gramsEstimated: true,  // estimated from unit conversion
        source: { provider: 'openfoodfacts', confidence: 0.85 },
        nutritionPer100g: { kcal: 880, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0 },
      },
      {
        ingredientName: '200 g pasta',
        grams: 200,
        gramsEstimated: false,
        source: { provider: 'openfoodfacts', confidence: 0.9 },
        nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      },
    ],
    nutrition: {
      status: 'complete',
      perServing: { kcal: 394, proteinG: 13, carbsG: 70, fatG: 6.5, fiberG: 2.7 },
      perRecipe:  { kcal: 788, proteinG: 26, carbsG: 140, fatG: 13.0, fiberG: 5.4 },
      servingsUsed: 2,
      calculatedAt: new Date().toISOString(),
      ingredientsFingerprint: '1 cucchiaio olio|200 g pasta',
      sources: [{ provider: 'openfoodfacts', confidence: 0.9 }],
    },
  };

  await seedState(page, { recipes: [recipe] });
  await gotoRoute(page, 'recipe-book/nutrition-qa-estimated');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Open details section (collapsed by default)
  await page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)').click();

  // Estimated quantities section must be visible
  await expect(page.locator('.nutrition-transparency')).toBeVisible();
  const estimatedDetails = page.locator('.nutrition-details-group').filter({ hasText: /stimate|estimated/i });
  await expect(estimatedDetails).toBeVisible();

  // Open editor
  const editBtn = page.locator('.nutrition-details-edit button').filter({ hasText: /edit|quantit|modific/i }).first();
  await editBtn.click();

  // Edit grams for "1 cucchiaio olio" (first row) from 10 to 12
  const gramsInputs = page.locator('.nutrition-editor-row .nutrition-editor-input');
  await gramsInputs.first().fill('12');

  // Save
  await page.locator('.nutrition-editor-actions button').first().click();
  await expect(page.locator('.nutrition-editor')).not.toBeVisible();

  // Badge is manual
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--manual/);

  // Estimated section should be gone (gramsEstimated is now false for olio)
  await expect(estimatedDetails).not.toBeVisible();

  // Persisted: gramsEstimated=false
  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).find((r: { id: string }) => r.id === 'nutrition-qa-estimated') ?? null;
  }, STORAGE_KEY);

  expect(stored?.ingredientNutrition?.[0]?.grams).toBe(12);
  expect(stored?.ingredientNutrition?.[0]?.gramsEstimated).toBe(false);
  expect(stored?.nutrition?.status).toBe('manual');
});

// ─── Olio grams regression test (visible kcal change) ────────────────────────

test('olio grams: doubling grams from 10 to 20 visibly increases kcal', async ({ page }) => {
  // olio: 880 kcal/100g. At 10g → 88 kcal; at 20g → 176 kcal.
  // With 200g pasta (350 kcal/100g = 700 kcal) and 2 servings:
  //   before: perRecipe=788, perServing=394
  //   after:  perRecipe=876, perServing=438
  const recipe = {
    id:              'nutrition-e2e-olio-grams',
    name:            'Olio Grams Test',
    source:          'manual',
    preparationType: 'classic',
    ingredients:     ['1 cucchiaio olio', '200 g pasta'],
    steps:           ['Cuoci', 'Condisci'],
    servings:        '2',
    ingredientNutrition: [
      {
        ingredientName: '1 cucchiaio olio',
        grams: 10,
        gramsEstimated: true,
        source: { provider: 'openfoodfacts', confidence: 0.85 },
        nutritionPer100g: { kcal: 880, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0 },
      },
      {
        ingredientName: '200 g pasta',
        grams: 200,
        gramsEstimated: false,
        source: { provider: 'openfoodfacts', confidence: 0.95 },
        nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      },
    ],
    nutrition: {
      status: 'complete',
      perServing: { kcal: 394, proteinG: 13, carbsG: 70, fatG: 11.5, fiberG: 2.7 },
      perRecipe:  { kcal: 788, proteinG: 26, carbsG: 140, fatG: 23.0, fiberG: 5.4 },
      servingsUsed: 2,
      calculatedAt: new Date().toISOString(),
      ingredientsFingerprint: '1 cucchiaio olio|200 g pasta',
      sources: [{ provider: 'openfoodfacts', confidence: 0.9 }],
    },
  };

  await seedState(page, { recipes: [recipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-olio-grams');
  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Record initial kcal (perServing ≈ 394)
  const kcalLocator = page.locator('.nutrition-kcal-val');
  const kcalBefore = parseInt((await kcalLocator.textContent()) ?? '0', 10);
  expect(kcalBefore).toBeGreaterThan(300);

  // Open details section (collapsed by default)
  await page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)').click();

  // Open editor
  const editBtn = page.locator('.nutrition-details-edit button').filter({ hasText: /edit|quantit|modific/i }).first();
  await editBtn.click();
  await expect(page.locator('.nutrition-editor')).toBeVisible();

  // olio is the first row — change from 10 to 20
  const gramsInputs = page.locator('.nutrition-editor-row .nutrition-editor-input');
  await gramsInputs.first().fill('20');

  // Save
  await page.locator('.nutrition-editor-actions button').first().click();
  await expect(page.locator('.nutrition-editor')).not.toBeVisible();

  // Badge is manual
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--manual/);

  // Kcal must have increased (≈438 per serving now vs ≈394 before)
  await page.waitForTimeout(800); // wait for count-up animation (700ms) to finish
  const kcalAfter = parseInt((await kcalLocator.textContent()) ?? '0', 10);
  expect(kcalAfter).toBeGreaterThan(kcalBefore);
  expect(kcalAfter).toBeGreaterThan(400);

  // Persisted correctly
  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).find((r: { id: string }) => r.id === 'nutrition-e2e-olio-grams') ?? null;
  }, STORAGE_KEY);

  expect(stored?.ingredientNutrition?.[0]?.grams).toBe(20);
  expect(stored?.ingredientNutrition?.[0]?.gramsEstimated).toBe(false);
  expect(stored?.ingredientNutrition?.[0]?.source?.provider).toBe('manual');
  expect(stored?.ingredientNutrition?.[0]?.source?.userEdited).toBe(true);
  expect(stored?.nutrition?.status).toBe('manual');
});

// ─── Recalculate preserves user-edited entries ────────────────────────────────

test('Recalculate preserves ingredients with source.userEdited=true', async ({ page }) => {
  // olio is user-edited (20g, userEdited:true); pasta is not.
  // After Recalculate:
  //   - olio must remain at 20g with userEdited=true (not re-fetched)
  //   - pasta may be re-fetched from the provider (expected same data)
  //   - kcal should reflect the 20g olio, not the estimated 10g
  const recipe = {
    id:              'nutrition-e2e-recalc-preserve',
    name:            'Recalc Preserve Test',
    source:          'manual',
    preparationType: 'classic',
    ingredients:     ['1 cucchiaio olio', '200 g pasta'],
    steps:           ['Cuoci'],
    servings:        '2',
    ingredientNutrition: [
      {
        ingredientName: '1 cucchiaio olio',
        grams: 20,  // user set to 20g (default estimation would be 10g)
        gramsEstimated: false,
        source: { provider: 'manual', userEdited: true },
        nutritionPer100g: { kcal: 880, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0 },
      },
      {
        ingredientName: '200 g pasta',
        grams: 200,
        gramsEstimated: false,
        source: { provider: 'openfoodfacts', confidence: 0.95 },
        nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      },
    ],
    nutrition: {
      status: 'manual',
      perServing: { kcal: 438, proteinG: 13, carbsG: 70, fatG: 11.5, fiberG: 2.7 },
      perRecipe:  { kcal: 876, proteinG: 26, carbsG: 140, fatG: 23.0, fiberG: 5.4 },
      servingsUsed: 2,
      calculatedAt: new Date().toISOString(),
      ingredientsFingerprint: '1 cucchiaio olio|200 g pasta',
      sources: [{ provider: 'manual', userEdited: true }],
    },
  };

  await seedState(page, { recipes: [recipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-recalc-preserve');
  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Badge shows manual (because olio was user-edited)
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--manual/);

  // Record kcal before Recalculate
  const kcalLocator = page.locator('.nutrition-kcal-val');
  const kcalBefore = parseInt((await kcalLocator.textContent()) ?? '0', 10);
  expect(kcalBefore).toBeGreaterThan(400);  // reflects 20g olio

  // Click Calculate (always the btn-secondary in the nutrition footer)
  const calcBtn = page.locator('.nutrition-footer .btn-secondary');
  await calcBtn.click();

  // Wait for calculation to finish (badge changes from missing/manual to something)
  await expect(page.locator('.nutrition-badge')).not.toHaveClass(/nutrition-badge--missing/, { timeout: 8000 });

  // olio should still contribute its 20g (not reverted to estimated 10g)
  // So kcal should be ≥ the 20g value (~438 per serving), not the 10g value (~394)
  await page.waitForTimeout(800); // wait for count-up animation (700ms) to finish
  const kcalAfter = parseInt((await kcalLocator.textContent()) ?? '0', 10);
  expect(kcalAfter).toBeGreaterThan(400);

  // Verify in storage
  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).find((r: { id: string }) => r.id === 'nutrition-e2e-recalc-preserve') ?? null;
  }, STORAGE_KEY);

  const olioEntry = stored?.ingredientNutrition?.find(
    (e: { ingredientName: string }) => e.ingredientName === '1 cucchiaio olio',
  );
  expect(olioEntry?.grams).toBe(20);
  expect(olioEntry?.source?.userEdited).toBe(true);
});

// ─── Base ingredients provider — porridge recipe ──────────────────────────────

const porridgeRecipe = {
  id:              'nutrition-e2e-porridge',
  name:            'Porridge con Banana',
  source:          'manual',
  preparationType: 'classic',
  ingredients: [
    "60g fiocchi d'avena",
    '250ml latte parzialmente scremato',
    '100ml acqua',
    '1 banana media',
    '1 pizzico sale',
    '1 cucchiaino cannella',
    'miele (5g, opzionale)',
  ],
  steps:    ['Cuoci i fiocchi con latte e acqua', 'Aggiungi banana, miele e cannella'],
  servings: '1',
};

test('base_ingredients: porridge recipe calculates kcal from oats, milk, and cinnamon', async ({ page }) => {
  await seedState(page, { recipes: [porridgeRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-porridge');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Before calculation the badge is missing
  const badge = page.locator('.nutrition-badge');
  await expect(badge).toHaveClass(/nutrition-badge--missing/);

  // Click Calculate
  const calcBtn = page.locator('.nutrition-footer .btn-secondary');
  await expect(calcBtn).toBeVisible();
  await calcBtn.click();

  // kcal should appear (oats 60g + milk 250ml contribute ~350 kcal)
  const kcalVal = page.locator('.nutrition-kcal-val');
  await expect(kcalVal).not.toHaveText('—', { timeout: 8000 });
  await page.waitForTimeout(800); // wait for count-up animation (700ms) to finish
  const kcalText = await kcalVal.textContent();
  const kcal = parseInt(kcalText ?? '0', 10);
  expect(kcal).toBeGreaterThan(100);

  // Badge should no longer be missing
  await expect(badge).not.toHaveClass(/nutrition-badge--missing/);

  // Open details section (collapsed by default) to see sources
  const detailsToggle = page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)');
  await expect(detailsToggle).toBeVisible();
  await detailsToggle.click();

  // Sources line must include "Base ingredients"
  const sourcesLine = page.locator('.nutrition-sources');
  await expect(sourcesLine).toBeVisible();
  await expect(sourcesLine).toContainText('Base ingredients');

  // Verify via localStorage that oats and milk were NOT excluded (no_match)
  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).find((r: { id: string }) => r.id === 'nutrition-e2e-porridge') ?? null;
  }, STORAGE_KEY);

  expect(stored).not.toBeNull();
  expect(stored.nutrition?.status).toMatch(/^(partial|complete)$/);

  const ingNutrition: { ingredientName: string; source?: { provider: string }; grams?: number }[] =
    stored.ingredientNutrition ?? [];

  // Oats must be matched by base_ingredients with grams=60
  const avena = ingNutrition.find(n => n.ingredientName.includes('avena'));
  expect(avena).toBeDefined();
  expect(avena?.source?.provider).toBe('base_ingredients');
  expect(avena?.grams).toBe(60);

  // Milk must be matched with density-derived grams ≈ 257–258g
  const latte = ingNutrition.find(n => n.ingredientName.includes('latte'));
  expect(latte).toBeDefined();
  expect(latte?.grams).toBeGreaterThan(250);

  // Cannella must be matched (1 tsp → 5g via unit conversion)
  const cinn = ingNutrition.find(n => n.ingredientName.includes('cannella'));
  expect(cinn).toBeDefined();
  expect(cinn?.source?.provider).toBe('base_ingredients');
});

test('base_ingredients: porridge kcal and nutrition persist after reload', async ({ page }) => {
  await seedState(page, { recipes: [porridgeRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-porridge');

  await expect(page.locator('#saved-detail-view')).toBeVisible();

  // Calculate
  await page.locator('.nutrition-footer .btn-secondary').click();
  await expect(page.locator('.nutrition-kcal-val')).not.toHaveText('—', { timeout: 8000 });

  // Reload
  await gotoRoute(page, 'recipe-book/nutrition-e2e-porridge');

  // Should still show kcal without recalculating
  await expect(page.locator('.nutrition-kcal-val')).not.toHaveText('—');
  await expect(page.locator('.nutrition-badge')).not.toHaveClass(/nutrition-badge--missing/);
});

// ─── no_match excluded ingredient: editor coverage ───────────────────────────

// ─── Nutrition Goals feature ──────────────────────────────────────────────────

// Recipe pre-seeded with known perServing values so goal bars render immediately.
const goalsTestRecipe = {
  id:              'nutrition-e2e-goals',
  name:            'Goals Test Recipe',
  source:          'manual',
  preparationType: 'classic',
  ingredients:     ['200 g pasta'],
  steps:           ['Cuoci'],
  servings:        '2',
  ingredientNutrition: [
    {
      ingredientName: '200 g pasta',
      grams: 200,
      gramsEstimated: false,
      source: { provider: 'openfoodfacts' },
      nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
    },
  ],
  nutrition: {
    status: 'complete',
    perServing: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
    perRecipe:  { kcal: 700, proteinG: 26, carbsG: 140, fatG: 3.0, fiberG: 5.4 },
    servingsUsed: 2,
    calculatedAt: new Date().toISOString(),
    ingredientsFingerprint: '200 g pasta',
  },
};

test('goals: no goal bars visible when no goals are set', async ({ page }) => {
  await seedState(page, { recipes: [goalsTestRecipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-goals');
  await expect(page.locator('#saved-detail-view')).toBeVisible();
  await expect(page.locator('.nutrition-goal-bar')).toHaveCount(0);
});

test('goals: 5 bars with percentages when all 5 goals set', async ({ page }) => {
  await seedState(page, { recipes: [goalsTestRecipe], goals: { kcal: 2000, proteinG: 75, carbsG: 250, fatG: 65, fiberG: 30 } });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-goals');
  await expect(page.locator('#saved-detail-view')).toBeVisible();

  const bars = page.locator('.nutrition-goal-bar');
  await expect(bars).toHaveCount(5);

  const pct = page.locator('.nutrition-goal-pct').first();
  await expect(pct).toBeVisible();
  const pctText = await pct.textContent();
  const pctVal = parseInt(pctText ?? '0', 10);
  expect(pctVal).toBeGreaterThan(0);
  expect(pctVal).toBeLessThanOrEqual(100);
});

test('goals: over-goal bar gets --over modifier and percentage > 100', async ({ page }) => {
  // kcal goal = 100, perServing.kcal = 350 → 350%
  await seedState(page, { recipes: [goalsTestRecipe], goals: { kcal: 100 } });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-goals');
  await expect(page.locator('#saved-detail-view')).toBeVisible();

  const overBar = page.locator('.nutrition-goal-bar--over');
  await expect(overBar).toBeVisible();

  const pct = page.locator('.nutrition-goal-pct').first();
  await expect(pct).toBeVisible();
  const pctText = await pct.textContent();
  const pctVal = parseInt(pctText ?? '0', 10);
  expect(pctVal).toBeGreaterThan(100);
});

test('goals: bars persist after page reload', async ({ page }) => {
  await seedState(page, { recipes: [goalsTestRecipe], goals: { kcal: 2000, proteinG: 75, carbsG: 250 } });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-goals');
  await expect(page.locator('#saved-detail-view')).toBeVisible();
  await expect(page.locator('.nutrition-goal-bar')).toHaveCount(3);

  // Full reload — goals must be re-read from localStorage
  await gotoRoute(page, 'recipe-book/nutrition-e2e-goals');
  await expect(page.locator('#saved-detail-view')).toBeVisible();
  await expect(page.locator('.nutrition-goal-bar')).toHaveCount(3);
});

test('goals: omitting one goal renders 4 bars', async ({ page }) => {
  // fiberG omitted → only 4 goal bars
  await seedState(page, { recipes: [goalsTestRecipe], goals: { kcal: 2000, proteinG: 75, carbsG: 250, fatG: 65 } });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-goals');
  await expect(page.locator('#saved-detail-view')).toBeVisible();
  await expect(page.locator('.nutrition-goal-bar')).toHaveCount(4);
});

// ─── no_match excluded ingredient: editor coverage ───────────────────────────

test('no_match: excluded ingredient appears in editor and can be completed manually', async ({ page }) => {
  // Recipe with one recognised ingredient and one fully unmatched one (no entry in ingredientNutrition).
  // "ingrediente sconosciuto 50g" has no match → excluded with reason no_match.
  const recipe = {
    id:              'nutrition-e2e-no-match',
    name:            'No Match Test',
    source:          'manual',
    preparationType: 'classic',
    ingredients:     ['200 g pasta', 'ingrediente sconosciuto 50g'],
    steps:           ['Cuoci'],
    servings:        '2',
    ingredientNutrition: [
      {
        ingredientName: '200 g pasta',
        grams: 200,
        gramsEstimated: false,
        source: { provider: 'openfoodfacts', confidence: 0.95 },
        nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      },
      // No entry for 'ingrediente sconosciuto 50g' → it will be listed as no_match
    ],
    nutrition: {
      status: 'partial',
      perServing: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
      perRecipe:  { kcal: 700, proteinG: 26, carbsG: 140, fatG: 3.0, fiberG: 5.4 },
      servingsUsed: 2,
      calculatedAt: new Date().toISOString(),
      ingredientsFingerprint: '200 g pasta|ingrediente sconosciuto 50g',
    },
  };

  await seedState(page, { recipes: [recipe] });
  await gotoRoute(page, 'recipe-book/nutrition-e2e-no-match');

  await expect(page.locator('#saved-detail-view')).toBeVisible();
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--partial/);

  // Open details section (collapsed by default)
  await page.locator('.nutrition-details-toggle:not(.nutrition-goals-toggle)').click();

  // Open the editor — button must be visible (recipe.nutrition exists and ingredients.length > 0)
  const editBtn = page.locator('.nutrition-details-edit button').filter({ hasText: /edit|quantit|modific/i }).first();
  await expect(editBtn).toBeVisible();
  await editBtn.click();

  // Editor must show TWO rows: one per recipe.ingredients entry (source of truth)
  const editorIngredients = page.locator('.nutrition-editor-ingredient');
  await expect(editorIngredients).toHaveCount(2);

  // The unmatched ingredient row must be present with its name
  const unmatchedRow = editorIngredients.filter({ hasText: /ingrediente sconosciuto/i });
  await expect(unmatchedRow).toBeVisible();

  // Fill grams for the unmatched ingredient (second row, index 1)
  const gramsInputs = page.locator('.nutrition-editor-row .nutrition-editor-input');
  await gramsInputs.nth(1).fill('50');

  // Expand per-100g for that row and fill kcal + other fields
  const expandBtns = page.locator('.nutrition-editor-expand-btn');
  await expandBtns.nth(1).click();
  const per100gSection = page.locator('.nutrition-editor-ingredient').nth(1).locator('.nutrition-editor-per100g');
  await expect(per100gSection).toBeVisible();
  const per100gInputs = per100gSection.locator('.nutrition-editor-input');
  await per100gInputs.nth(0).fill('200');  // kcal
  await per100gInputs.nth(1).fill('10');   // proteinG
  await per100gInputs.nth(2).fill('30');   // carbsG
  await per100gInputs.nth(3).fill('5');    // fatG
  await per100gInputs.nth(4).fill('2');    // fiberG

  // Save
  await page.locator('.nutrition-editor-actions button').first().click();
  await expect(page.locator('.nutrition-editor')).not.toBeVisible();

  // Badge flips to manual
  await expect(page.locator('.nutrition-badge')).toHaveClass(/nutrition-badge--manual/);

  // Not-included section should be gone (both ingredients now have grams + per100g)
  const notIncludedDetails = page.locator('.nutrition-details-group').filter({ hasText: /non inclus|not includ/i });
  await expect(notIncludedDetails).not.toBeVisible();

  // Kcal increased beyond pasta-only value (700 kcal) by adding the new ingredient
  await page.waitForTimeout(800); // wait for count-up animation (700ms) to finish
  const kcalText = await page.locator('.nutrition-kcal-val').textContent();
  const kcal = parseInt(kcalText ?? '0', 10);
  // 200g pasta = 700 kcal + 50g @ 200kcal/100g = 100 kcal → total 800; perServing ≈ 400
  expect(kcal).toBeGreaterThan(350);

  // Persisted: new entry must be in ingredientNutrition
  const stored = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).find((r: { id: string }) => r.id === 'nutrition-e2e-no-match') ?? null;
  }, STORAGE_KEY);

  const newEntry = stored?.ingredientNutrition?.find(
    (e: { ingredientName: string }) => e.ingredientName === 'ingrediente sconosciuto 50g',
  );
  expect(newEntry).toBeDefined();
  expect(newEntry?.grams).toBe(50);
  expect(newEntry?.gramsEstimated).toBe(false);
  expect(newEntry?.source?.provider).toBe('manual');
  expect(newEntry?.nutritionPer100g?.kcal).toBe(200);
  expect(stored?.nutrition?.status).toBe('manual');
});
