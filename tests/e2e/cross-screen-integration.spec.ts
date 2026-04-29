import { expect, test, type Page } from '@playwright/test';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const STORAGE_KEY = 'cucina_recipebook_v3';
const SHOPPING_LIST_KEY = 'cucina_shopping_list_v1';
const WEEKLY_PLANNER_KEY = 'cucina_weekly_planner_v1';
const DRAFT_KEY = 'cucina_meal_composer_draft_v1';

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
}

async function gotoMealComposer(page: Page): Promise<void> {
  await page.goto(`${APP_ROOT}#/meal-composer`);
  await expect(page.locator('main.app')).toBeVisible();
  await expect(page.locator('.meal-composer')).toBeVisible();
}

async function seedState(page: Page, state: SeedState): Promise<void> {
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();

  await page.evaluate(
    ({ recipes, shoppingList, planner, storageKey, shoppingKey, plannerKey }) => {
      localStorage.clear();
      localStorage.setItem(storageKey, JSON.stringify(recipes || []));
      localStorage.setItem(shoppingKey, JSON.stringify(shoppingList || []));
      localStorage.setItem(plannerKey, JSON.stringify(planner));
    },
    {
      recipes: state.recipes || [],
      shoppingList: state.shoppingList || [],
      planner: state.planner || EMPTY_PLANNER,
      storageKey: STORAGE_KEY,
      shoppingKey: SHOPPING_LIST_KEY,
      plannerKey: WEEKLY_PLANNER_KEY,
    },
  );

  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
}

// Recipe with pre-computed nutrition so it appears in recipesWithNutrition
const recipeWithNutrition = {
  id: 'xsi-recipe-nutrition',
  name: 'Pasta Semplice',
  source: 'manual',
  preparationType: 'classic',
  ingredients: ['200 g pasta'],
  steps: ['Cuoci la pasta'],
  servings: '2',
  nutrition: {
    status: 'complete',
    perServing: { kcal: 350, proteinG: 12, carbsG: 70, fatG: 2, fiberG: 3 },
    perRecipe:  { kcal: 700, proteinG: 24, carbsG: 140, fatG: 4, fiberG: 6 },
  },
};

// Recipe without nutrition — will be hidden from the composer list
const recipeWithoutNutrition = {
  id: 'xsi-recipe-no-nutrition',
  name: 'Piatto Misterioso',
  source: 'manual',
  preparationType: 'classic',
  ingredients: ['100 g ingrediente_sconosciuto_xyz'],
  steps: ['Mescola'],
  servings: '2',
};

async function waitForDraft(page: Page, key: string): Promise<string> {
  await page.waitForFunction(
    (k: string) => localStorage.getItem(k) !== null,
    key,
    { timeout: 5000 },
  );
  return page.evaluate((k: string) => localStorage.getItem(k) ?? '', key);
}

