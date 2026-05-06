import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Override global serviceWorkers: 'block' — this file tests SW behaviour
test.use({ serviceWorkers: 'allow' });

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';

// Read CACHE_NAME from source so the test survives version bumps
const swSource = readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf-8');
const m = swSource.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
if (!m) throw new Error('CACHE_NAME not found in public/sw.js');
const CACHE_NAME = m[1];

// Derive expected precache count from the built SW (version-proof)
const distSwSource = readFileSync(path.join(process.cwd(), 'dist/sw.js'), 'utf-8');
const BUNDLE_ENTRIES = (distSwSource.match(/'\/cucina-app\/assets\/[^']+'/g) ?? []).length;
const STATIC_ASSETS_COUNT = 8;

// The lazy-loaded view chunks that were missing before the precache fix
const VIEW_CHUNKS = [
  '/BuiltinRecipesView-',
  '/MealComposerView-',
  '/WeeklyPlannerView-',
  '/TimerView-',
  '/ImportView-',
  '/GuidesView-',
  '/NutritionGoalsView-',
  '/ShoppingListView-',
];

// Each test runs in a fresh BrowserContext (Playwright default): empty storage,
// empty caches, no SW registrations — no explicit cleanup needed.
//
// After the first page load, the app registers the SW, which installs, activates,
// calls clients.claim(), and triggers the app's `controllerchange` handler.
// That handler sets `cucina_sw_reloaded_*` in sessionStorage then calls
// window.location.reload(). We use waitForFunction (which survives context
// destruction during navigation) to wait for that flag — indicating the full
// install+claim+reload cycle has settled and the cache is populated.
async function navigateAndWaitForSW(page: Page): Promise<void> {
  await page.goto(APP_ROOT, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      for (let i = 0; i < sessionStorage.length; i++) {
        if (sessionStorage.key(i)?.startsWith('cucina_sw_reloaded_')) return true;
      }
      return false;
    },
    undefined,
    { timeout: 30_000 }
  );
  // Wait for Vue to fully mount on the post-SW-reload page.
  // waitForLoadState('domcontentloaded') can return immediately if the pre-reload
  // page was already past that state, causing a race with the SW-triggered reload.
  await page.waitForSelector('main.app', { state: 'visible', timeout: 30_000 });
}

test('service worker installs and reports precache success', async ({ page }) => {
  const swLogs: string[] = [];
  page.on('console', msg => {
    if (msg.text().includes('[sw]')) swLogs.push(msg.text());
  });

  await navigateAndWaitForSW(page);

  const failLog = swLogs.find(l => /\[sw\] Precache: \d+ of \d+ assets failed/.test(l));
  if (failLog) {
    const details = swLogs.filter(l => l.includes('FAIL'));
    throw new Error(`SW precache failures detected:\n${failLog}\n${details.join('\n')}`);
  }

  // Primary assertion: cache must be populated (SW console logs may not propagate
  // from the worker context to page.on('console') — cache count is authoritative)
  const cachedCount = await page.evaluate(async (cacheName: string) => {
    const cache = await caches.open(cacheName);
    return (await cache.keys()).length;
  }, CACHE_NAME);

  const expectedMin = BUNDLE_ENTRIES + STATIC_ASSETS_COUNT - 2;
  expect(
    cachedCount,
    `Cache '${CACHE_NAME}' has ${cachedCount} entries; expected ~${BUNDLE_ENTRIES + STATIC_ASSETS_COUNT} (${BUNDLE_ENTRIES} bundles + ${STATIC_ASSETS_COUNT} static). Precache likely failed.`
  ).toBeGreaterThanOrEqual(expectedMin);

  const successLog = swLogs.find(l => /\[sw\] Precache: all \d+ assets cached/.test(l));
  if (successLog) {
    console.log('[test] SW log captured:', successLog);
  } else {
    console.log(`[test] SW logs not propagated via page context (${swLogs.length} total). Cache confirmed at ${cachedCount} entries.`);
  }
});

test('all view chunks are present in cache storage after install', async ({ page }) => {
  await navigateAndWaitForSW(page);

  const cachedUrls: string[] = await page.evaluate(async (cacheName: string) => {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    return keys.map((r: Request) => r.url);
  }, CACHE_NAME);

  const missing = VIEW_CHUNKS.filter(chunk => !cachedUrls.some(url => url.includes(chunk)));

  expect(
    missing,
    `${missing.length} view chunk(s) missing from cache:\n${missing.join('\n')}\n\nAll cached entries (${cachedUrls.length}):\n${cachedUrls.join('\n')}`
  ).toHaveLength(0);
});

test('app loads fully offline after fresh install', async ({ page, context }) => {
  await navigateAndWaitForSW(page);

  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  page.on('requestfailed', request => {
    failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`);
  });

  await context.setOffline(true);

  try {
    // Reload while offline — SW must serve everything from cache
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main.app')).toBeVisible({ timeout: 15_000 });

    // Verify each main route renders without network errors
    const routes = ['recipe-book', 'shopping-list', 'planner', 'import'];
    for (const route of routes) {
      await page.goto(`${APP_ROOT}#/${route}`);
      await expect(page.locator('main.app')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('main.app .panel.active').first()).toBeVisible({ timeout: 10_000 });
    }

    const netErrors = errors.filter(e => e.includes('net::ERR_'));
    expect(
      netErrors,
      `Network errors while offline:\n${netErrors.join('\n')}\n\nFailed requests:\n${failedRequests.join('\n')}`
    ).toHaveLength(0);
  } finally {
    await context.setOffline(false);
  }
});
