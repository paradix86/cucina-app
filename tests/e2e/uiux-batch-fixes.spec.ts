import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const RECIPE_BOOK_KEY = 'cucina_recipebook_v3';
const SHOPPING_KEY = 'cucina_shopping_list_v1';
const LANG_KEY = 'cucina_lang';
const SCREENSHOT_DIR = '.agent-output/screenshots';

const SEED_RECIPE = {
  id: 'audit-recipe',
  name: 'Audit Recipe',
  source: 'manual',
  preparationType: 'classic',
  ingredients: ['200g flour', '2 eggs'],
  steps: ['Mix.', 'Cook.'],
};

const SEED_SHOPPING = [
  {
    id: 'audit-item-1',
    text: 'Salt',
    name: 'Salt',
    quantity: '1',
    unit: 'tsp',
    checked: false,
    sourceRecipeId: SEED_RECIPE.id,
    sourceRecipeName: SEED_RECIPE.name,
    createdAt: 1735_000_000_000,
  },
];

async function seedAndOpen(page: Page, path: string): Promise<void> {
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await page.evaluate(
    ({ recipes, shopping, recipeKey, shoppingKey, langKey }) => {
      localStorage.clear();
      localStorage.setItem(langKey, 'en');
      localStorage.setItem(recipeKey, JSON.stringify(recipes));
      localStorage.setItem(shoppingKey, JSON.stringify(shopping));
    },
    {
      recipes: [SEED_RECIPE],
      shopping: SEED_SHOPPING,
      recipeKey: RECIPE_BOOK_KEY,
      shoppingKey: SHOPPING_KEY,
      langKey: LANG_KEY,
    },
  );
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
  await page.goto(`${APP_ROOT}${path}`);
}

test.describe('UI/UX batch — RD-2 (recipe-detail icon a11y)', () => {
  test('quick-fav and quick-del buttons have aria-label', async ({ page }) => {
    await seedAndOpen(page, '#/recipe-book');
    const card = page.locator('.ricetta-card', { hasText: SEED_RECIPE.name }).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.locator('.detail-quick-fav')).toBeVisible();

    await expect(page.locator('.detail-quick-fav')).toHaveAttribute('aria-label', /.+/);
    await expect(page.locator('.detail-quick-del')).toHaveAttribute('aria-label', /.+/);

    // The fav label flips with state; verify both states have a non-empty label.
    const labelBefore = await page.locator('.detail-quick-fav').getAttribute('aria-label');
    expect(labelBefore?.length ?? 0).toBeGreaterThan(0);
    await page.locator('.detail-quick-fav').click();
    const labelAfter = await page.locator('.detail-quick-fav').getAttribute('aria-label');
    expect(labelAfter?.length ?? 0).toBeGreaterThan(0);
    expect(labelAfter).not.toBe(labelBefore);
  });
});

test.describe('UI/UX batch — SL-2 (export mode toggle affordance)', () => {
  test('export mode is rendered as a 2-segment switch with proper button affordance', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedAndOpen(page, '#/shopping-list');
    await expect(page.locator('.shopping-toolbar')).toBeVisible();

    const segments = page.locator('.shopping-export-mode-segment');
    await expect(segments).toHaveCount(2);

    // First segment is the default-active state ("Full" / "With recipe source").
    await expect(segments.nth(0)).toHaveClass(/active/);
    await expect(segments.nth(1)).not.toHaveClass(/active/);

    // Both segments are buttons with aria-pressed and visible affordance >= 32px tall.
    for (const i of [0, 1]) {
      const seg = segments.nth(i);
      await expect(seg).toHaveAttribute('aria-pressed', /true|false/);
      const box = await seg.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
    }

    // Clicking the second segment switches active state.
    await segments.nth(1).click();
    await expect(segments.nth(1)).toHaveClass(/active/);
    await expect(segments.nth(0)).not.toHaveClass(/active/);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/quickfix-batch-sl2-toggle-after.png`,
      fullPage: false,
    });
  });
});

test.describe('UI/UX batch — SL-3 (toolbar button tap target)', () => {
  test('Copy text and Share buttons are at least 44px tall', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedAndOpen(page, '#/shopping-list');
    await expect(page.locator('.shopping-toolbar-btn').first()).toBeVisible();

    const buttons = page.locator('.shopping-toolbar-btn');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/quickfix-batch-sl3-buttons-after.png`,
      fullPage: false,
    });
  });
});

test.describe('UI/UX batch — X-1 (header tap targets)', () => {
  test('app-brand has 44px min-height across viewports', async ({ page }) => {
    await seedAndOpen(page, '#/recipe-book');
    await expect(page.locator('.app-brand')).toBeVisible();

    // Desktop viewport: brand should already meet 44px.
    let box = await page.locator('.app-brand').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Mobile viewport: still meets 44px.
    await page.setViewportSize({ width: 375, height: 812 });
    box = await page.locator('.app-brand').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('header selects meet 44px tap target on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedAndOpen(page, '#/recipe-book');

    const themeSelect = page.locator('#theme-select');
    const langSelect = page.locator('#lang-select');
    await expect(themeSelect).toBeVisible();
    await expect(langSelect).toBeVisible();

    const themeBox = await themeSelect.boundingBox();
    const langBox = await langSelect.boundingBox();
    expect(themeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(langBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/quickfix-batch-x1-header-after.png`,
      fullPage: false,
    });
  });
});
