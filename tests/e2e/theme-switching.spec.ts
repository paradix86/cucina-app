import { expect, test, type Page } from '@playwright/test';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';

async function themeSnapshot(page: Page) {
  return page.evaluate(() => ({
    selected: (document.querySelector('#theme-select') as HTMLSelectElement | null)?.value,
    dataTheme: document.documentElement.dataset.theme || '',
    stored: localStorage.getItem('cucina_theme'),
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    headerBg: getComputedStyle(document.querySelector('.app-header') as Element).backgroundColor,
    bodyText: getComputedStyle(document.body).color,
  }));
}

async function verifyThemeSwitching(page: Page) {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(APP_ROOT);
  await expect(page.locator('#theme-select')).toBeVisible();
  // Wait for the SPA router to finish its initial navigation before touching
  // localStorage — otherwise page.evaluate races with the router's context reset.
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('cucina_theme'));
  await page.reload();
  await expect(page.locator('#theme-select')).toBeVisible();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();

  await page.locator('#theme-select').selectOption('dark');
  await expect.poll(() => themeSnapshot(page)).toMatchObject({
    selected: 'dark',
    dataTheme: 'dark',
    stored: 'dark',
    colorScheme: 'dark',
    themeColor: '#1a1a18',
  });
  await expect.poll(async () => (await themeSnapshot(page)).bodyText).toBe('rgb(240, 237, 232)');

  await page.locator('#theme-select').selectOption('light');
  await expect.poll(() => themeSnapshot(page)).toMatchObject({
    selected: 'light',
    dataTheme: 'light',
    stored: 'light',
    colorScheme: 'light',
    themeColor: '#ffffff',
  });
  await expect.poll(async () => (await themeSnapshot(page)).bodyText).toBe('rgb(26, 26, 24)');

  await page.reload();
  await expect(page.locator('#theme-select')).toBeVisible();
  await expect.poll(() => themeSnapshot(page)).toMatchObject({
    selected: 'light',
    dataTheme: 'light',
    stored: 'light',
    colorScheme: 'light',
    themeColor: '#ffffff',
  });

  expect(consoleErrors).toEqual([]);
}

test('theme switching applies immediately and persists on desktop', async ({ page }) => {
  await verifyThemeSwitching(page);
});

test('theme switching applies immediately and persists on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await verifyThemeSwitching(page);
});
