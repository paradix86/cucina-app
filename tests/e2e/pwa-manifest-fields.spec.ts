import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MANIFEST_URL = 'http://127.0.0.1:4173/cucina-app/manifest.webmanifest';

// Read dist copy at module load (after webServer runs `npm run build`).
// Used in test 5 to verify the served bytes match what's on disk.
const distManifest = readFileSync(
  path.join(process.cwd(), 'dist/manifest.webmanifest'),
  'utf-8'
);

// Fetched once in beforeAll and shared across all tests in this file.
let manifest: Record<string, unknown>;

test.beforeAll(async ({ request }) => {
  const res = await request.get(MANIFEST_URL);
  expect(res.ok(), `manifest not served: HTTP ${res.status()}`).toBe(true);
  manifest = await res.json();
});

test('manifest is served and parses as valid JSON', async ({ request }) => {
  const res = await request.get(MANIFEST_URL);
  expect(res.ok()).toBe(true);
  const body = await res.text();
  expect(() => JSON.parse(body), 'manifest body is not valid JSON').not.toThrow();
});

test('manifest contains W3C identity fields', () => {
  expect(manifest.id).toBe('/cucina-app/');
  expect(manifest.start_url).toBe('/cucina-app/');
  expect(manifest.scope).toBe('/cucina-app/');
});

test('manifest contains presentation fields', () => {
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('any');
  expect(Array.isArray(manifest.display_override)).toBe(true);
  const override = manifest.display_override as string[];
  expect(override).toContain('standalone');
  expect(override).toContain('minimal-ui');
});

test('manifest contains 3 valid shortcuts with hash-routing URLs', () => {
  expect(Array.isArray(manifest.shortcuts)).toBe(true);
  const shortcuts = manifest.shortcuts as Array<Record<string, string>>;
  expect(shortcuts, 'expected exactly 3 shortcuts').toHaveLength(3);

  for (const s of shortcuts) {
    for (const field of ['name', 'short_name', 'description', 'url'] as const) {
      expect(typeof s[field], `shortcut.${field} must be a string`).toBe('string');
      expect(s[field].length, `shortcut.${field} must not be empty`).toBeGreaterThan(0);
    }
    expect(s.url, `shortcut "${s.name}" URL is missing the hash: ${s.url}`)
      .toMatch(/^\/cucina-app\/#\//);
  }

  const urls = shortcuts.map(s => s.url);
  expect(urls.some(u => u.includes('/shopping-list')), 'missing /shopping-list shortcut').toBe(true);
  expect(urls.some(u => u.includes('/planner')), 'missing /planner shortcut').toBe(true);
  expect(urls.some(u => u.includes('/recipe-book')), 'missing /recipe-book shortcut').toBe(true);
});

test('manifest served from preview matches dist/ file on disk', async ({ request }) => {
  const res = await request.get(MANIFEST_URL);
  const ct = res.headers()['content-type'] ?? '';
  expect(
    ct.includes('manifest+json') || ct.includes('application/json') || ct.includes('text/plain'),
    `unexpected Content-Type: ${ct}`
  ).toBe(true);
  const body = await res.text();
  expect(JSON.parse(body), 'served manifest does not match dist/manifest.webmanifest').toEqual(
    JSON.parse(distManifest)
  );
});
