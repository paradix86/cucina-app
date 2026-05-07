import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const RECIPE_BOOK_KEY = 'cucina_recipebook_v3';
const LANG_KEY = 'cucina_lang';

const TARGET_URL = 'https://example.com/test-recipe';

const READABLE_MARKDOWN = `# Test Recipe Title

Some intro paragraph that is ignored by the parser.

## Ingredients
- 200 g flour
- 2 eggs
- a pinch of salt

## Instructions
1. Mix the flour with the eggs.
2. Add salt and stir.
3. Cook for 10 minutes.
`;

const EXISTING_RECIPE = {
  id: 'existing-imported-recipe',
  name: 'Old Imported Recipe',
  url: TARGET_URL,
  source: 'web',
  preparationType: 'classic',
  ingredients: ['old ingredient'],
  steps: ['old step'],
};

async function seedAndOpen(page: Page, lang: 'it' | 'en'): Promise<void> {
  // Mock the readable proxy so the import flow always succeeds with the same
  // URL the seeded recipe carries — that's how the duplicate gets detected.
  await page.route('**/r.jina.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: READABLE_MARKDOWN,
    });
  });

  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await page.evaluate(
    ({ recipes, recipeKey, langKey, lang }) => {
      localStorage.clear();
      localStorage.setItem(langKey, lang);
      localStorage.setItem(recipeKey, JSON.stringify(recipes));
    },
    { recipes: [EXISTING_RECIPE], recipeKey: RECIPE_BOOK_KEY, langKey: LANG_KEY, lang },
  );
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
  await page.goto(`${APP_ROOT}#/import`);
  await expect(page.locator('#import-link-card')).toBeVisible();
}

test.describe('Import duplicate detection (I-3)', () => {
  test('shows 3-button prompt when re-importing a URL already in the book', async ({ page }) => {
    await seedAndOpen(page, 'en');

    await page.locator('#import-link-card input[type="url"]').fill(TARGET_URL);
    await page.locator('#btn-import-go').click();

    // Preview must render before Save can be clicked.
    await expect(page.locator('button.preview-save-top').first())
      .toBeVisible({ timeout: 15_000 });

    await page.locator('button.preview-save-top').first().click();

    // Dialog opens with three actions: replace, add as copy, cancel.
    const dialog = page.locator('.confirm-dialog, dialog, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await expect(dialog.getByRole('button', { name: /replace/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /add.*copy|new copy/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /cancel/i })).toBeVisible();

    // Cancelling leaves the book unchanged.
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();

    const recipeCount = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).length : 0;
    }, RECIPE_BOOK_KEY);
    expect(recipeCount).toBe(1);
  });

  test('captures Italian dialog at 375px for visual verification', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedAndOpen(page, 'it');

    await page.locator('#import-link-card input[type="url"]').fill(TARGET_URL);
    await page.locator('#btn-import-go').click();
    await expect(page.locator('button.preview-save-top').first())
      .toBeVisible({ timeout: 15_000 });
    await page.locator('button.preview-save-top').first().click();

    const dialog = page.locator('.confirm-dialog, dialog, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(150);
    await page.screenshot({
      path: '.agent-output/screenshots/i3-duplicate-dialog-mobile.png',
      fullPage: false,
    });
  });
});
