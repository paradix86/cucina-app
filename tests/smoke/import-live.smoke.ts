/**
 * Live import smoke suite — Italian recipe sites.
 *
 * What this is:
 *   A small set of real-URL checks that verify the full import pipeline
 *   (Jina markdown fetch → adapter dispatch → JSON-LD / WPRM fallback) still
 *   produces usable recipes on a curated set of Italian recipe sites.
 *
 * What this is NOT:
 *   - A parser correctness suite (that lives in tests/unit/)
 *   - A brittle exact-string assertion suite
 *   - A PR gate (too dependent on live site behaviour)
 *
 * How to run:
 *   npm run test:smoke
 *
 * Requires network access (calls Jina Reader API).
 * Each test has a 30 s timeout.
 */

import { describe, it, expect } from 'vitest';
import {
  importWebsiteRecipeWithFallbacks,
} from '../../src/lib/import/adapters';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function fetchMarkdown(url: string): Promise<string> {
  const resp = await fetch(`https://r.jina.ai/${url}`);
  if (!resp.ok) throw new Error(`Jina fetch failed: HTTP ${resp.status} for ${url}`);
  return resp.text();
}

/** Run the full import pipeline for a URL and return the preview recipe. */
async function runImport(url: string) {
  const markdown = await fetchMarkdown(url);
  return importWebsiteRecipeWithFallbacks(markdown, url);
}

/**
 * Rate this result for console reporting.
 * ✅ WORKS WELL  — title + ≥5 ingredients + ≥3 steps
 * ⚠  PARTIAL     — title + at least one of (ingredients or steps)
 * ❌ POOR         — no usable data
 */
function classify(name: string, ing: number, steps: number): string {
  if (name.length > 2 && ing >= 5 && steps >= 3) return '✅ WORKS WELL';
  if (name.length > 2 && (ing >= 3 || steps >= 2)) return '⚠  PARTIAL';
  return '❌ POOR';
}

function logResult(
  url: string,
  name: string,
  ing: number,
  steps: number,
  time: string,
  preparationType: string,
) {
  const rating = classify(name, ing, steps);
  console.log(`  ${rating}`);
  console.log(`  URL:             ${url}`);
  console.log(`  Title:           ${name || '(empty)'}`);
  console.log(`  Ingredients:     ${ing}`);
  console.log(`  Steps:           ${steps}`);
  console.log(`  Time / prepType: ${time} / ${preparationType}`);
}

// ─── site definitions ─────────────────────────────────────────────────────────

/*
 * Curated recipe URLs.
 * Sanity thresholds are intentionally loose — this is a smoke check,
 * not a precise parser test.  Prefer stable canonical URLs.
 *
 * Import path column indicates what mechanism handles this site:
 *   json-ld           — generic Schema.org structured data
 *   json-ld+sanitize  — JSON-LD with control-char sanitization (cucchiaio.it edge case)
 *   named-adapter     — dedicated adapter in WEBSITE_IMPORT_ADAPTERS
 *
 * ricetteperbimby.it has a named adapter but is not in this initial suite:
 * the adapter relies on a specific Jina markdown structure that needs
 * a confirmed stable recipe URL before adding it here.
 */

// ─── misya.info ───────────────────────────────────────────────────────────────

describe('misya.info — JSON-LD', () => {
  it('imports a real recipe with title, ≥3 ingredients, ≥2 steps', async () => {
    const url = 'https://www.misya.info/ricetta/spaghetti-aglio-olio-e-peperoncino.htm';
    let result;
    try {
      result = await runImport(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Import pipeline threw: ${msg}\nURL: ${url}`);
    }

    logResult(url, result.name, result.ingredients.length, result.steps.length, result.time ?? 'n.d.', result.preparationType);

    expect(result.name.length, 'title should be non-empty').toBeGreaterThan(2);
    expect(result.ingredients.length, 'should extract at least 3 ingredients').toBeGreaterThanOrEqual(3);
    expect(result.steps.length, 'should extract at least 2 steps').toBeGreaterThanOrEqual(2);
    expect(result.source).toBe('web');
    expect(result.sourceDomain).toBe('misya.info');
  });
});

// ─── fattoincasadabenedetta.it ────────────────────────────────────────────────

describe('fattoincasadabenedetta.it — JSON-LD / WPRM', () => {
  it('imports a real recipe with title, ≥4 ingredients, ≥3 steps', async () => {
    const url = 'https://www.fattoincasadabenedetta.it/ricetta/tiramisu/';
    let result;
    try {
      result = await runImport(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Import pipeline threw: ${msg}\nURL: ${url}`);
    }

    logResult(url, result.name, result.ingredients.length, result.steps.length, result.time ?? 'n.d.', result.preparationType);

    expect(result.name.length, 'title should be non-empty').toBeGreaterThan(2);
    expect(result.ingredients.length, 'should extract at least 4 ingredients').toBeGreaterThanOrEqual(4);
    expect(result.steps.length, 'should extract at least 3 steps').toBeGreaterThanOrEqual(3);
    expect(result.source).toBe('web');
    expect(result.sourceDomain).toBe('fattoincasadabenedetta.it');
  });
});

