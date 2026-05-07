import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const LANG_KEY = 'cucina_lang';
const WEEKLY_PLANNER_KEY = 'cucina_weekly_planner_v1';
const RECIPE_BOOK_KEY = 'cucina_recipebook_v3';

const EMPTY_PLANNER = {
  monday: { breakfast: null, lunch: null, dinner: null },
  tuesday: { breakfast: null, lunch: null, dinner: null },
  wednesday: { breakfast: null, lunch: null, dinner: null },
  thursday: { breakfast: null, lunch: null, dinner: null },
  friday: { breakfast: null, lunch: null, dinner: null },
  saturday: { breakfast: null, lunch: null, dinner: null },
  sunday: { breakfast: null, lunch: null, dinner: null },
};

const SEED_RECIPE = {
  id: 'r-1',
  name: 'Test Recipe',
  source: 'manual',
  preparationType: 'classic',
  ingredients: ['1 egg'],
  steps: ['Cook.'],
};

async function seedAndOpenPlanner(page: Page, lang: 'it' | 'en'): Promise<void> {
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await page.evaluate(
    ({ lang, plannerKey, planner, recipeKey, recipes, langKey }) => {
      localStorage.clear();
      localStorage.setItem(langKey, lang);
      localStorage.setItem(plannerKey, JSON.stringify(planner));
      localStorage.setItem(recipeKey, JSON.stringify(recipes));
    },
    {
      lang,
      plannerKey: WEEKLY_PLANNER_KEY,
      planner: EMPTY_PLANNER,
      recipeKey: RECIPE_BOOK_KEY,
      recipes: [SEED_RECIPE],
      langKey: LANG_KEY,
    },
  );
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await page.goto(`${APP_ROOT}#/planner`);
  await expect(page.locator('.planner-view')).toBeVisible();
}

test('weekly planner shows week range and per-day dates', async ({ page }) => {
  await seedAndOpenPlanner(page, 'en');

  const range = page.locator('.planner-week-range');
  await expect(range).toBeVisible();
  await expect(range).toContainText(/\b20\d{2}\b/);

  const dateLabels = page.locator('.planner-day-card .planner-day-date');
  await expect(dateLabels).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    await expect(dateLabels.nth(i)).toHaveText(/\d/);
  }

  await seedAndOpenPlanner(page, 'it');
  await expect(page.locator('.planner-week-range'))
    .toContainText(/gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic/i);
});
