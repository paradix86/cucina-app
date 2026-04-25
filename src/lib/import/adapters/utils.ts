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

export function decodeImportEntities(value: string | null | undefined): string {
  return String(value || '')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&deg;/gi, '°')
    .replace(/&amp;/g, '&');
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
  return cleaned || fallback;
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
  return {
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
