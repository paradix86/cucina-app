import { expect, test } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const LANG_KEY = 'cucina_lang';

test.beforeEach(async ({ page }) => {
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await page.evaluate(({ langKey }) => {
    localStorage.clear();
    localStorage.setItem(langKey, 'en');
  }, { langKey: LANG_KEY });
  await page.goto(`${APP_ROOT}#/timer`);
  await expect(page.locator('input[aria-label="Min"]')).toBeVisible();
});

async function addTimer(page: import('@playwright/test').Page, name: string, min: string, sec: string): Promise<void> {
  await page.locator('input[aria-label="Dish name"]').fill(name);
  await page.locator('input[aria-label="Min"]').fill(min);
  await page.locator('input[aria-label="Sec"]').fill(sec);
  await page.getByRole('button', { name: '+ Add' }).click();
  await expect(page.locator('.timer-card', { hasText: name })).toBeVisible();
}

test('deleting a running timer requires confirmation', async ({ page }) => {
  await addTimer(page, 'Pasta Audit', '5', '0');

  // Timer auto-starts; verify running class is applied so the gate condition is met.
  await expect(page.locator('.timer-card .t-display.running')).toBeVisible();

  // First delete attempt — modal should appear and reference the timer name.
  await page.locator('.timer-card .t-del').click();
  const dialog = page.locator('.confirm-overlay[role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Pasta Audit');
  await expect(dialog).toContainText(/running/i);

  // Cancel — timer must survive.
  await dialog.locator('button.confirm-cancel').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.timer-card', { hasText: 'Pasta Audit' })).toBeVisible();
  await expect(page.locator('.timer-card .t-display.running')).toBeVisible();

  // Re-attempt delete and confirm this time.
  await page.locator('.timer-card .t-del').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('button.confirm-ok').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.timer-card')).toHaveCount(0);
});

test('deleting a paused timer does not require confirmation', async ({ page }) => {
  await addTimer(page, 'Tea Audit', '3', '0');

  // Pause the timer (toggle button is the first button in .t-btns when running).
  await page.locator('.timer-card .t-btns button').first().click();
  await expect(page.locator('.timer-card .t-display.running')).toHaveCount(0);

  // Delete — must be instant, no modal.
  await page.locator('.timer-card .t-del').click();
  await expect(page.locator('.confirm-overlay[role="dialog"]')).not.toBeVisible();
  await expect(page.locator('.timer-card')).toHaveCount(0);
});

test('deleting a finished (READY!) timer does not require confirmation', async ({ page }) => {
  // 0:02 timer expires quickly. Once .t-display.done is visible, timer.running is false.
  await addTimer(page, 'Quick Audit', '0', '2');
  await expect(page.locator('.timer-card .t-display.done')).toBeVisible({ timeout: 8000 });

  await page.locator('.timer-card .t-del').click();
  await expect(page.locator('.confirm-overlay[role="dialog"]')).not.toBeVisible();
  await expect(page.locator('.timer-card')).toHaveCount(0);
});
