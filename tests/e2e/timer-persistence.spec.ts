import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const LANG_KEY = 'cucina_lang';
const TIMERS_KEY = 'cucina_timers_v1';

test.beforeEach(async ({ page }) => {
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await page.evaluate(
    ({ langKey, timersKey }) => {
      localStorage.clear();
      localStorage.setItem(langKey, 'en');
      // Clear any timers persisted by a prior test so each spec starts clean.
      localStorage.removeItem(timersKey);
    },
    { langKey: LANG_KEY, timersKey: TIMERS_KEY },
  );
  await page.goto(`${APP_ROOT}#/timer`);
  await expect(page.locator('input[aria-label="Min"]')).toBeVisible();
});

async function addTimer(page: Page, name: string, min: string, sec: string): Promise<void> {
  await page.locator('input[aria-label="Dish name"]').fill(name);
  await page.locator('input[aria-label="Min"]').fill(min);
  await page.locator('input[aria-label="Sec"]').fill(sec);
  await page.getByRole('button', { name: '+ Add' }).click();
  await expect(page.locator('.timer-card', { hasText: name })).toBeVisible();
}

function parseDisplay(display: string): number {
  // formatClock emits M:SS or MM:SS; "READY!" surfaces when expired.
  const m = display.match(/^(\d+):(\d{2})$/);
  if (!m) return Number.NaN;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

test.describe('Timer persistence (T-3)', () => {
  test('running timer survives a page reload with correct remaining time', async ({ page }) => {
    await addTimer(page, 'Reload Test', '1', '0'); // 60 seconds
    await expect(page.locator('.timer-card .t-display.running')).toBeVisible();

    // Wait ~3 seconds so the remaining time is clearly less than full duration.
    await page.waitForTimeout(3000);
    const beforeText = await page.locator('.timer-card .t-display').first().textContent();
    const beforeSec = parseDisplay((beforeText ?? '').trim());
    expect(beforeSec).toBeGreaterThan(0);
    expect(beforeSec).toBeLessThanOrEqual(57);

    await page.reload();
    await expect(page.locator('input[aria-label="Min"]')).toBeVisible();
    await expect(page.locator('.timer-card', { hasText: 'Reload Test' })).toBeVisible();
    await expect(page.locator('.timer-card .t-display.running')).toBeVisible();

    const afterText = await page.locator('.timer-card .t-display').first().textContent();
    const afterSec = parseDisplay((afterText ?? '').trim());
    // Remaining must be <= what it was before reload (allow up to 8s of slack
    // for the build/hydration cycle). Critically: it must NOT have reset to
    // the original 60-second duration.
    expect(afterSec).toBeLessThanOrEqual(beforeSec);
    expect(afterSec).toBeGreaterThanOrEqual(beforeSec - 8);
    expect(afterSec).toBeLessThan(60);
  });

  test('timer that expires during the away period appears in READY state on return (no modal)', async ({ page }) => {
    await addTimer(page, 'Expire Test', '0', '2');
    await expect(page.locator('.timer-card .t-display.running')).toBeVisible();

    // Navigate away from the timer view and wait long enough for the timer to
    // expire while it's not visible.
    await page.goto(`${APP_ROOT}#/`);
    await page.waitForTimeout(3500);

    // Reload to mimic a full re-mount (user reopens the PWA from cold).
    await page.reload();
    await expect(page.locator('main.app')).toBeVisible();
    await page.goto(`${APP_ROOT}#/timer`);
    await expect(page.locator('input[aria-label="Min"]')).toBeVisible();

    await expect(page.locator('.timer-card', { hasText: 'Expire Test' })).toBeVisible();
    await expect(page.locator('.timer-card .t-display.done')).toBeVisible();

    // Design: NO modal alert at app open. Reconcile is silent on hydration.
    await expect(page.locator('.confirm-overlay[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('.timer-alert-overlay')).not.toBeVisible();
  });

  test('captures 3-state timer view at 375px after reload', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // Re-run beforeEach assumptions at the new viewport.
    await page.goto(APP_ROOT);
    await page.evaluate(() => localStorage.removeItem('cucina_timers_v1'));
    await page.goto(`${APP_ROOT}#/timer`);
    await expect(page.locator('input[aria-label="Min"]')).toBeVisible();

    // 1. Running timer (long enough that it's still running after reload).
    await addTimer(page, 'Pasta', '5', '0');
    // 2. Paused timer.
    await addTimer(page, 'Pane', '3', '0');
    await page.locator('.timer-card', { hasText: 'Pane' }).locator('.t-btns button').first().click();
    // 3. Ready (expired) timer.
    await addTimer(page, 'Sugo', '0', '2');
    await expect(page.locator('.timer-card', { hasText: 'Sugo' }).locator('.t-display.done'))
      .toBeVisible({ timeout: 8000 });

    // Reload and confirm all three survived with their distinct visual states.
    await page.reload();
    await expect(page.locator('input[aria-label="Min"]')).toBeVisible();
    await expect(page.locator('.timer-card', { hasText: 'Pasta' }).locator('.t-display.running')).toBeVisible();
    await expect(page.locator('.timer-card', { hasText: 'Pane' }).locator('.t-display.running')).toHaveCount(0);
    await expect(page.locator('.timer-card', { hasText: 'Sugo' }).locator('.t-display.done')).toBeVisible();

    // Scroll the timer grid into view and screenshot the cards specifically.
    await page.locator('#timer-grid').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: '.agent-output/screenshots/t3-timers-after-reload.png',
      fullPage: false,
    });
  });

  test('paused timer survives reload at the same paused remaining', async ({ page }) => {
    await addTimer(page, 'Paused Test', '0', '30');
    await expect(page.locator('.timer-card .t-display.running')).toBeVisible();

    await page.waitForTimeout(2000);
    // Pause via toggle button (first button in .t-btns).
    await page.locator('.timer-card .t-btns button').first().click();
    await expect(page.locator('.timer-card .t-display.running')).toHaveCount(0);
    const pausedText = await page.locator('.timer-card .t-display').first().textContent();
    const pausedSec = parseDisplay((pausedText ?? '').trim());

    // Wait while paused — paused timers must not decrement.
    await page.waitForTimeout(2000);

    await page.reload();
    await expect(page.locator('input[aria-label="Min"]')).toBeVisible();
    await expect(page.locator('.timer-card', { hasText: 'Paused Test' })).toBeVisible();
    await expect(page.locator('.timer-card .t-display.running')).toHaveCount(0);

    const afterText = await page.locator('.timer-card .t-display').first().textContent();
    const afterSec = parseDisplay((afterText ?? '').trim());
    expect(afterSec).toBe(pausedSec);
  });
});
