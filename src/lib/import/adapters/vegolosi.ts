import type { ImportPreviewRecipe, WebsiteImportAdapter } from '../../../types';
import { normalizeSourceDomain } from '../core';
import {
  normalizeImportText,
  stripImportMarkdownNoise,
  stripImportLinksAndImages,
  normalizeImportCategory,
  extractNearbyCategorySignal,
  inferImportCategoryFromTitleAndText,
  inferImportEmoji,
  normalizeImportedServings,
  suggestImportTags,
  buildImportedRecipe,
} from './utils';

function cleanVegolosititle(title: string): string {
  return stripImportMarkdownNoise(title)
    .replace(/\s*-\s*Ricetta(?:e)?\s+(?:vegan|vegane)\s*-?.*$/i, '')
    .replace(/\s*-\s*Vegolosi\.it\s*$/i, '')
    .trim();
}

function parseVegolositAdapter(markdown: string, url: string): ImportPreviewRecipe {
  const md = normalizeImportText(markdown);
  const titleMatch = md.match(/^#\s+(.+)$/m);

  // Servings: old "**Dosi per: N persone**" or new "**Ingredienti per N persone:**"
  const servingsMatch =
    md.match(/\*\*Dosi per:\*\*\s*([^\n]+person[ae]?)/i) ||
    md.match(/\*\*Ingredienti per\s+([^*\n]+?)(?:\s*person[ae]?)?\*\*/i);

  // Section starts: support both old h3 headings and new bold-text markers
  const ingredientsStart =
    md.search(/^###\s+Ingredienti\b/m) >= 0
      ? md.search(/^###\s+Ingredienti\b/m)
      : md.search(/^\*\*Ingredienti\b[^*]*\*\*/m);

  const stepsStart =
    md.search(/^###\s+Si cucina\b/m) >= 0
      ? md.search(/^###\s+Si cucina\b/m)
      : md.search(/^###\s+Preparazione\b/m) >= 0
        ? md.search(/^###\s+Preparazione\b/m)
        : md.search(/^\*\*Preparazione\*\*/m);

  if (!titleMatch || ingredientsStart === -1 || stepsStart === -1) {
    throw new Error('VEGOLOSI_PARSE_INCOMPLETE');
  }

  const conservStart = md.search(/^###\s+Conservazione\b/m);

  // End of steps: use h3 boundary, or first noise marker, or end of string
  const noiseMarkers = [
    'Iscriviti alla newsletter',
    'link di affiliazione',
    'Tag: [',
  ].map(m => md.indexOf(m, stepsStart)).filter(i => i >= 0);
  const stepsEnd =
    conservStart >= 0
      ? conservStart
      : noiseMarkers.length > 0
        ? Math.min(...noiseMarkers)
        : md.length;

  const ingredientBlock = md.slice(ingredientsStart, stepsStart);

  // Try bullet list first (old format), fall back to plain text lines (new format)
  let ingredients = ingredientBlock
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('*') && !(/^\*\*[^*]+\*\*$/.test(line)))
    .map(line => {
      const raw = stripImportLinksAndImages(line.replace(/^\*\s+/, '').trim());
      return raw.replace(/^(\d+)([A-Za-zÀ-ÿ])/, '$1 $2');
    })
    .filter(Boolean);

  if (!ingredients.length) {
    // New format: plain text lines (skip bold headers and markdown headings)
    ingredients = ingredientBlock
      .split('\n')
      .map(line => line.trim())
      .filter(line =>
        line.length > 0 &&
        !line.startsWith('#') &&
        !(/^\*\*[^*]+\*\*$/.test(line)),
      )
      .map(line => {
        const raw = stripImportLinksAndImages(line.replace(/\*\*/g, '').trim());
        return raw.replace(/^(\d+)([A-Za-zÀ-ÿ])/, '$1 $2');
      })
      .filter(Boolean);
  }

  // Step section names to skip as pseudo-headers (not real steps)
  const STEP_SECTION_HEADERS = /^(Preparazione|Si cucina|Cottura)\s*:?\s*$/i;

  const stepsRaw = md.slice(stepsStart, stepsEnd);
  const lines = stepsRaw.split('\n');
  const steps: string[] = [];
  let currentStep = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (currentStep) {
        const cleaned = stripImportLinksAndImages(currentStep);
        if (cleaned) steps.push(cleaned);
        currentStep = '';
      }
      continue;
    }

    // Skip markdown headings and image markers
    if (line.startsWith('#') || line.startsWith('Image ')) {
      if (currentStep) {
        const cleaned = stripImportLinksAndImages(currentStep);
        if (cleaned) steps.push(cleaned);
        currentStep = '';
      }
      continue;
    }

    // Skip **Step N** markers (just delimiters, not content)
    if (/^\*\*Step\s+\d+\*\*/.test(line)) {
      if (currentStep) {
        const cleaned = stripImportLinksAndImages(currentStep);
        if (cleaned) steps.push(cleaned);
        currentStep = '';
      }
      continue;
    }

    // Skip section-name bold headers (Preparazione, Si cucina, Cottura)
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      const inner = line.replace(/\*\*/g, '').trim();
      if (STEP_SECTION_HEADERS.test(inner)) {
        if (currentStep) {
          const cleaned = stripImportLinksAndImages(currentStep);
          if (cleaned) steps.push(cleaned);
          currentStep = '';
        }
        continue;
      }
    }

    // Accumulate paragraph text (strip stray ** bold markers)
    const content = line.replace(/\*\*/g, '').trim();
    currentStep += (currentStep ? ' ' : '') + content;
  }

  if (currentStep) {
    const cleaned = stripImportLinksAndImages(currentStep);
    if (cleaned) steps.push(cleaned);
  }

  if (!ingredients.length || !steps.length) throw new Error('VEGOLOSI_PARSE_INCOMPLETE');

  const cleanTitle = cleanVegolosititle(titleMatch[ 1 ]);
  const localCategory = extractNearbyCategorySignal(md, cleanTitle);
  const category = normalizeImportCategory(localCategory || inferImportCategoryFromTitleAndText(cleanTitle, stepsRaw));
  const servings = servingsMatch ? normalizeImportedServings(servingsMatch[ 1 ], '4') : '4';
  const domain = normalizeSourceDomain(url);

  return buildImportedRecipe(url, {
    name: cleanTitle,
    category,
    emoji: inferImportEmoji(category),
    ingredients,
    steps,
    servings,
    preparationType: 'classic',
    tags: suggestImportTags(domain, 'classic', category, cleanTitle),
  });
}

export const vegolosiAdapter: WebsiteImportAdapter = {
  domain: 'vegolosi.it',
  parse: parseVegolositAdapter,
};
