import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 12_000,
  },
  fullyParallel: false,
  workers: 1,
  // 1 retry in CI to absorb flaky timing; 0 locally so failures are immediate
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1365, height: 900 },
    trace: 'on-first-retry',
    baseURL: 'http://127.0.0.1:4173',
    // Block service workers in E2E tests: the SW calls clients.claim() on activate
    // which causes Playwright to see an execution-context reset when tests run against
    // the preview server (unlike the dev server, which bypasses SW entirely).
    // SW caching behaviour is infrastructure, not a concern for these functional tests.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Build first so preview always serves the current source.
    // reuseExistingServer: locally, skip rebuild if a server is already up on :4173.
    //                      in CI, always start fresh (no stale server risk).
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173/cucina-app/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
