/**
 * adapters/index.ts — adapter registry, dispatch, and public export surface.
 *
 * All callers import from 'src/lib/import/adapters' — this file is the single
 * re-export point, preserving the same interface as the former monolithic adapters.ts.
 *
 * Dispatch order (importWebsiteRecipeWithFallbacks):
 *   1. Named adapter (exact domain match or canHandle URL pattern)
 *   2. Generic markdown heading-scanner
 *   3. HTML fetch — OpenGraph / meta fields (shared across remaining fallbacks)
 *   4. JSON-LD / Schema.org structured data
 *   5. WPRM / embedded plugin JSON
 *   6. Throw UNSUPPORTED_WEB_IMPORT
 */
import { normalizeSourceDomain } from '../core';
import { fetchHtmlForJsonLd } from '../web';
import type { ImportPreviewRecipe, WebsiteImportAdapter } from '../../../types';

import { gialloZafferanoAdapter } from './giallozafferano';
import { ricettePerBimbyAdapter } from './ricetteperbimby';
import { ricetteBimbyNetAdapter } from './ricettebimbynet';
import { vegolosiAdapter } from './vegolosi';
import { parseGenericReadableRecipe } from './generic';
import {
  parseJsonLdRecipeFromHtml,
  parseWprmRecipeFromHtml,
  extractHtmlMetaFields,
  extractMainContentImageUrl,
  resolveImportImageUrl,
} from './jsonld';

// Re-export shared utilities that tests and composables consume directly.
export {
  suggestImportTags,
  normalizeImportText,
  stripImportLinksAndImages,
  stripImportMarkdownNoise,
} from './utils';

export {
  parseJsonLdRecipeFromHtml,
  parseWprmRecipeFromHtml,
  extractHtmlMetaFields,
  extractMainContentImageUrl,
  resolveImportImageUrl,
};

// ─── Adapter registry ─────────────────────────────────────────────────────────

const WEBSITE_IMPORT_ADAPTERS: WebsiteImportAdapter[] = [
  gialloZafferanoAdapter,
  ricettePerBimbyAdapter,
  ricetteBimbyNetAdapter,
  vegolosiAdapter,
];

// ─── Adapter lookup ───────────────────────────────────────────────────────────

/** Exact domain-string match. Kept for backward compatibility and diagnostics labels. */
export function getImportAdapterForDomain(domain: string): WebsiteImportAdapter | null {
  return WEBSITE_IMPORT_ADAPTERS.find(adapter => adapter.domain === domain) || null;
}

/**
 * Full adapter lookup: tries exact domain match first, then falls back to
 * canHandle(url) for adapters that declare URL-pattern support.
 */
export function getImportAdapterForUrl(url: string): WebsiteImportAdapter | null {
  const domain = normalizeSourceDomain(url);
  const exact = WEBSITE_IMPORT_ADAPTERS.find(adapter => adapter.domain === domain);
  if (exact) return exact;
  return WEBSITE_IMPORT_ADAPTERS.find(adapter => adapter.canHandle?.(url)) || null;
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/** Synchronous adapter dispatch (named adapters + generic markdown fallback). */
export function importWebsiteRecipeWithAdapters(markdown: string, url: string): ImportPreviewRecipe {
  const adapter = getImportAdapterForUrl(url);
  if (adapter) return adapter.parse(markdown, url);
  const genericRecipe = parseGenericReadableRecipe(markdown, url);
  if (genericRecipe) return genericRecipe;
  throw new Error('UNSUPPORTED_WEB_IMPORT');
}

function extractFallbackImageFromHtml(html: string, pageUrl: string): string {
  const meta = extractHtmlMetaFields(html);
  return (
    resolveImportImageUrl(meta.image || '', pageUrl)
    || extractMainContentImageUrl(html, pageUrl)
    || ''
  );
}

async function enrichCoverImageIfMissing(recipe: ImportPreviewRecipe, pageUrl: string): Promise<ImportPreviewRecipe> {
  if (recipe.coverImageUrl) return recipe;
  try {
    const html = await fetchHtmlForJsonLd(pageUrl);
    const fallbackImage = extractFallbackImageFromHtml(html, pageUrl);
    if (fallbackImage) {
      recipe.coverImageUrl = fallbackImage;
    }
  } catch {
    // Do not fail a successful adapter parse because image enrichment failed.
  }
  return recipe;
}

/**
 * Full async import with structured-data fallbacks.
 * Steps 4 and 5 share the same HTML fetch (no extra round-trip).
 * Named adapters and generic markdown are unaffected by the async path.
 */
export async function importWebsiteRecipeWithFallbacks(markdown: string, url: string): Promise<ImportPreviewRecipe> {
  const adapter = getImportAdapterForUrl(url);
  if (adapter) {
    const parsed = adapter.parse(markdown, url);
    return enrichCoverImageIfMissing(parsed, url);
  }

  const genericRecipe = parseGenericReadableRecipe(markdown, url);
  if (genericRecipe) {
    return enrichCoverImageIfMissing(genericRecipe, url);
  }

  // Fetch HTML once — shared by all remaining fallbacks
  const html = await fetchHtmlForJsonLd(url);
  const meta = extractHtmlMetaFields(html);
  const fallbackImage = extractFallbackImageFromHtml(html, url);
  const ogTitle = meta.title ?? undefined;

  // JSON-LD / Schema.org (OG title fills in when JSON-LD name is empty)
  const jsonLdRecipe = parseJsonLdRecipeFromHtml(html, url, ogTitle);
  if (jsonLdRecipe) {
    if (!jsonLdRecipe.coverImageUrl && fallbackImage) {
      jsonLdRecipe.coverImageUrl = fallbackImage;
    }
    return jsonLdRecipe;
  }

  // WPRM / embedded plugin JSON (OG title fills in when plugin name is absent)
  const wprmRecipe = parseWprmRecipeFromHtml(html, url, ogTitle);
  if (wprmRecipe) {
    if (!wprmRecipe.coverImageUrl && fallbackImage) {
      wprmRecipe.coverImageUrl = fallbackImage;
    }
    return wprmRecipe;
  }

  throw new Error('UNSUPPORTED_WEB_IMPORT');
}
