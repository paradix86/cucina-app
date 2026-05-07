/**
 * adapters/utils.ts — shared text-normalization, category inference, and recipe-build
 * utilities used across all import adapters.
 *
 * No adapter-specific logic here — keep this file parser-agnostic.
 */
import { normalizeSourceDomain } from '../core';
import type { ImportPreviewRecipe, PreparationType } from '../../../types';

export type AppCategory = '' | 'Primi' | 'Secondi' | 'Dolci' | 'Antipasti' | 'Zuppe' | 'Sughi' | 'Bevande';

export function normalizeImportText(value: string | null | undefined): string {
  return (value || '')
    .replace(/\r/g, '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripImportMarkdownNoise(value: string | null | undefined): string {
  return normalizeImportText(
    (value || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\s+\d+(?:\s+\d+)*/g, match => (match.length <= 8 ? ' ' : match)),
  );
}

export function stripImportLinksAndImages(value: string | null | undefined): string {
  return normalizeImportText(
    (value || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'),
  );
}

// Common named entities. The browser's DOMParser covers all of HTML5's named
// entities, but in non-DOM environments (Node test runner, edge cases where
// the parser is stripped) we fall back to this map for the most likely
// occurrences in scraped Italian-recipe content.
const NAMED_ENTITY_FALLBACK: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  hellip: '…', mdash: '—', ndash: '–',
  eacute: 'é', egrave: 'è', agrave: 'à', ograve: 'ò', ugrave: 'ù',
  iacute: 'í', oacute: 'ó', uacute: 'ú', acirc: 'â', ecirc: 'ê',
  deg: '°',
};

function decodeWithFallback(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, ref: string) => {
    if (ref[ 0 ] === '#') {
      const isHex = ref[ 1 ] === 'x' || ref[ 1 ] === 'X';
      const code = parseInt(ref.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return full;
      try { return String.fromCodePoint(code); } catch { return full; }
    }
    return NAMED_ENTITY_FALLBACK[ ref ] ?? full;
  });
}

