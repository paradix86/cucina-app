import { expect, test, type Page } from '@playwright/test';

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
  // First navigation: reach the app origin so we can write localStorage.
  // Wait for the app to be visually stable so Dexie's async bootstrap
  // (open DB → read migration flag → write snapshot → set flag) has settled
  // before we overwrite localStorage.  Without this wait the bootstrap may
  // still hold an open read-write transaction when the second navigation fires.
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();

  await page.evaluate(({ recipes, shoppingList, planner, storageKey, shoppingKey, plannerKey }) => {
    localStorage.clear();
    localStorage.setItem(storageKey, JSON.stringify(recipes || []));
    localStorage.setItem(shoppingKey, JSON.stringify(shoppingList || []));
    localStorage.setItem(plannerKey, JSON.stringify(planner));
  }, {
    recipes: state.recipes || [],
    shoppingList: state.shoppingList || [],
    planner: state.planner || EMPTY_PLANNER,
    storageKey: STORAGE_KEY,
    shoppingKey: SHOPPING_LIST_KEY,
    plannerKey: WEEKLY_PLANNER_KEY,
  });

  // Second navigation: reload so the Pinia stores re-hydrate from the seed
  // localStorage we just wrote.  The Dexie bootstrap on this second load will
  // see migrationFlag=true, find an empty Dexie snapshot (bootstrapped from the
  // empty localStorage of the first load), and fall through to read the seed
  // data from localStorage — exactly the desired behaviour.
  //
  // We use page.goto instead of page.reload() to avoid a race that caused
  // intermittent ERR_ABORTED:  the old code called indexedDB.deleteDatabase
  // which was always BLOCKED (Dexie keeps its connection open), resolved via
  // onblocked without actually deleting, and then page.reload() fired while
  // Dexie's in-flight bootstrap transactions were still being torn down by the
  // browser — causing Playwright to lose track of the frame.
  //
  // The delete was never needed: every Playwright test starts in a fresh
  // BrowserContext (test-scoped `page` fixture) with empty IndexedDB.
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
}

async function createManualRecipe(page: Page, name: string): Promise<void> {
  await gotoRoute(page, 'import');
  await expect(page.locator('#import-link-card')).toBeVisible();
  await page.locator('#manual-open').click();
  await expect(page.locator('#manual-name')).toBeVisible();
  await page.locator('#manual-name').fill(name);
  await page.locator('.edit-ingredients .manual-list-item input').first().fill('2 eggs');
  await page.locator('.edit-steps .manual-list-item textarea').first().fill('Whisk and cook.');
  await page.locator('#manual-save').click();
  await gotoRoute(page, 'recipe-book');
  await expect(page.locator('.card-name').filter({ hasText: name })).toBeVisible();
}

async function assertMainContentStable(page: Page): Promise<void> {
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('main.app')).toBeVisible();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
}

test('backup import fully restores snapshot and removes post-export marker recipe', async ({ page }) => {
  await seedState(page, {
    recipes: [
      {
        id: 'seed-recipe',
        name: 'Seed Backup Recipe',
        source: 'manual',
        preparationType: 'classic',
        ingredients: [ '200 g pasta' ],
        steps: [ 'Cook pasta' ],
      },
    ],
  });
  await gotoRoute(page, 'recipe-book');
  await expect(page.locator('.backup-actions')).toBeVisible();

  const exportedSnapshot = await page.evaluate((storageKey: string) => {
    return localStorage.getItem(storageKey) || '[]';
  }, STORAGE_KEY);
  await page.locator('.backup-actions .btn-ghost').first().click();
  await expect(page.locator('#toast-container .toast').first()).toBeVisible();

  await createManualRecipe(page, 'Backup Marker Recipe');

  const backupInput = page.locator('.backup-actions input[type="file"]');
  await backupInput.setInputFiles({
    name: 'cucina-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exportedSnapshot, 'utf-8'),
  });

  await expect(page.locator('.confirm-overlay')).toBeVisible();
  await page.locator('.confirm-ok').click();

  // Backup import is async (FileReader + store refresh). Wait for local storage
  // snapshot replacement before reloading to avoid racing the import completion.
  await page.waitForFunction((storageKey: string) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed)
        && parsed.length === 1
        && parsed[0]?.name === 'Seed Backup Recipe';
    } catch {
      return false;
    }
  }, STORAGE_KEY);

  await page.reload();
  await gotoRoute(page, 'recipe-book');

  await expect(page.locator('.card-name').filter({ hasText: 'Seed Backup Recipe' })).toBeVisible();
  await expect(page.locator('.card-name').filter({ hasText: 'Backup Marker Recipe' })).toHaveCount(0);
});

