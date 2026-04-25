import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import type { Recipe, PreparationType } from '../types';

export const SHARE_SCHEMA_VERSION = 1;

const MAX_SHARE_URL_LEN = 8000;
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

/** Pure decode + validate. Returns null for any invalid/unsafe input. */
export function decodeShareData(data: unknown): SharedRecipePayload | null {
  if (typeof data !== 'string') return null;
  if (data.length > MAX_ENCODED_DATA_LEN) return null;
  try {
    const json = decompressFromEncodedURIComponent(data);
    if (!json) return null;
    const raw = JSON.parse(json) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (raw['v'] !== SHARE_SCHEMA_VERSION) return null;
    if (typeof raw['name'] !== 'string' || !raw['name'].trim()) return null;
    if (!isStrArray(raw['ingredients']) || (raw['ingredients'] as string[]).length === 0) return null;
    if (!isStrArray(raw['steps']) || (raw['steps'] as string[]).length === 0) return null;

    const payload: SharedRecipePayload = {
      v: 1,
      name: clampStr(raw['name'], 200),
      ingredients: sanitizeStrArray(raw['ingredients'], 100, 500),
      steps: sanitizeStrArray(raw['steps'], 100, 2000),
    };
    if (typeof raw['category'] === 'string') payload.category = clampStr(raw['category'], 100);
    if (typeof raw['emoji'] === 'string') payload.emoji = clampStr(raw['emoji'], 10);
    if (typeof raw['time'] === 'string') payload.time = clampStr(raw['time'], 50);
    if (typeof raw['servings'] === 'string') payload.servings = clampStr(raw['servings'], 20);
    if (typeof raw['preparationType'] === 'string' && VALID_PREP_TYPES.has(raw['preparationType'])) {
      payload.preparationType = raw['preparationType'] as PreparationType;
    }
    if (typeof raw['timerMinutes'] === 'number' && raw['timerMinutes'] > 0 && raw['timerMinutes'] < 1440) {
      payload.timerMinutes = Math.floor(raw['timerMinutes']);
    }
    if (typeof raw['notes'] === 'string') payload.notes = clampStr(raw['notes'], 2000);
    const coverUrl = sanitizeCoverImageUrl(raw['coverImageUrl']);
    if (coverUrl) payload.coverImageUrl = coverUrl;
    if (isStrArray(raw['tags'])) payload.tags = sanitizeStrArray(raw['tags'], 20, 50);

    return payload;
  } catch {
    return null;
  }
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
