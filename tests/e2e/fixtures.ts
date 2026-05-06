import { test as base } from '@playwright/test';

// Global Playwright fixture: stubs OpenFoodFacts on every page.
// The nutrition enrichment chain (manual → base_ingredients → OFF) falls through
// to a live HTTPS request for any ingredient unmatched by the two offline providers;
// that live call is a flake source for any e2e spec that exercises the calculate
// flow. An empty products array deterministically signals "no match" so specs
// land in --missing or --partial state without depending on OFF availability.
//
// Override: an individual test can call `page.route('**/world.openfoodfacts.org/**', ...)`
// again to install a more specific handler. Playwright matches handlers LIFO,
// so the per-test handler wins and falls back to this fixture if it doesn't fulfill.
//
// All e2e specs MUST import `test` and `expect` from this file rather than
// `@playwright/test` so the fixture is automatically active.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/world.openfoodfacts.org/**', async (route) => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify({ products: [], count: 0, page: 1, page_size: 0 }),
      });
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