test('route churn and repeated reload keep app content mounted (no header-only state)', async ({ page }) => {
  await seedState(page, {
    recipes: [
      {
        id: 'route-recipe',
        name: 'Route Stability Recipe',
        source: 'manual',
        preparationType: 'classic',
        ingredients: [ '1 tomato' ],
        steps: [ 'Slice tomato' ],
      },
    ],
    shoppingList: [
      { id: 'shop-1', text: '1 tomato', checked: false, createdAt: Date.now() },
    ],
    planner: {
      ...EMPTY_PLANNER,
      monday: { breakfast: 'route-recipe', lunch: null, dinner: null },
    },
  });

  const routes = ['recipe-book', 'planner', 'shopping-list'];
  for (let cycle = 0; cycle < 4; cycle += 1) {
    for (const route of routes) {
      await gotoRoute(page, route);
      await assertMainContentStable(page);
    }
    await page.reload();
    await assertMainContentStable(page);
  }
});

test('invalid/dead URL import shows clear error and does not remain loading', async ({ page }) => {
  await seedState(page, {});
  await gotoRoute(page, 'import');

  const deadUrl = 'https://www.giallozafferano.it/ricette/this-page-definitely-does-not-exist-qa-check.html';
  await page.locator('#import-link-card input[type="url"]').fill(deadUrl);
  await page.locator('#btn-import-go').click();

  await expect(page.locator('.status-msg.err')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.status-msg.err')).not.toHaveText('');
  await expect(page.locator('#btn-import-go')).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('.status-msg.loading')).toHaveCount(0);
});

test('planner to shopping list actions persist ingredients after reload', async ({ page }) => {
  await seedState(page, {
    recipes: [
      {
        id: 'planner-recipe-1',
        name: 'Planner Seed Recipe',
        source: 'manual',
        preparationType: 'classic',
        ingredients: [ '3 eggs', '200 g spinach' ],
        steps: [ 'Cook all ingredients' ],
      },
    ],
  });

  await gotoRoute(page, 'planner');
  await expect(page.locator('.planner-day-card').first()).toBeVisible();

  await page.locator('.planner-day-card').first().locator('.planner-slot-main').first().click();
  await expect(page.locator('.planner-picker-card')).toBeVisible();
  await page.locator('.planner-picker-item').first().click();
  await expect(page.locator('.planner-week-shopping')).toBeVisible();

  await page.locator('.planner-week-shopping').click();

  await gotoRoute(page, 'shopping-list');
  await expect(page.locator('#shopping-list')).toContainText('egg');
  await expect(page.locator('#shopping-list')).toContainText('spinach');

  await page.reload();
  await gotoRoute(page, 'shopping-list');
  await expect(page.locator('#shopping-list')).toContainText('egg');
  await expect(page.locator('#shopping-list')).toContainText('spinach');
});

