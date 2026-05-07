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

const FILLED_TUESDAY_PLANNER = {
  ...EMPTY_PLANNER,
  tuesday: { breakfast: SEED_RECIPE.id, lunch: null, dinner: null },
};

async function seedFilledPlanner(page: Page): Promise<void> {
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
      lang: 'en',
      plannerKey: WEEKLY_PLANNER_KEY,
      planner: FILLED_TUESDAY_PLANNER,
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

interface RectPair {
  title: { x: number; y: number; width: number; height: number };
  actions: { x: number; y: number; width: number; height: number };
}

async function readTuesdayHeadRects(page: Page): Promise<RectPair> {
  return page.evaluate(() => {
    const tuesday = document.querySelectorAll<HTMLElement>('.planner-day-card')[1];
    if (!tuesday) throw new Error('Tuesday card not found');
    const titleRow = tuesday.querySelector<HTMLElement>('.planner-day-title-row');
    const actions = tuesday.querySelector<HTMLElement>('.planner-day-actions');
    if (!titleRow) throw new Error('.planner-day-title-row not found on Tuesday card');
    if (!actions) throw new Error('.planner-day-actions not found on Tuesday card');
    const t = titleRow.getBoundingClientRect();
    const a = actions.getBoundingClientRect();
    return {
      title: { x: t.x, y: t.y, width: t.width, height: t.height },
      actions: { x: a.x, y: a.y, width: a.width, height: a.height },
    };
  });
}

for (const viewport of [
  { width: 768, height: 1024, label: 'tablet 768' },
  { width: 1024, height: 768, label: 'desktop 1024' },
  { width: 1280, height: 800, label: 'wide 1280' },
] as const) {
  test(`day-card title row does not overlap action buttons at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedFilledPlanner(page);

    await expect(page.locator('.planner-day-card').nth(1).locator('.planner-day-actions'))
      .toBeVisible();

    const { title, actions } = await readTuesdayHeadRects(page);

    const sameRowNoOverlap = title.x + title.width <= actions.x + 0.5;
    const stackedVertically = title.y + title.height <= actions.y + 0.5;

    expect(
      sameRowNoOverlap || stackedVertically,
      `Tuesday day-card head overlap at ${viewport.label}: ` +
        `title-row right=${(title.x + title.width).toFixed(2)}, ` +
        `actions left=${actions.x.toFixed(2)}, ` +
        `title-row bottom=${(title.y + title.height).toFixed(2)}, ` +
        `actions top=${actions.y.toFixed(2)}`,
    ).toBe(true);
  });
}