export function decodeImportEntities(value: string | null | undefined): string {
  const s = String(value || '');
  if (!s) return '';
  // Fast path: no entity markers, return unchanged.
  if (!/&[#a-zA-Z][^;\s]*;/.test(s)) return s;
  // Browser path: DOMParser handles every HTML5 entity correctly.
  if (typeof DOMParser !== 'undefined') {
    try {
      const decoded = new DOMParser()
        .parseFromString(s, 'text/html')
        .documentElement.textContent;
      if (decoded != null) return decoded;
    } catch {
      // Fall through to the hand-rolled fallback.
    }
  }
  return decodeWithFallback(s);
}

export function parseImportMinutes(value: string | null | undefined): number {
  const text = String(value || '');
  const hour = text.match(/(\d+)\s*h/i);
  const min = text.match(/(\d+)\s*min/i);
  const hours = hour ? parseInt(hour[ 1 ], 10) : 0;
  const minutes = min ? parseInt(min[ 1 ], 10) : 0;
  return hours * 60 + minutes;
}

export function normalizeImportCategory(category: string): AppCategory {
  return [ 'Primi', 'Secondi', 'Dolci', 'Antipasti', 'Zuppe', 'Sughi', 'Bevande' ].includes(category)
    ? (category as AppCategory)
    : '';
}

export function normalizeCategorySignal(text: string | null | undefined): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function mapCategorySignalToAppCategory(text: string | null | undefined): AppCategory {
  const normalized = normalizeCategorySignal(text);
  if (!normalized) return '';
  if (/drink|bevande|cocktail|frullat|frappe|sorbett|granite|succo|smoothie|tisane|liquori/.test(normalized)) return 'Bevande';
  if (/primo piatto|primi piatti|\bpasta\b|\briso\b|risott|gnocchi|lasagn|cannelloni/.test(normalized)) return 'Primi';
  if (/secondo piatto|secondi piatti|polpett|arrost|frittat|burger|cotolett|carne|pesce|pollo/.test(normalized)) return 'Secondi';
  if (/dolci|dessert|torte|crostat|biscott|dolcetti|gelat|semifredd|cheesecake|muffin|cupcake|plumcake|crema pasticcera|tiramisu/.test(normalized)) return 'Dolci';
  if (/antipast|bruschett|crostini|hummus|sfizi/.test(normalized)) return 'Antipasti';
  if (/zuppe|minestre|vellutat/.test(normalized)) return 'Zuppe';
  if (/sughi|salse|condiment|ragu|pesto|besciamella/.test(normalized)) return 'Sughi';
  return '';
}

export function getLastImportHeadingIndex(markdown: string, title: string): number {
  const lines = markdown.split('\n').map(line => line.trim());
  const cleanTitle = normalizeCategorySignal(stripImportLinksAndImages(title));
  let found = -1;
  lines.forEach((line, index) => {
    if (!line.startsWith('#')) return;
    const cleanLine = normalizeCategorySignal(stripImportLinksAndImages(line.replace(/^#+\s*/, '')));
    if (cleanLine.includes(cleanTitle)) found = index;
  });
  return found;
}

export function extractNearbyCategorySignal(markdown: string, title: string): AppCategory {
  const lines = markdown.split('\n').map(line => line.trim());
  const headingIdx = getLastImportHeadingIndex(markdown, title);
  if (headingIdx === -1) return '';

  const start = Math.max(0, headingIdx - 18);
  const nearby = lines
    .slice(start, headingIdx)
    .map(line => stripImportLinksAndImages(line))
    .filter(line => line && !/^men[uù]$/i.test(line));

  for (let i = nearby.length - 1; i >= 0; i -= 1) {
    const mapped = mapCategorySignalToAppCategory(nearby[ i ]);
    if (mapped) return mapped;
  }
  return '';
}

export function inferImportCategoryFromTitleAndText(title: string, text = ''): AppCategory {
  return normalizeImportCategory(mapCategorySignalToAppCategory(`${title}\n${text}`));
}

export function inferImportEmoji(category: AppCategory): string {
  switch (category) {
    case 'Primi': return '🍝';
    case 'Secondi': return '🍽️';
    case 'Dolci': return '🍰';
    case 'Antipasti': return '🥗';
    case 'Zuppe': return '🥣';
    case 'Sughi': return '🍅';
    case 'Bevande': return '🥤';
    default: return '🍴';
  }
}

export function normalizeImportedServings(text: string | null | undefined, fallback = '1'): string {
  const cleaned = normalizeImportText(text)
    .replace(/\s*persone?\b/gi, '')
    .replace(/\s*persona\b/gi, '')
    .trim();
  if (!cleaned) return fallback;
  // If a non-numeric suffix remains (e.g. "12 Tamales", "6 porzioni"), keep only the leading number.
  const numMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)/);
  return numMatch ? numMatch[1] : cleaned;
}

export function inferImportPreparationType(text: string, domain: string): PreparationType {
  if (domain === 'ricetteperbimby.it') return 'bimby';
  if (domain === 'ricette-bimby.net') return 'bimby';
  const lower = text.toLowerCase();
  if (/\bbimby\b|tm[56]\b|tm31\b|varoma\b|nel boccale|vel\./.test(lower)) return 'bimby';
  if (/air\s*fryer|friggitrice\s+ad\s+aria|\bcestello\b/.test(lower)) return 'airfryer';
  return 'classic';
}

export const DOMAIN_TAG_MAP: Record<string, string> = {
  'giallozafferano.it': 'GialloZafferano',
  'ricetteperbimby.it': 'RicettePerBimby',
  'ricette-bimby.net': 'Ricette Bimby',
};

export function suggestImportTags(
  domain: string | undefined,
  preparationType: PreparationType | undefined,
  category: string | undefined,
  name: string | undefined,
): string[] {
  const tags: string[] = [];
  const domainTag = domain ? DOMAIN_TAG_MAP[ domain ] : '';
  if (domainTag) tags.push(domainTag);
  if (preparationType === 'bimby') tags.push('Bimby');
  if (preparationType === 'airfryer') tags.push('Air Fryer');
  if (/frullat|frapp[eé]|smoothie|succo\b|bevanda|cocktail|granita|sorbett/i.test(name || '')) tags.push('Drink');
  return tags;
}

export function buildImportedRecipe(url: string, fields: Partial<ImportPreviewRecipe>): ImportPreviewRecipe {
  const merged: ImportPreviewRecipe = {
    id: `imp_${Date.now()}`,
    name: '',
    category: '',
    emoji: '🍴',
    time: 'n.d.',
    servings: '4',
    difficolta: '',
    ingredients: [],
    steps: [],
    timerMinutes: 0,
    preparationType: 'classic',
    source: 'web',
    sourceDomain: normalizeSourceDomain(url),
    url,
    coverImageUrl: '',
    tags: [],
    ...fields,
  };
  // Chokepoint: decode HTML entities for every text field that might come
  // from a parser that didn't pre-decode (JSON-LD, generic markdown, named
  // adapters). Applying it here means a future adapter can never forget.
  // Notes are user-typed and skipped. URLs are skipped (entities in URLs are
  // valid percent-encoded syntax that must not be decoded).
  merged.name = decodeImportEntities(merged.name);
  merged.ingredients = (merged.ingredients || []).map(decodeImportEntities);
  merged.steps = (merged.steps || []).map(decodeImportEntities);
  return merged;
}

/**
 * Shared Bimby step formatter — used by both ricetteperbimby and ricettebimbynet adapters.
 * Extracts temperature/speed/time tags and formats the step as "Tags — instruction".
 */
export function extractBimbyTaggedStep(stepText: string): string {
  const text = decodeImportEntities(stripImportLinksAndImages(stepText))
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';

  const tags: string[] = [];
  const timeMatch = text.match(/(\d+\s*(?:sec(?:ondo|ondi)?|min(?:uto|uti)?|sec|min)\.?\b)/i);
  const speedMatch = text.match(/\bvel\.?\s*([0-9]+(?:\.[0-9]+)?)/i);
  const tempMatch = text.match(/(?:\btemp\.?\s*|\b)(\d{2,3})\s*°\s*[cf]?/i);
  const varomaMatch = text.match(/\btemp(?:eratura)?\.?\s*Varoma\b/i);

  if (tempMatch) tags.push(`Temp. ${tempMatch[ 1 ]}°`);
  else if (varomaMatch) tags.push('Varoma');
  if (speedMatch) tags.push(`Vel. ${speedMatch[ 1 ]}`);
  if (timeMatch) {
    const normalizedTime = timeMatch[ 1 ]
      .replace(/(?:sec(?:ondo|ondi)?|sec)\.?/i, 'sec')
      .replace(/(?:min(?:uto|uti)?|min)\.?/i, 'min')
      .replace(/\s+/g, ' ')
      .trim();
    tags.push(normalizedTime);
  }

  if (!tags.length) return text;

  let instruction = text;
  let previousInstruction: string;
  do {
    previousInstruction = instruction;
    instruction = instruction
      .replace(/(\d+\s*(?:sec(?:ondo|ondi)?|min(?:uto|uti)?|sec|min)\.?\b)/i, '')
      .replace(/\bvel\.?\s*[0-9]+(?:\.[0-9]+)?/i, '')
      .replace(/(?:\btemp\.?\s*|\b)\d{2,3}\s*°\s*[cf]?/i, '')
      .replace(/\btemp(?:eratura)?\.?\s*Varoma\b/i, '')
      .replace(/^[,;:\-\s]+/, '')
      .replace(/\s*[,;:]+\s*\.\s*$/, '.')  // clean trailing ": ." artifacts e.g. "emulsionare: ." → "emulsionare."
      .replace(/\s{2,}/g, ' ')
      .trim();
  } while (instruction !== previousInstruction);

  const safeInstruction = instruction || text;
  return `${tags.join(' · ')} — ${safeInstruction}`;
}
