import { expect, test } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const LANG_KEY = 'cucina_lang';
const TARGET_URL = 'https://www.misya.info/ricetta/tuorlo-duovo-marinato.htm';

// HTML page with a single JSON-LD <script> block containing the entity in
// the recipe name — the same shape Misya/WordPress sites emit. The mocked
// readable-proxy returns this; the JSON-LD adapter parses node.name.
const HTML_WITH_JSONLD = `<!DOCTYPE html>
<html><head>
<title>Test</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Tuorlo d&#8217;uovo marinato",
  "recipeIngredient": ["6 tuorli d&#8217;uovo", "200g sale grosso"],
  "recipeInstructions": [
    {"@type": "HowToStep", "text": "Mescola l&#8217;impasto delicatamente."},
    {"@type": "HowToStep", "text": "Lascia riposare in frigo."}
  ],
  "totalTime": "PT24H"
}
</script>
</head><body><h1>Test</h1></body></html>`;

test.beforeEach(async ({ page }) => {
  // r.jina.ai with x-return-format: html returns the raw HTML for the
  // JSON-LD parser path. Plain (markdown) requests return a stub that
  // intentionally cannot be parsed by the generic adapter, forcing the
  // import flow to fall through to the JSON-LD HTML path.
  await page.route('**/r.jina.ai/**', async (route) => {
    const headers = route.request().headers();
    const wantsHtml = headers['x-return-format'] === 'html';
    await route.fulfill({
      status: 200,
      contentType: wantsHtml ? 'text/html' : 'text/plain; charset=utf-8',
      body: wantsHtml ? HTML_WITH_JSONLD : 'Title: Test\n\nNothing parseable here.',
    });
  });

  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await page.evaluate((langKey) => {
    localStorage.clear();
    localStorage.setItem(langKey, 'en');
    localStorage.removeItem('cucina_recipebook_v3');
  }, LANG_KEY);
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
  await page.goto(`${APP_ROOT}#/import`);
  await expect(page.locator('#import-link-card')).toBeVisible();
});

test.describe('Import HTML entity decoding', () => {
  test('JSON-LD recipe name with &#8217; renders as the curly apostrophe (not the entity)', async ({ page }) => {
    await page.locator('#import-link-card input[type="url"]').fill(TARGET_URL);
    await page.locator('#btn-import-go').click();

    // Preview must render with the decoded name. Plain {{ }} interpolation
    // would show "&#8217;" verbatim if the parser saved entity-encoded text;
    // we assert the actual U+2019 character.
    await expect(page.locator('main.app')).toContainText('Tuorlo d’uovo marinato', { timeout: 15_000 });
    await expect(page.locator('main.app')).not.toContainText('&#8217;');

    // Save the previewed recipe and verify the persisted record is decoded.
    await page.locator('button.preview-save-top').first().click();

    // Recipes persist primarily to Dexie/IndexedDB (localStorage is fallback).
    const saved = await page.evaluate(async () => {
      const req = indexedDB.open('cucina-db');
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        const tx = db.transaction(['recipes'], 'readonly');
        const store = tx.objectStore('recipes');
        const all: unknown[] = await new Promise((resolve, reject) => {
          const g = store.getAll();
          g.onsuccess = () => resolve(g.result);
          g.onerror = () => reject(g.error);
        });
        return (all[0] as Record<string, unknown>) ?? null;
      } finally {
        db.close();
      }
    });

    expect(saved).not.toBeNull();
    expect(saved.name).toBe('Tuorlo d’uovo marinato');
    expect(saved.name).not.toContain('&#8217;');
    expect((saved.ingredients as string[]).join(' ')).not.toContain('&#');
    expect((saved.steps as string[]).join(' ')).not.toContain('&#');
    expect(saved.ingredients).toContain('6 tuorli d’uovo');
    expect(saved.steps).toContain('Mescola l’impasto delicatamente.');
  });

  test('hydration migration decodes a pre-seeded entity-encoded recipe and the planner picker shows it cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Seed localStorage with a recipe containing the leaked entity in its
    // name — same shape as the user's affected `imp_1776852441027` record.
    // The store hydrates from localStorage when IndexedDB is empty.
    const SEEDED = [{
      id: 'imp_seed_entity_bug',
      name: 'Tuorlo d&#8217;uovo marinato',
      url: 'https://www.misya.info/ricetta/tuorlo-duovo-marinato.htm',
      sourceDomain: 'misya.info',
      source: 'web',
      preparationType: 'classic',
      ingredients: ['6 tuorli d&#8217;uovo', '200g sale'],
      steps: ['Mescola l&#8217;impasto.', 'Lascia riposare.'],
    }];

    await page.evaluate((recipes) => {
      localStorage.clear();
      localStorage.setItem('cucina_lang', 'en');
      localStorage.setItem('cucina_recipebook_v3', JSON.stringify(recipes));
    }, SEEDED);
    await page.goto(APP_ROOT);
    await expect(page.locator('main.app .panel.active').first()).toBeVisible();

    // Navigate to the planner. Open the slot picker — that's where the bug
    // was first visible.
    await page.goto(`${APP_ROOT}#/planner`);
    await expect(page.locator('.planner-view')).toBeVisible();
    // Click any empty planner slot to open the picker.
    await page.locator('.planner-slot-main').first().click();
    await expect(page.locator('.planner-picker-search, [placeholder*="Search" i]').first()).toBeVisible();

    // Locate the picker entry by its decoded name. If the migration worked,
    // the recipe shows the curly apostrophe; if it failed, the entity literal.
    const pickerItem = page.locator('.planner-picker-item, .planner-picker-item-title')
      .filter({ hasText: 'Tuorlo d’uovo marinato' });
    await expect(pickerItem.first()).toBeVisible({ timeout: 10_000 });

    // Negative assertion: no element shows the literal entity.
    await expect(page.locator('main.app')).not.toContainText('&#8217;');

    await page.screenshot({
      path: '.agent-output/screenshots/entity-fix-planner-picker.png',
      fullPage: false,
    });
  });
});
