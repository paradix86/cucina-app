import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest config for the live import smoke suite.
 *
 * Run with: npm run test:smoke
 *
 * Differences from the unit test config (vitest.config.ts):
 *  - Only includes tests/smoke/**\/*.smoke.ts
 *  - 30 s timeout per test (real network calls via Jina Reader)
 *  - No retry — transient failures should surface, not be silently hidden
 *  - verbose reporter — shows per-test diagnostics in the terminal
 *  - No Vue plugin needed (smoke tests only import pure-logic parsers)
 */
export default defineConfig({
  test: {
    include: ['tests/smoke/**/*.smoke.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 10_000,
    retry: 0,
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
