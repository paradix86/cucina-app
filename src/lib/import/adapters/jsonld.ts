/**
 * adapters/jsonld.ts — JSON-LD / Schema.org structured data, WPRM embedded plugin JSON,
 * and OpenGraph / HTML meta field extraction.
 *
 * These are HTML-path fallback parsers used when neither a named adapter nor the
 * generic markdown scanner can produce a recipe.
 */
import { normalizeSourceDomain } from '../core';
import type { ImportPreviewRecipe } from '../../../types';
import {
  normalizeImportText,
  decodeImportEntities,
  normalizeImportCategory,
  mapCategorySignalToAppCategory,
  inferImportCategoryFromTitleAndText,
  inferImportEmoji,
  inferImportPreparationType,
  suggestImportTags,
  buildImportedRecipe,
} from './utils';

// ─── OpenGraph / HTML meta extraction ────────────────────────────────────────

export interface HtmlMetaFields {
  title: string | null;
  description: string | null;
  image: string | null;
}

/**
 * Extract OpenGraph and standard HTML meta fields from page HTML.
 * Handles both attribute orderings (property before content and vice versa).
 * Used to enrich recipe name when structured parsers find ingredients/steps
 * but the name field is empty.
 */
export function extractHtmlMetaFields(html: string): HtmlMetaFields {
  function firstMatch(patterns: RegExp[]): string | null {
    for (const re of patterns) {
      const m = html.match(re);
      const val = m?.[ 1 ] ? normalizeImportText(decodeImportEntities(m[ 1 ])).trim() : null;
      if (val) return val;
    }
    return null;
  }
  return {
    title: firstMatch([
      /<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
      /<meta\b[^>]*\bcontent=["']([^"'<>]+)["'][^>]*\bproperty=["']og:title["']/i,
      /<meta\b[^>]*\bname=["']title["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
      /<title[^>]*>([^<]{3,120})<\/title>/i,
    ]),
    description: firstMatch([
      /<meta\b[^>]*\bproperty=["']og:description["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
      /<meta\b[^>]*\bcontent=["']([^"'<>]+)["'][^>]*\bproperty=["']og:description["']/i,
      /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
    ]),
    image: firstMatch([
      /<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
      /<meta\b[^>]*\bcontent=["']([^"'<>]+)["'][^>]*\bproperty=["']og:image["']/i,
    ]),
  };
}

// ─── JSON-LD / Schema.org structured data ────────────────────────────────────

/**
 * Convert an ISO 8601 duration (PT30M, PT1H30M, PT2H) to a human-readable
 * Italian-style time string (e.g. "30 min", "1h 30 min", "2h").
 */
function parseDurationIso(iso: string | undefined | null): string {
  if (!iso) return '';
  const h = parseInt((String(iso).match(/(\d+)H/i) || [])[ 1 ] || '0', 10);
  const m = parseInt((String(iso).match(/(\d+)M/i) || [])[ 1 ] || '0', 10);
  if (!h && !m) return '';
  if (h && m) return `${h}h ${m} min`;
  if (h) return `${h}h`;
  return `${m} min`;
}

function parseDurationIsoMinutes(iso: string | undefined | null): number {
  if (!iso) return 0;
  const h = parseInt((String(iso).match(/(\d+)H/i) || [])[ 1 ] || '0', 10);
  const m = parseInt((String(iso).match(/(\d+)M/i) || [])[ 1 ] || '0', 10);
  return h * 60 + m;
}

/** Convert total minutes to a human-readable time string ("30 min", "1h", "1h 30 min"). */
function minutesToTimeString(total: number): string {
  if (!total) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m} min`;
  if (h) return `${h}h`;
  return `${m} min`;
}

/**
 * Extract site-provided keywords from a JSON-LD keywords field.
 * Handles both comma-separated strings and string arrays.
 */
function extractJsonLdKeywords(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw.split(/[,;|]+/).map(k => normalizeImportText(k).trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(k => normalizeImportText(String(k)).trim()).filter(Boolean);
  }
  return [];
}

function normalizeJsonLdServings(raw: unknown): string {
  if (raw == null) return '';
  const val = Array.isArray(raw) ? raw[ 0 ] : raw;
  return normalizeImportText(String(val))
    .replace(/\s*persone?\b|\s*persona\b|\s*servings?\b|\s*portions?\b/gi, '')
    .trim();
}

/**
 * Extract plain-text instruction steps from the JSON-LD recipeInstructions value.
 * Handles: plain string, string[], HowToStep[], HowToSection[] (with nested itemListElement).
 */
function extractJsonLdInstructionSteps(raw: unknown): string[] {
  if (!raw) return [];

  if (typeof raw === 'string') {
    return raw.split(/\n+/)
      .map(line => normalizeImportText(line.replace(/^\d+[\.\)]\s*/, '')))
      .filter(Boolean);
  }

  if (!Array.isArray(raw)) return [];

  const steps: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const s = normalizeImportText(item);
      if (s) steps.push(s);
      continue;
    }
    if (!item || typeof item !== 'object') continue;

    const obj = item as Record<string, unknown>;
    const type = String(obj[ '@type' ] || '');

    if (type === 'HowToSection' || (Array.isArray(obj.itemListElement) && !obj.text)) {
      // Recurse into section items
      steps.push(...extractJsonLdInstructionSteps(obj.itemListElement));
      continue;
    }

    // HowToStep, or plain object with text/name
    const text = String(obj.text || obj.name || '').trim();
    const s = normalizeImportText(text);
    if (s) steps.push(s);
  }
  return steps;
}

/**
 * Walk a parsed JSON-LD node (or @graph array) looking for a Recipe @type.
 */
function findRecipeInJsonLdNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;

  const type = obj[ '@type' ];
  const isRecipe = Array.isArray(type)
    ? type.some(t => /recipe/i.test(String(t)))
    : /recipe/i.test(String(type || ''));
  if (isRecipe) return obj;

  // @graph pattern: {"@context":"...","@graph":[...nodes...]}
  if (Array.isArray(obj[ '@graph' ])) {
    for (const child of obj[ '@graph' ] as unknown[]) {
      const found = findRecipeInJsonLdNode(child);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Sanitize a raw JSON-LD string by escaping literal control characters that
 * appear inside string values (e.g. unescaped \n or \t inside a field value).
 * This is technically invalid JSON but common in real-world CMS output.
 * Characters outside of string values are left untouched.
 */
function sanitizeJsonLdText(json: string): string {
  let inString = false;
  let escape = false;
  let out = '';
  for (let i = 0; i < json.length; i++) {
    const ch = json[ i ];
    if (escape) { escape = false; out += ch; continue; }
    if (ch === '\\') { escape = true; out += ch; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString && ch.charCodeAt(0) < 0x20) {
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      continue; // strip other control chars silently
    }
    out += ch;
  }
  return out;
}

/**
 * Scan HTML for all <script type="application/ld+json"> blocks and return
 * the first Recipe node found, or null if none.
 * Applies JSON sanitization to handle sites that embed literal control chars
 * inside string values (technically invalid but common in CMS output).
 */
function findJsonLdRecipeNode(html: string): Record<string, unknown> | null {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(sanitizeJsonLdText(match[ 1 ].trim()));
      const nodes = Array.isArray(parsed) ? parsed : [ parsed ];
      for (const n of nodes) {
        const recipe = findRecipeInJsonLdNode(n);
        if (recipe) return recipe;
      }
    } catch {
      // malformed JSON-LD block — skip
    }
  }
  return null;
}

/**
 * Convert a validated JSON-LD Recipe node into an ImportPreviewRecipe.
 * Throws with a JSONLD_ prefixed code if required fields are missing.
 * `fallbackName` is used when the node's own name field is empty (e.g. supplied from OG title).
 */
function parseJsonLdRecipeNode(node: Record<string, unknown>, url: string, fallbackName?: string): ImportPreviewRecipe {
  const name = normalizeImportText(String(node.name || '')).trim() || fallbackName || '';
  if (!name) throw new Error('JSONLD_NO_NAME');

  const rawIngredients = Array.isArray(node.recipeIngredient) ? node.recipeIngredient : [];
  const ingredients = rawIngredients
    .map(i => normalizeImportText(String(i || '')))
    .filter(Boolean);
  if (!ingredients.length) throw new Error('JSONLD_NO_INGREDIENTS');

  const steps = extractJsonLdInstructionSteps(node.recipeInstructions);
  if (!steps.length) throw new Error('JSONLD_NO_STEPS');

  // Fix 1: sum prepTime + cookTime when totalTime is absent
  const totalMinutes = parseDurationIsoMinutes(String(node.totalTime || ''))
    || (parseDurationIsoMinutes(String(node.prepTime || '')) + parseDurationIsoMinutes(String(node.cookTime || '')));
  const time = minutesToTimeString(totalMinutes) || 'n.d.';
  const timerMinutes = totalMinutes;

  const servings = normalizeJsonLdServings(node.recipeYield) || '4';

  const rawCat = Array.isArray(node.recipeCategory)
    ? String(node.recipeCategory[ 0 ] || '')
    : String(node.recipeCategory || '');
  const category = normalizeImportCategory(
    mapCategorySignalToAppCategory(rawCat) || inferImportCategoryFromTitleAndText(name),
  );

  const domain = normalizeSourceDomain(url);
  const fullText = ingredients.join(' ') + ' ' + steps.join(' ');
  const preparationType = inferImportPreparationType(fullText, domain);

  // Fix 2: merge site-provided keywords with domain-inferred tags (deduplicated)
  const siteKeywords = extractJsonLdKeywords(node.keywords);
  const baseTags = suggestImportTags(domain, preparationType, category, name);
  const tags = [ ...new Set([ ...baseTags, ...siteKeywords ]) ];

  return buildImportedRecipe(url, {
    name,
    category,
    emoji: inferImportEmoji(category),
    time,
    servings,
    ingredients,
    steps,
    timerMinutes,
    preparationType,
    tags,
  });
}

/**
 * Given raw HTML, find and parse the first Recipe JSON-LD node.
 * Returns null if no usable structured data is found (graceful non-throw).
 * `fallbackName` is passed through to parseJsonLdRecipeNode for OG-title enrichment.
 */
export function parseJsonLdRecipeFromHtml(html: string, url: string, fallbackName?: string): ImportPreviewRecipe | null {
  const node = findJsonLdRecipeNode(html);
  if (!node) return null;
  try {
    return parseJsonLdRecipeNode(node, url, fallbackName);
  } catch {
    return null;
  }
}

// ─── WPRM / embedded plugin JSON extraction ──────────────────────────────────

/**
 * Extract a balanced JSON object starting at index `start` in `text`.
 * Returns the JSON string, or null if the object is not balanced.
 */
function extractJsonObjectAt(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[ i ];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Build an ImportPreviewRecipe from a WP Recipe Maker (WPRM) recipe object.
 * WPRM uses nested arrays: ingredients = [[{amount,unit,name,notes},...], ...]
 *                          instructions = [[{text,...},...], ...]
 * Returns null if the data is insufficient for a usable recipe.
 */
function buildWprmRecipe(
  recipe: Record<string, unknown>,
  url: string,
  metaTitle?: string,
): ImportPreviewRecipe | null {
  const name = normalizeImportText(String(recipe.name || metaTitle || '')).trim();
  if (!name) return null;

  const rawIngGroups = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const ingredients: string[] = [];
  for (const group of rawIngGroups as unknown[]) {
    if (!Array.isArray(group)) continue;
    for (const ing of group as unknown[]) {
      if (!ing || typeof ing !== 'object') continue;
      const obj = ing as Record<string, unknown>;
      const parts = [ String(obj.amount || ''), String(obj.unit || ''), String(obj.name || '') ]
        .map(s => s.trim()).filter(Boolean);
      const notes = String(obj.notes || '').trim();
      const line = parts.join(' ') + (notes ? ` (${notes})` : '');
      if (line.trim()) ingredients.push(line.trim());
    }
  }

  const rawInstrGroups = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const steps: string[] = [];
  for (const group of rawInstrGroups as unknown[]) {
    if (!Array.isArray(group)) continue;
    for (const step of group as unknown[]) {
      if (!step || typeof step !== 'object') continue;
      const text = normalizeImportText(String((step as Record<string, unknown>).text || '')).trim();
      if (text) steps.push(text);
    }
  }

  if (!ingredients.length || !steps.length) return null;

  const totalTime = typeof recipe.total_time === 'number' ? recipe.total_time : 0;
  const time = totalTime > 0 ? `${totalTime} min` : 'n.d.';
  const servings = recipe.servings != null ? String(recipe.servings) : '4';
  const rawCat = String(recipe.course || recipe.cuisine || '');
  const category = normalizeImportCategory(
    mapCategorySignalToAppCategory(rawCat) || inferImportCategoryFromTitleAndText(name),
  );
  const domain = normalizeSourceDomain(url);
  const fullText = ingredients.join(' ') + ' ' + steps.join(' ');
  const preparationType = inferImportPreparationType(fullText, domain);

  // Fix 2: extract WPRM tags (array of {name} objects or strings)
  const rawWprmTags = Array.isArray(recipe.tags) ? (recipe.tags as unknown[]) : [];
  const siteKeywords = rawWprmTags
    .map(t => {
      if (t && typeof t === 'object') return String((t as Record<string, unknown>).name || '');
      return String(t || '');
    })
    .map(s => normalizeImportText(s).trim())
    .filter(Boolean);
  const baseTags = suggestImportTags(domain, preparationType, category, name);
  const tags = [ ...new Set([ ...baseTags, ...siteKeywords ]) ];

  return buildImportedRecipe(url, {
    name,
    category,
    emoji: inferImportEmoji(category),
    time,
    servings,
    ingredients,
    steps,
    timerMinutes: totalTime,
    preparationType,
    tags,
  });
}

/**
 * Scan page HTML for WP Recipe Maker (WPRM) embedded recipe JSON.
 * WPRM inlines recipe data into `wprm_public_js_data` script variables with a
 * distinctive nested ingredient/instruction array format.
 * Returns a parsed recipe or null if no usable WPRM data is detected.
 */
export function parseWprmRecipeFromHtml(
  html: string,
  url: string,
  metaTitle?: string,
): ImportPreviewRecipe | null {
  // Pre-check: WPRM uses nested ingredient arrays — fast bail if not present
  if (!html.includes('"ingredients":[[') && !html.includes('"ingredients": [[')) return null;

  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    const content = m[ 1 ];
    if (!content.includes('"ingredients":[[') && !content.includes('"ingredients": [[')) continue;

    // Locate the wprm_public_js_data assignment and extract the JSON object
    const keyIdx = content.indexOf('wprm_public_js_data');
    const eqIdx = keyIdx >= 0 ? content.indexOf('=', keyIdx) : -1;
    const objStart = eqIdx >= 0 ? content.indexOf('{', eqIdx) : -1;
    if (objStart === -1) continue;

    const jsonStr = extractJsonObjectAt(content, objStart);
    if (!jsonStr) continue;

    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      // wprm_public_js_data nests the recipe under a "recipe" key
      const recipeData = (parsed?.recipe as Record<string, unknown> | undefined)
        ?? (parsed?.ingredients && parsed?.instructions ? parsed : null);
      if (!recipeData) continue;
      const result = buildWprmRecipe(recipeData, url, metaTitle);
      if (result) return result;
    } catch { /* malformed JS — skip */ }
  }
  return null;
}