// ─── cucchiaio.it ─────────────────────────────────────────────────────────────
// This site embeds control characters inside JSON-LD string values (invalid
// but common in CMS output).  Import relies on sanitizeJsonLdText to recover.

describe('cucchiaio.it — JSON-LD with control-char sanitization', () => {
  it('imports a real recipe with title, ≥4 ingredients, ≥2 steps', async () => {
    const url = 'https://www.cucchiaio.it/ricetta/pasta-al-forno/';
    let result;
    try {
      result = await runImport(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Import pipeline threw: ${msg}\nURL: ${url}\n(hint: if JSONLD_NO_INGREDIENTS — site may have removed JSON-LD)`);
    }

    logResult(url, result.name, result.ingredients.length, result.steps.length, result.time ?? 'n.d.', result.preparationType);

    expect(result.name.length, 'title should be non-empty').toBeGreaterThan(2);
    expect(result.ingredients.length, 'should extract at least 4 ingredients').toBeGreaterThanOrEqual(4);
    expect(result.steps.length, 'should extract at least 2 steps').toBeGreaterThanOrEqual(2);
    expect(result.source).toBe('web');
  });
});

// ─── vegolosi.it ──────────────────────────────────────────────────────────────
// Has a dedicated named adapter.

describe('vegolosi.it — named adapter', () => {
  it('imports a real recipe with title, ≥3 ingredients, ≥2 steps', async () => {
    const url = 'https://vegolosi.it/ricette-vegane/pasta-al-pesto/';
    let result;
    try {
      result = await runImport(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Import pipeline threw: ${msg}\nURL: ${url}\n(hint: if VEGOLOSI_PARSE_INCOMPLETE — check h3 structure from Jina markdown)`);
    }

    logResult(url, result.name, result.ingredients.length, result.steps.length, result.time ?? 'n.d.', result.preparationType);

    expect(result.name.length, 'title should be non-empty').toBeGreaterThan(2);
    expect(result.ingredients.length, 'should extract at least 3 ingredients').toBeGreaterThanOrEqual(3);
    expect(result.steps.length, 'should extract at least 2 steps').toBeGreaterThanOrEqual(2);
    expect(result.source).toBe('web');
    expect(result.sourceDomain).toBe('vegolosi.it');
  });
});

// ─── giallozafferano.it ───────────────────────────────────────────────────────
// Has a dedicated named adapter.  The adapter requires specific Jina markdown
// markers (## Come preparare, [AGGIUNGI ALLA LISTA DELLA SPESA], etc.).
// If this test fails with GZ_INGREDIENTS_NOT_FOUND or GZ_STEPS_NOT_FOUND,
// check whether Jina's markdown output for the URL still matches the adapter.

describe('giallozafferano.it — named adapter', () => {
  it('imports a real recipe with title, ≥3 ingredients, ≥2 steps', async () => {
    const url = 'https://www.giallozafferano.it/ricetta/spaghetti-alla-carbonara/';
    let result;
    try {
      result = await runImport(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Import pipeline threw: ${msg}\nURL: ${url}\n` +
        `(hint: if GZ_*_NOT_FOUND — Jina markdown structure may have changed; ` +
        `if WEB_FETCH_404 — URL may need updating)`,
      );
    }

    logResult(url, result.name, result.ingredients.length, result.steps.length, result.time ?? 'n.d.', result.preparationType);

    expect(result.name.length, 'title should be non-empty').toBeGreaterThan(2);
    expect(result.ingredients.length, 'should extract at least 3 ingredients').toBeGreaterThanOrEqual(3);
    expect(result.steps.length, 'should extract at least 2 steps').toBeGreaterThanOrEqual(2);
    expect(result.source).toBe('web');
    expect(result.sourceDomain).toBe('giallozafferano.it');
  });

  it('imports a multi-section preparation recipe without "Come preparare"', async () => {
    const url = 'https://www.giallozafferano.it/ricetta/Lasagne-alla-Bolognese.html';
    let result;
    try {
      result = await runImport(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Import pipeline threw: ${msg}\nURL: ${url}\n` +
        `(hint: if GZ_STEPS_NOT_FOUND — GZ section-heading assumptions may have regressed)`,
      );
    }

    logResult(url, result.name, result.ingredients.length, result.steps.length, result.time ?? 'n.d.', result.preparationType);

    expect(result.name.length, 'title should be non-empty').toBeGreaterThan(2);
    expect(result.ingredients.length, 'should extract at least 5 ingredients').toBeGreaterThanOrEqual(5);
    expect(result.steps.length, 'should extract at least 4 steps').toBeGreaterThanOrEqual(4);
    expect(result.source).toBe('web');
    expect(result.sourceDomain).toBe('giallozafferano.it');
  });
});
