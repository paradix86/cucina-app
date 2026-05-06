import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const STORAGE_KEY = 'cucina_recipebook_v3';
const SHOPPING_LIST_KEY = 'cucina_shopping_list_v1';
const WEEKLY_PLANNER_KEY = 'cucina_weekly_planner_v1';

const EMPTY_PLANNER = {
  monday: { breakfast: null, lunch: null, dinner: null },
  tuesday: { breakfast: null, lunch: null, dinner: null },
  wednesday: { breakfast: null, lunch: null, dinner: null },
  thursday: { breakfast: null, lunch: null, dinner: null },
  friday: { breakfast: null, lunch: null, dinner: null },
  saturday: { breakfast: null, lunch: null, dinner: null },
  sunday: { breakfast: null, lunch: null, dinner: null },
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
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
}

test('triple-slotted recipe produces one item per ingredient with tripled quantity', async ({
  page,
}) => {
  await seedState(page, {
    recipes: [
      {
        id: 'triple-recipe',
        name: 'Triple Test',
        source: 'manual',
        preparationType: 'classic',
        ingredients: ['2 eggs', '100 g flour'],
        steps: ['Cook.'],
      },
    ],
    planner: {
      ...EMPTY_PLANNER,
      monday: { breakfast: 'triple-recipe', lunch: 'triple-recipe', dinner: 'triple-recipe' },
    },
  });
  await gotoRoute(page, 'planner');
  const mondayBtn = page.locator('.planner-day-card').first().locator('.planner-day-shopping');
  await expect(mondayBtn).toBeVisible();
  await mondayBtn.click();
  await gotoRoute(page, 'shopping-list');
  const list = page.locator('#shopping-list');
  const eggRow = list.locator('.shopping-grouped-item').filter({ hasText: /egg/i });
  const flourRow = list.locator('.shopping-grouped-item').filter({ hasText: /flour/i });
  await expect(eggRow).toHaveCount(1);
  await expect(flourRow).toHaveCount(1);
  await expect(eggRow.locator('.shopping-item-total-qty')).toContainText('6');
  await expect(flourRow.locator('.shopping-item-total-qty')).toContainText('300');
});

test('day shopping button toggles Add↔Remove and removing clears list items', async ({ page }) => {
  await seedState(page, {
    recipes: [
      {
        id: 'toggle-recipe',
        name: 'Toggle Test',
        source: 'manual',
        preparationType: 'classic',
        ingredients: ['2 eggs'],
        steps: ['Cook.'],
      },
    ],
    planner: {
      ...EMPTY_PLANNER,
      monday: { breakfast: 'toggle-recipe', lunch: null, dinner: null },
    },
  });
  await gotoRoute(page, 'planner');
  const mondayBtn = page.locator('.planner-day-card').nth(0).locator('.planner-day-shopping');
  await expect(mondayBtn).toContainText('Add day');
  await mondayBtn.click();
  await expect(mondayBtn).toContainText('Remove day');
  await gotoRoute(page, 'shopping-list');
  await expect(page.locator('#shopping-list')).toContainText('egg');
  await gotoRoute(page, 'planner');
  await expect(mondayBtn).toContainText('Remove day');
  await mondayBtn.click();
  await expect(mondayBtn).toContainText('Add day');
  await gotoRoute(page, 'shopping-list');
  await expect(page.locator('#shopping-list')).not.toContainText('egg');
});

test('week shopping button adds all planned days then removes all on second click', async ({
  page,
}) => {
  await seedState(page, {
    recipes: [
      {
        id: 'week-a',
        name: 'Week Test A',
        source: 'manual',
        preparationType: 'classic',
        ingredients: ['3 mushrooms'],
        steps: ['Cook.'],
      },
      {
        id: 'week-b',
        name: 'Week Test B',
        source: 'manual',
        preparationType: 'classic',
        ingredients: ['4 potatoes'],
        steps: ['Cook.'],
      },
    ],
    planner: {
      ...EMPTY_PLANNER,
      monday: { breakfast: 'week-a', lunch: null, dinner: null },
      tuesday: { breakfast: 'week-b', lunch: null, dinner: null },
    },
  });
  await gotoRoute(page, 'planner');
  const weekBtn = page.locator('.planner-week-shopping');
  await expect(weekBtn).toContainText('Add week');
  await weekBtn.click();
  await gotoRoute(page, 'shopping-list');
  await expect(page.locator('#shopping-list')).toContainText('mushrooms');
  await expect(page.locator('#shopping-list')).toContainText('potatoes');
  await gotoRoute(page, 'planner');
  await expect(weekBtn).toContainText('Remove week');
  await weekBtn.click();
  await gotoRoute(page, 'shopping-list');
  await expect(page.locator('#shopping-list')).not.toContainText('mushrooms');
  await expect(page.locator('#shopping-list')).not.toContainText('potatoes');
});