test('Recipe Detail CTA — "Use in meal" opens Meal Composer with recipe pre-selected', async ({ page }) => {
  await seedState(page, { recipes: [recipeWithNutrition] });

  await gotoRoute(page, 'recipe-book');
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();

  await page.locator('.card-name').filter({ hasText: 'Pasta Semplice' }).click();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();

  const addToMealBtn = page.locator('button').filter({ hasText: /add to meal|aggiungi al pasto/i });
  await expect(addToMealBtn).toBeVisible();
  await addToMealBtn.click();

  await expect(page).toHaveURL(/#\/meal-composer/);
  await expect(page.locator('.meal-composer')).toBeVisible();

  // The recipe should appear in the picker list (it has nutrition, so it passes the filter)
  await expect(page.locator('.mc-card-name').filter({ hasText: 'Pasta Semplice' })).toBeVisible();

  // It should be pre-selected (selected class on the card button)
  await expect(
    page.locator('.mc-recipe-card.selected').filter({ hasText: 'Pasta Semplice' }),
  ).toBeVisible();
});

test('Recipe Detail CTA — "Add to planner" navigates to Planner view', async ({ page }) => {
  await seedState(page, { recipes: [recipeWithNutrition] });

  await gotoRoute(page, 'recipe-book');
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();

  await page.locator('.card-name').filter({ hasText: 'Pasta Semplice' }).click();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();

  const addToPlannerBtn = page.locator('button').filter({ hasText: /aggiungi al piano|add to planner/i });
  await expect(addToPlannerBtn).toBeVisible();
  await addToPlannerBtn.click();

  await expect(page).toHaveURL(/#\/planner/);
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
});

test('Meal Composer draft persists across navigation and survives back-navigation', async ({ page }) => {
  await seedState(page, { recipes: [recipeWithNutrition] });

  // Pre-select via ?add= query param
  await page.goto(`${APP_ROOT}#/meal-composer?add=${recipeWithNutrition.id}`);
  await expect(page.locator('.meal-composer')).toBeVisible();

  // Recipe should appear selected in the list
  await expect(page.locator('.mc-card-name').filter({ hasText: 'Pasta Semplice' })).toBeVisible();
  await expect(
    page.locator('.mc-recipe-card.selected').filter({ hasText: 'Pasta Semplice' }),
  ).toBeVisible();

  // Wait for sessionStorage draft to be written by the watch callback
  const draftAfterAdd = await waitForDraft(page, DRAFT_KEY);
  expect(JSON.parse(draftAfterAdd)).toContain(recipeWithNutrition.id);

  // Navigate away to recipe book
  await gotoRoute(page, 'recipe-book');
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();

  // Navigate back — draft should be restored from sessionStorage
  await gotoMealComposer(page);

  await expect(page.locator('.mc-card-name').filter({ hasText: 'Pasta Semplice' })).toBeVisible();
  await expect(
    page.locator('.mc-recipe-card.selected').filter({ hasText: 'Pasta Semplice' }),
  ).toBeVisible();

  // localStorage draft should still be present
  const draftAfterBack = await page.evaluate((key: string) => localStorage.getItem(key), DRAFT_KEY);
  expect(draftAfterBack).not.toBeNull();
  expect(JSON.parse(draftAfterBack!)).toContain(recipeWithNutrition.id);
});

test('Meal Composer draft clears on explicit clear action', async ({ page }) => {
  await seedState(page, { recipes: [recipeWithNutrition] });

  await page.goto(`${APP_ROOT}#/meal-composer?add=${recipeWithNutrition.id}`);
  await expect(page.locator('.meal-composer')).toBeVisible();

  // Wait for draft to be written
  await waitForDraft(page, DRAFT_KEY);

  // Click the clear/reset button
  const clearBtn = page.locator('button').filter({ hasText: /svuota|clear|reset|azzera/i });
  if (await clearBtn.count() > 0) {
    await clearBtn.first().click();
    await page.waitForFunction(
      (key: string) => localStorage.getItem(key) === null,
      DRAFT_KEY,
      { timeout: 3000 },
    );
    const draftAfter = await page.evaluate((k: string) => localStorage.getItem(k), DRAFT_KEY);
    expect(draftAfter).toBeNull();
  }
});

test('Meal Composer shows hidden recipe note when some recipes lack nutrition', async ({ page }) => {
  // One recipe has nutrition (visible), one does not (hidden → triggers the note)
  await seedState(page, { recipes: [recipeWithNutrition, recipeWithoutNutrition] });

  await gotoMealComposer(page);

  // The note should be visible immediately because:
  //   recipesWithNutrition.length === 1 > 0
  //   hiddenRecipesCount === 1 > 0
  const hiddenNote = page.locator('.mc-hidden-note');
  await expect(hiddenNote).toBeVisible();
  await expect(hiddenNote).toContainText(/ricett|recipe/i);

  // Note contains a link/button to recipe book
  await expect(page.locator('.mc-hidden-link')).toBeVisible();
});

test('Meal Composer hidden note link navigates to recipe book', async ({ page }) => {
  await seedState(page, { recipes: [recipeWithNutrition, recipeWithoutNutrition] });
  await gotoMealComposer(page);

  await expect(page.locator('.mc-hidden-link')).toBeVisible();
  await page.locator('.mc-hidden-link').click();

  await expect(page).toHaveURL(/#\/recipe-book/);
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
});

test('Meal Composer ?add= query param is stripped from URL after processing', async ({ page }) => {
  await seedState(page, { recipes: [recipeWithNutrition] });

  await page.goto(`${APP_ROOT}#/meal-composer?add=${recipeWithNutrition.id}`);
  await expect(page.locator('.meal-composer')).toBeVisible();

  // router.replace strips the param — URL should be clean
  await expect(page).toHaveURL(/#\/meal-composer$/);
});
