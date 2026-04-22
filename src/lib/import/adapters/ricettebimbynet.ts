import type { ImportPreviewRecipe, WebsiteImportAdapter } from '../../../types';
import { normalizeSourceDomain } from '../core';
import {
  normalizeImportText,
  stripImportMarkdownNoise,
  stripImportLinksAndImages,
  decodeImportEntities,
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

function cleanRicetteBimbyNetTitle(title: string): string {
  return stripImportMarkdownNoise(decodeImportEntities(title))
    .replace(/\s*-\s*Ricette[-\s]*Bimby\s*$/i, '')
    .trim();
}

function foldStandaloneParentheticalNotes(steps: string[]): string[] {
  return steps.reduce<string[]>((acc, step) => {
    const trimmed = step.trim();
    if (/^\([^()]+\)\.?$/.test(trimmed) && acc.length) {
      acc[acc.length - 1] = `${acc[acc.length - 1]} ${trimmed}`.replace(/\s+/g, ' ').trim();
      return acc;
    }
    acc.push(trimmed);
    return acc;
  }, []);
}

function restorePerLatoTiming(step: string, rawStep: string): string {
  const perSideMatch = rawStep.match(/(\d+\s*(?:sec(?:ondi?)?\.?|min(?:uti?)?\.?))\s+per lato/i);
  if (!perSideMatch || !step.includes('—') || !/\bper lato\b/i.test(step)) return step;
  const normalizedTime = perSideMatch[1]
    .replace(/sec(?:ondi?)?\.?/i, 'sec')
    .replace(/min(?:uti?)?\.?/i, 'min')
    .replace(/\s+/g, ' ')
    .trim();

  const [tagPart, textPart] = step.split(' — ');
  if (!textPart || new RegExp(`${normalizedTime}\\s+per lato`, 'i').test(textPart)) return step;

  const patchedText = textPart.replace(/\blasciare cuocere\s+per lato\b/i, `lasciare cuocere ${normalizedTime} per lato`);
  return `${tagPart} — ${patchedText}`.replace(/\s+/g, ' ').trim();
}

function parseRicetteBimbyNetAdapter(markdown: string, url: string): ImportPreviewRecipe {
  const md = normalizeImportText(markdown);
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const totalTimeMatch = md.match(/Tempo totale\s*\n+\s*([^\n]+)/i);
  const servingsMatch = md.match(/Porzioni\s*\n+\s*([^\n]+)/i);

  const ingredientsStart = md.search(/^###?\s+Ingredienti\b/m);
  const prepStart = md.search(/^###?\s+Preparazione\b/m);
  if (ingredientsStart === -1 || prepStart === -1 || prepStart <= ingredientsStart) {
    throw new Error('RBN_SECTIONS_NOT_FOUND');
  }

  const ingredients = md
    .slice(ingredientsStart, prepStart)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('*'))
    .map(line => line.replace(/^\*\s+/, '').replace(/\*\*/g, '').trim())
    .map(line => stripImportLinksAndImages(decodeImportEntities(line)))
    .filter(Boolean);

  const prepTail = md.slice(prepStart);
  const prepEndRel = prepTail.search(/^###?\s+(?:Note|Commenti|Lascia un commento|Articoli correlati)\b/m);
  const prepBlock = prepEndRel >= 0 ? prepTail.slice(0, prepEndRel) : prepTail;
  let currentSection = '';
  const steps = foldStandaloneParentheticalNotes(prepBlock
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .reduce<string[]>((acc, rawLine) => {
      const line = decodeImportEntities(rawLine);
      const sectionMatch = line.match(/^###\s+(.*)/);
      if (sectionMatch) {
        currentSection = stripImportLinksAndImages(sectionMatch[ 1 ]).replace(/:$/, '').trim();
        return acc;
      }
      const stepMatch = line.match(/^\d+\.\s+(.*)$/);
      if (!stepMatch) return acc;
      // Strip leading step-counter digit that some sites embed in the step text itself
      // e.g. markdown "1. 1 Mettere nel boccale..." → strip the inner "1 "
      const rawStep = stepMatch[ 1 ].replace(/^\d{1,2}\s+(?=[A-Za-zÀ-ÿ(])/, '');
      const cleaned = restorePerLatoTiming(extractBimbyTaggedStep(rawStep), rawStep);
      if (!cleaned) return acc;
      // "Preparazione" is the default main cooking section — prefix adds no value
      const contextSection = currentSection && !/^preparazione$/i.test(currentSection) ? currentSection : '';
      const dashIdx = cleaned.indexOf(' — ');
      if (dashIdx !== -1) {
        const tagPart = cleaned.slice(0, dashIdx);
        const textPart = cleaned.slice(dashIdx + 3);
        const textWithContext = contextSection ? `${contextSection}: ${textPart}` : textPart;
        acc.push(`${tagPart} — ${textWithContext}`.trim());
        return acc;
      }
      acc.push(contextSection ? `${contextSection}: ${cleaned}` : cleaned);
      return acc;
    }, []));

  if (!titleMatch || !ingredients.length || !steps.length) throw new Error('RBN_PARSE_INCOMPLETE');

  const cleanTitle = cleanRicetteBimbyNetTitle(titleMatch[ 1 ]);
  const localCategory = extractNearbyCategorySignal(md, cleanTitle);
  const category = normalizeImportCategory(localCategory || inferImportCategoryFromTitleAndText(cleanTitle, prepBlock));
  const total = totalTimeMatch ? stripImportLinksAndImages(totalTimeMatch[ 1 ]).trim() : '';
  const domain = normalizeSourceDomain(url);

  return buildImportedRecipe(url, {
    name: cleanTitle,
    category,
    emoji: inferImportEmoji(category),
    time: total || 'n.d.',
    servings: servingsMatch ? normalizeImportedServings(servingsMatch[ 1 ], '1') : '1',
    ingredients,
    steps,
    timerMinutes: parseImportMinutes(total),
    preparationType: 'bimby',
    tags: suggestImportTags(domain, 'bimby', category, cleanTitle),
  });
}

export const ricetteBimbyNetAdapter: WebsiteImportAdapter = {
  domain: 'ricette-bimby.net',
  parse: parseRicetteBimbyNetAdapter,
};