test('RT-04 regression: same recipe in 5 planner slots produces 1 row per ingredient (no merge-artifact duplicates)', async ({ page }) => {
  await seedState(page, {
    recipes: [
      {
        id: 'rt04-gulash',
        name: 'Gulash ungherese',
        source: 'manual',
        preparationType: 'classic',
        ingredients: [
          'Aglio 1 spicchio',
          'Acqua q.b.',
          'Paprika dolce 3 cucchiai',
          'Semi di cumino ½ cucchiaio',
          'Cipolle 3',
          'Patate 2',
        ],
        steps: ['Cook.'],
      },
    ],
    planner: {
      ...EMPTY_PLANNER,
      monday: { breakfast: 'rt04-gulash', lunch: 'rt04-gulash', dinner: 'rt04-gulash' },
      tuesday: { breakfast: null, lunch: 'rt04-gulash', dinner: 'rt04-gulash' },
    },
  });
  await gotoRoute(page, 'planner');
  const weekBtn = page.locator('.planner-week-shopping');
  await expect(weekBtn).toContainText('Add week');
  await weekBtn.click();
  await expect(weekBtn).toContainText('Remove week');

  await gotoRoute(page, 'shopping-list');
  const allRows = page.locator('#shopping-list').locator('.shopping-grouped-item, .shopping-item');
  // Pre-fix this produced ~10 rows (Aglio/Acqua/Paprika/Semi each split into "× 2" + 1 separate).
  await expect(allRows).toHaveCount(6);

  const expectations: Array<[string, RegExp]> = [
    ['Aglio', /× ?5/],
    ['Acqua', /× ?5/],
    ['Paprika dolce', /× ?5|15 cucchiai/],
    ['Semi di cumino', /× ?5|2 ½ cucchiai/],
    ['Cipolle', /15/],
    ['Patate', /10/],
  ];
  for (const [label, qtyPattern] of expectations) {
    const row = allRows.filter({ hasText: label });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(qtyPattern);
  }
});

test('week button stays Add week when only some days are in the shopping list', async ({ page }) => {
  await seedState(page, {
    recipes: [
      {
        id: 'mixed-a',
        name: 'Mixed Test A',
        source: 'manual',
        preparationType: 'classic',
        ingredients: ['2 onions'],
        steps: ['Cook.'],
      },
      {
        id: 'mixed-b',
        name: 'Mixed Test B',
        source: 'manual',
        preparationType: 'classic',
        ingredients: ['3 carrots'],
        steps: ['Cook.'],
      },
    ],
    planner: {
      ...EMPTY_PLANNER,
      monday: { breakfast: 'mixed-a', lunch: null, dinner: null },
      tuesday: { breakfast: 'mixed-b', lunch: null, dinner: null },
    },
  });
  await gotoRoute(page, 'planner');
  const mondayCard = page.locator('.planner-day-card').nth(0);
  const tuesdayCard = page.locator('.planner-day-card').nth(1);
  const weekBtn = page.locator('.planner-week-shopping');
  await expect(mondayCard.locator('.planner-day-shopping')).toContainText('Add day');
  await mondayCard.locator('.planner-day-shopping').click();
  await expect(mondayCard.locator('.planner-day-shopping')).toContainText('Remove day');
  await expect(tuesdayCard.locator('.planner-day-shopping')).toContainText('Add day');
  await expect(weekBtn).toContainText('Add week');
});
