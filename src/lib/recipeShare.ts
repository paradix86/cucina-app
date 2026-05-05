import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import type { Recipe, PreparationType } from '../types';

export const SHARE_SCHEMA_VERSION = 1;

const MAX_SHARE_URL_LEN = 1600;
const MAX_ENCODED_DATA_LEN = 12000;

export interface SharedRecipePayload {
  v: 1;
  name: string;
  category?: string;
  emoji?: string;
  time?: string;
  servings?: string;
  preparationType?: PreparationType;
  ingredients: string[];
  steps: string[];
  timerMinutes?: number;
  notes?: string;
  coverImageUrl?: string;
  tags?: string[];
}

function sanitizeCoverImageUrl(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

function clampStr(value: unknown, maxLen: number): string {
  const s = String(value ?? '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function sanitizeStrArray(arr: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return (arr as unknown[])
    .slice(0, maxItems)
    .map(item => clampStr(item, maxItemLen))
    .filter(Boolean);
}

function isStrArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && (arr as unknown[]).every(item => typeof item === 'string');
}

function buildPayload(recipe: Recipe): SharedRecipePayload {
  const payload: SharedRecipePayload = {
    v: 1,
    name: (recipe.name || '').trim(),
    ingredients: (recipe.ingredients || []).filter(Boolean),
    steps: (recipe.steps || []).filter(Boolean),
  };
  if (recipe.category?.trim()) payload.category = recipe.category.trim();
  if (recipe.emoji?.trim()) payload.emoji = recipe.emoji.trim();
  if (recipe.time?.trim()) payload.time = recipe.time.trim();
  if (recipe.servings) payload.servings = String(recipe.servings).trim();
  if (recipe.preparationType) payload.preparationType = recipe.preparationType;
  if (recipe.timerMinutes && recipe.timerMinutes > 0) payload.timerMinutes = recipe.timerMinutes;
  if (recipe.notes?.trim()) payload.notes = recipe.notes.trim();
  const coverUrl = sanitizeCoverImageUrl(recipe.coverImageUrl);
  if (coverUrl) payload.coverImageUrl = coverUrl;
  if (recipe.tags?.length) payload.tags = recipe.tags.slice(0, 20);
  return payload;
}

/** Pure encode — no browser APIs. Use buildShareUrl() in browser context. */
export function encodeSharePayload(recipe: Recipe): string {
  return compressToEncodedURIComponent(JSON.stringify(buildPayload(recipe)));
}

/** Build the full share URL. Requires browser (window + import.meta.env). */
export function buildShareUrl(recipe: Recipe): { url: string } | { error: 'too_long' } {
  const encoded = encodeSharePayload(recipe);
  const base = (import.meta.env.BASE_URL as string | undefined) || '/cucina-app/';
  const url = `${window.location.origin}${base}#/shared-recipe?data=${encoded}`;
  if (url.length > MAX_SHARE_URL_LEN) return { error: 'too_long' };
  return { url };
}

const VALID_PREP_TYPES = new Set<string>(['classic', 'bimby', 'airfryer']);

function validateAndSanitizePayload(raw: unknown): SharedRecipePayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj['v'] !== SHARE_SCHEMA_VERSION) return null;
  if (typeof obj['name'] !== 'string' || !obj['name'].trim()) return null;
  if (!isStrArray(obj['ingredients']) || (obj['ingredients'] as string[]).length === 0) return null;
  if (!isStrArray(obj['steps']) || (obj['steps'] as string[]).length === 0) return null;

  const payload: SharedRecipePayload = {
    v: 1,
    name: clampStr(obj['name'], 200),
    ingredients: sanitizeStrArray(obj['ingredients'], 100, 500),
    steps: sanitizeStrArray(obj['steps'], 100, 2000),
  };
  if (typeof obj['category'] === 'string') payload.category = clampStr(obj['category'], 100);
  if (typeof obj['emoji'] === 'string') payload.emoji = clampStr(obj['emoji'], 10);
  if (typeof obj['time'] === 'string') payload.time = clampStr(obj['time'], 50);
  if (typeof obj['servings'] === 'string') payload.servings = clampStr(obj['servings'], 20);
  if (typeof obj['preparationType'] === 'string' && VALID_PREP_TYPES.has(obj['preparationType'])) {
    payload.preparationType = obj['preparationType'] as PreparationType;
  }
  if (typeof obj['timerMinutes'] === 'number' && obj['timerMinutes'] > 0 && obj['timerMinutes'] < 1440) {
    payload.timerMinutes = Math.floor(obj['timerMinutes']);
  }
  if (typeof obj['notes'] === 'string') payload.notes = clampStr(obj['notes'], 2000);
  const coverUrl = sanitizeCoverImageUrl(obj['coverImageUrl']);
  if (coverUrl) payload.coverImageUrl = coverUrl;
  if (isStrArray(obj['tags'])) payload.tags = sanitizeStrArray(obj['tags'], 20, 50);

  return payload;
}

/** Pure decode + validate. Returns null for any invalid/unsafe input.
 *  Tries lz-string decompression first, then base64url plain-JSON as a fallback
 *  for backward compatibility with any links generated before compression was added.
 */
export function decodeShareData(data: unknown): SharedRecipePayload | null {
  if (typeof data !== 'string') return null;
  if (data.length > MAX_ENCODED_DATA_LEN) return null;

  // Primary: lz-string compressed
  try {
    const json = decompressFromEncodedURIComponent(data);
    if (json) {
      const result = validateAndSanitizePayload(JSON.parse(json));
      if (result) return result;
    }
  } catch { /* fall through to legacy path */ }

  // Legacy fallback: plain base64url-encoded JSON
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    if (json) {
      const result = validateAndSanitizePayload(JSON.parse(json));
      if (result) return result;
    }
  } catch { /* not base64url either */ }

  return null;
}

/** Convert a validated payload to a full Recipe for saving. */
export function sharedPayloadToRecipe(payload: SharedRecipePayload, id: string): Recipe {
  return {
    id,
    name: payload.name,
    category: payload.category ?? '',
    emoji: payload.emoji ?? '🍴',
    time: payload.time ?? '',
    servings: payload.servings ?? '',
    preparationType: payload.preparationType ?? 'classic',
    bimby: payload.preparationType === 'bimby',
    source: 'shared',
    ingredients: payload.ingredients,
    steps: payload.steps,
    timerMinutes: payload.timerMinutes ?? 0,
    notes: '',
    favorite: false,
    lastViewedAt: 0,
    tags: payload.tags ?? [],
    coverImageUrl: payload.coverImageUrl,
  };
}