test('planner recipe detail and cooking exit return to planner context', async ({ page }) => {
  await seedState(page, {
    recipes: [
      {
        id: 'planner-nav-recipe',
        name: 'Planner Navigation Recipe',
        source: 'manual',
        preparationType: 'classic',
        ingredients: [ '1 tomato' ],
        steps: [ 'Slice tomato', 'Serve tomato' ],
      },
    ],
    planner: {
      ...EMPTY_PLANNER,
      monday: { breakfast: 'planner-nav-recipe', lunch: null, dinner: null },
    },
  });

  await gotoRoute(page, 'planner');
  await page.locator('.planner-day-card').first().locator('.planner-slot-action').filter({ hasText: 'Open recipe' }).click();
  await expect(page).toHaveURL(/returnTo=planner/);
  await expect(page.locator('#saved-detail-view')).toContainText('Planner Navigation Recipe');

  await page.locator('.detail-back').click();
  await expect(page).toHaveURL(/#\/planner$/);
  await expect(page.locator('.planner-day-card').first()).toContainText('Planner Navigation Recipe');

  await page.locator('.planner-day-card').first().locator('.planner-slot-action').filter({ hasText: 'Open recipe' }).click();
  await expect(page.locator('#saved-detail-view')).toContainText('Planner Navigation Recipe');
  await page.locator('.detail-top-start').click();
  await expect(page.locator('.cooking-mode')).toContainText('Planner Navigation Recipe');
  await page.locator('.cooking-exit').click();
  await expect(page).toHaveURL(/#\/planner$/);
  await expect(page.locator('.planner-day-card').first()).toContainText('Planner Navigation Recipe');

  await page.locator('.planner-day-card').first().locator('.planner-slot-action').filter({ hasText: 'Open recipe' }).click();
  await expect(page).toHaveURL(/returnTo=planner/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/planner$/);
});

test('direct recipe detail back falls back to recipe book', async ({ page }) => {
  await seedState(page, {
    recipes: [
      {
        id: 'direct-nav-recipe',
        name: 'Direct Navigation Recipe',
        source: 'manual',
        preparationType: 'classic',
        ingredients: [ '1 tomato' ],
        steps: [ 'Slice tomato' ],
      },
    ],
  });

  await gotoRoute(page, 'recipe-book/direct-nav-recipe');
  await expect(page.locator('#saved-detail-view')).toContainText('Direct Navigation Recipe');
  await page.locator('.detail-back').click();
  await expect(page).toHaveURL(/#\/recipe-book$/);
  await expect(page.locator('#saved-grid')).toContainText('Direct Navigation Recipe');
});

test('recipe book detail navigation and cooking exit stay in recipe book context', async ({ page }) => {
  await seedState(page, {
    recipes: [
      {
        id: 'recipe-book-nav-recipe',
        name: 'Recipe Book Navigation Recipe',
        source: 'manual',
        preparationType: 'classic',
        ingredients: [ '1 tomato' ],
        steps: [ 'Slice tomato', 'Serve tomato' ],
      },
    ],
  });

  await gotoRoute(page, 'recipe-book');
  await page.locator('.ricetta-card').filter({ hasText: 'Recipe Book Navigation Recipe' }).click();
  await expect(page).toHaveURL(/recipe-book\/recipe-book-nav-recipe/);
  await page.locator('.detail-back').click();
  await expect(page).toHaveURL(/#\/recipe-book$/);

  await page.locator('.ricetta-card').filter({ hasText: 'Recipe Book Navigation Recipe' }).click();
  await expect(page.locator('#saved-detail-view')).toContainText('Recipe Book Navigation Recipe');
  await page.locator('.detail-top-start').click();
  await expect(page.locator('.cooking-mode')).toContainText('Recipe Book Navigation Recipe');
  await page.locator('.cooking-exit').click();
  await expect(page).toHaveURL(/recipe-book\/recipe-book-nav-recipe/);
  await expect(page.locator('#saved-detail-view')).toContainText('Recipe Book Navigation Recipe');

  await page.locator('.detail-back').click();
  await page.locator('.ricetta-card').filter({ hasText: 'Recipe Book Navigation Recipe' }).click();
  await page.goBack();
  await expect(page).toHaveURL(/#\/recipe-book$/);
});
