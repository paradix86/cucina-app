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
  parseImportMinutes,
  suggestImportTags,
  buildImportedRecipe,
  extractBimbyTaggedStep,
} from './utils';

function cleanRicettePerBimbyTitle(title: string): string {
  return stripImportMarkdownNoise(title).replace(/\s*-\s*Ricette Bimby\s*$/i, '').trim();
}

function parseRicettePerBimbyAdapter(markdown: string, url: string): ImportPreviewRecipe {
  const md = normalizeImportText(markdown);
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const difficultyMatch = md.match(/Difficoltà\s*\n+\s*([^\n]+)/i);
  const totalTimeMatch = md.match(/Tempo totale\s*\n+\s*([^\n]+)/i);
  const prepTimeMatch = md.match(/Preparazione\s*\n+\s*([^\n]+)/i);
  const servingsMatch = md.match(/Quantità\s*\n+\s*([^\n]+)/i);
  const ingredientsStart = md.indexOf('## Ingredienti');
  const stepsSearchIdx = ingredientsStart >= 0 ? ingredientsStart : 0;
  const stepsRelIdx = md.slice(stepsSearchIdx).search(/^## Come (?:fare|preparare|cucinare)\b/m);
  const stepsStart = stepsRelIdx >= 0 ? stepsSearchIdx + stepsRelIdx : -1;
  if (ingredientsStart === -1 || stepsStart === -1) throw new Error('RPB_SECTIONS_NOT_FOUND');

  const ingredients = md
    .slice(ingredientsStart, stepsStart)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('*'))
    .map(line => line.replace(/^\*\s+/, '').replace(/\*\*/g, '').trim())
    .filter(text => text.length > 0 && text.length <= 150);  // skip prose/description lines

  const steps = [ ...md.slice(stepsStart).matchAll(/^\d+\.\s+(.*)$/gm) ]
    .map(match => extractBimbyTaggedStep(stripImportLinksAndImages(match[ 1 ])))
    .filter(Boolean);

  if (!titleMatch || !ingredients.length || !steps.length) throw new Error('RPB_PARSE_INCOMPLETE');

  const prep = prepTimeMatch ? prepTimeMatch[ 1 ].trim() : '';
  const total = totalTimeMatch ? totalTimeMatch[ 1 ].trim() : '';
  const cleanTitle = cleanRicettePerBimbyTitle(titleMatch[ 1 ]);
  const localCategory = extractNearbyCategorySignal(md, cleanTitle);
  const category = normalizeImportCategory(localCategory || inferImportCategoryFromTitleAndText(cleanTitle));
  const domain = normalizeSourceDomain(url);

  return buildImportedRecipe(url, {
    name: cleanTitle,
    category,
    emoji: inferImportEmoji(category),
    time: [ prep, total && total !== prep ? total : '' ].filter(Boolean).join(' + ') || 'n.d.',
    servings: servingsMatch ? normalizeImportedServings(servingsMatch[ 1 ], '1') : '1',
    difficolta: difficultyMatch ? difficultyMatch[ 1 ].trim() : '',
    ingredients,
    steps,
    timerMinutes: parseImportMinutes(total || prep),
    preparationType: 'bimby',
    tags: suggestImportTags(domain, 'bimby', category, cleanTitle),
  });
}

export const ricettePerBimbyAdapter: WebsiteImportAdapter = {
  domain: 'ricetteperbimby.it',
  parse: parseRicettePerBimbyAdapter,
};
