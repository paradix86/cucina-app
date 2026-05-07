import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const RECIPE_BOOK_KEY = 'cucina_recipebook_v3';
const WEEKLY_PLANNER_KEY = 'cucina_weekly_planner_v1';
const LANG_KEY = 'cucina_lang';

const EMPTY_PLANNER = {
  monday: { breakfast: null, lunch: null, dinner: null },
  tuesday: { breakfast: null, lunch: null, dinner: null },
  wednesday: { breakfast: null, lunch: null, dinner: null },
  thursday: { breakfast: null, lunch: null, dinner: null },
  friday: { breakfast: null, lunch: null, dinner: null },
  saturday: { breakfast: null, lunch: null, dinner: null },
  sunday: { breakfast: null, lunch: null, dinner: null },
};

const RECIPE_PINNED = {
  id: 'pinned-recipe',
  name: 'Pinned Recipe Audit',
  source: 'manual',
  preparationType: 'classic',
  ingredients: ['1 egg'],
  steps: ['Cook.'],
};

const RECIPE_OTHER = {
  id: 'other-recipe',
  name: 'Aaa First Alphabetically',
  source: 'manual',
  preparationType: 'classic',
  ingredients: ['1 cup flour'],
  steps: ['Mix.'],
};

async function seedAndOpen(page: Page, recipes: unknown[], path: string): Promise<void> {
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await page.evaluate(
    ({ recipes, recipeKey, plannerKey, planner, langKey }) => {
      localStorage.clear();
      localStorage.setItem(langKey, 'en');
      localStorage.setItem(recipeKey, JSON.stringify(recipes));
      localStorage.setItem(plannerKey, JSON.stringify(planner));
    },
    {
      recipes,
      recipeKey: RECIPE_BOOK_KEY,
      plannerKey: WEEKLY_PLANNER_KEY,
      planner: EMPTY_PLANNER,
      langKey: LANG_KEY,
    },
  );
  // Reload root so Pinia hydrates from the seeded localStorage; then change the
  // hash to the route under test (this remounts the planner view with the param).
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
  await page.goto(`${APP_ROOT}${path}`);
  await expect(page.locator('.planner-view')).toBeVisible();
  await expect(page.locator('.planner-day-card')).toHaveCount(7);
}

test('addRecipeId pins the recipe at the top of the picker and the URL is cleaned', async ({ page }) => {
  await seedAndOpen(page, [RECIPE_OTHER, RECIPE_PINNED], `#/planner?addRecipeId=${RECIPE_PINNED.id}`);

  // The URL should no longer carry addRecipeId after onMounted ran.
  await expect.poll(() => page.url(), { timeout: 5000 }).not.toMatch(/addRecipeId/);

  // Open Monday breakfast — first day card, first slot.
  await page.locator('.planner-day-card').first().locator('.planner-slot-main').first().click();
  await expect(page.locator('.planner-picker-card')).toBeVisible();

  // The pinned recipe must be first AND have the pinned modifier class AND a pinned pill.
  const items = page.locator('.planner-picker-item');
  await expect(items.first()).toContainText(RECIPE_PINNED.name);
  await expect(items.first()).toHaveClass(/planner-picker-item--pinned/);
  await expect(items.first().locator('.planner-picker-pill--pinned')).toBeVisible();

  // Without the pin, RECIPE_OTHER would sort first alphabetically; confirm pin overrides sort.
  await expect(items.nth(1)).toContainText(RECIPE_OTHER.name);

  // Assign the pinned recipe to the slot.
  await items.first().click();
  await expect(page.locator('.planner-picker-card')).not.toBeVisible();

  // Re-open another slot — pendingRecipeId is cleared, no pinned item now.
  await page.locator('.planner-day-card').first().locator('.planner-slot-main').nth(1).click();
  await expect(page.locator('.planner-picker-card')).toBeVisible();
  await expect(page.locator('.planner-picker-item--pinned')).toHaveCount(0);
});

test('navigating away from planner drops the pending recipe (no zombie state)', async ({ page }) => {
  await seedAndOpen(page, [RECIPE_OTHER, RECIPE_PINNED], `#/planner?addRecipeId=${RECIPE_PINNED.id}`);

  // Confirm pendingRecipeId is set on the first mount (sanity).
  await expect.poll(() => page.url(), { timeout: 5000 }).not.toMatch(/addRecipeId/);

  // Navigate away (unmounts the planner) and back via the in-app nav buttons,
  // mirroring what a real user would do. page.goto with hash-only change does
  // not always force a full reload, so click the nav buttons directly.
  await page.getByRole('button', { name: 'Shopping List', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/shopping-list/);
  await page.getByRole('button', { name: 'Planner', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/planner(\?|$)/);
  await expect(page.locator('.planner-view')).toBeVisible();
  await expect(page.locator('.planner-day-card')).toHaveCount(7);

  // Open any slot — there must be no pinned item.
  await page.locator('.planner-day-card').first().locator('.planner-slot-main').first().click();
  await expect(page.locator('.planner-picker-card')).toBeVisible();
  await expect(page.locator('.planner-picker-item--pinned')).toHaveCount(0);
});

test('addRecipeId pointing at a missing recipe still cleans URL and shows no pin', async ({ page }) => {
  await seedAndOpen(page, [RECIPE_OTHER], `#/planner?addRecipeId=does-not-exist-xyz`);

  await expect.poll(() => page.url(), { timeout: 5000 }).not.toMatch(/addRecipeId/);

  await page.locator('.planner-day-card').first().locator('.planner-slot-main').first().click();
  await expect(page.locator('.planner-picker-card')).toBeVisible();
  await expect(page.locator('.planner-picker-item--pinned')).toHaveCount(0);
  // Existing recipe still rendered — picker functions normally.
  await expect(page.locator('.planner-picker-item').first()).toContainText(RECIPE_OTHER.name);
});
