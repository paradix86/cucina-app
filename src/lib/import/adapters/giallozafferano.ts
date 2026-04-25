import type { ImportedRecipeTip, ImportPreviewRecipe, WebsiteImportAdapter } from '../../../types';
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
} from './utils';

function cleanGialloZafferanoTitle(title: string): string {
  return stripImportMarkdownNoise(title)
    .replace(/^Ricetta\s+/i, '')
    .replace(/\s*-\s*La Ricetta di GialloZafferano\s*$/i, '')
    .trim();
}

function isGialloZafferanoDeadPage(markdown: string): boolean {
  const md = normalizeImportText(markdown);
  if (!md) return false;

  const signals = [
    /(?:^|\n)Title:\s*Pagina non trovata - Le ricette di GialloZafferano(?:\n|$)/i,
    /(?:^|\n)#\s*Pagina non trovata - Le ricette di GialloZafferano(?:\n|$)/i,
    /Warning:\s*Target URL returned error 404:\s*Not Found/i,
    /(?:^|\n)##\s*ops\.\.\.\s*c['']e stato un errore(?:\n|$)/i,
  ];

  return signals.filter(pattern => pattern.test(md)).length >= 2;
}

function parseGialloZafferanoIngredients(block: string): string[] {
  const cleanedBlock = normalizeImportText(
    (block || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      // Drop long nutrition disclaimer text that may appear before real ingredient links.
      .replace(/\*\*Attenzione\.[\s\S]*?(?=(?:Per i [^\[]+)?\[[^\]]+\]\([^)]*\))/i, ' ')
      .replace(/Dati forniti da[\s\S]*?(?=(?:Per i [^\[]+)?\[[^\]]+\]\([^)]*\))/i, ' '),
  );
  const firstIngredientIdx = cleanedBlock.search(/\[[^\]]+\]\([^)]*\)/);
  if (firstIngredientIdx === -1) return [];

  return cleanedBlock
    .slice(firstIngredientIdx)
    .split(/(?=\[[^\]]+\]\([^)]*\))/g)
    .map(chunk => {
      const match = chunk.match(/^\[([^\]]+)\]\([^)]*\)\s*(.*)$/s);
      if (!match) return null;
      const name = match[ 1 ].trim();
      const rest = normalizeImportText(match[ 2 ]).replace(/\s*!+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
      if (/^(?:edamam|light|senza lattosio)$/i.test(name)) return null;
      const candidate = rest ? `${name} ${rest}`.trim() : name;
      // Reject very long prose-like chunks; ingredients are compact and quantity-oriented.
      if (candidate.length > 220 && /[.!?]/.test(candidate)) return null;
      return candidate;
    })
    .filter((v): v is string => Boolean(v));
}

function cleanGialloZafferanoHeading(heading: string): string {
  return stripImportLinksAndImages(heading)
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGialloZafferanoEditorialHeading(heading: string): boolean {
  const cleaned = cleanGialloZafferanoHeading(heading);
  return /^(?:conservazione|consiglio|sapevate che\.\.\.|sapevate che|curiosita|curiosità|ascolta la ricetta)$/i.test(cleaned);
}

// Map of useful editorial headings → display labels for notes.
// "Ascolta la ricetta" is editorial but audio-only — excluded.
const GZ_NOTES_LABEL_MAP: Record<string, string> = {
  conservazione: 'Conservazione',
  consiglio: 'Consiglio',
  'sapevate che...': 'Lo sapevate?',
  'sapevate che': 'Lo sapevate?',
  curiosita: 'Curiosità',
  curiosità: 'Curiosità',
};

/**
 * Collect useful editorial sections (Conservazione, Consiglio, etc.) that
 * come after the steps into an array of tips.  Stops at link-headings and
 * ignores "Ascolta la ricetta".
 */
function extractGzEditorialTips(
  md: string,
  sectionHeadings: Array<{ raw: string; index: number }>,
  stepsEnd: number,
): ImportedRecipeTip[] {
  const afterSteps = sectionHeadings.filter((h) => h.index >= stepsEnd);
  const tips: ImportedRecipeTip[] = [];
  for (let i = 0; i < afterSteps.length; i++) {
    const heading = afterSteps[i];
    const cleaned = cleanGialloZafferanoHeading(heading.raw).toLowerCase();
    const label = GZ_NOTES_LABEL_MAP[cleaned];
    if (!label) continue;
    const lineEnd = md.indexOf('\n', heading.index);
    if (lineEnd === -1) continue;
    const nextIdx = afterSteps[i + 1]?.index ?? md.length;
    const content = normalizeImportText(
      stripImportLinksAndImages(md.slice(lineEnd, nextIdx))
    ).trim();
    if (content) tips.push({ title: label, text: content });
  }
  return tips;
}

function isGialloZafferanoPreparationHeading(heading: string): boolean {
  const cleaned = cleanGialloZafferanoHeading(heading);
  if (!cleaned) return false;
  if (/^\[.*\]\(.*\)$/.test(heading.trim())) return false;
  if (/^come preparare\b/i.test(cleaned)) return true;
  if (/^(?:presentazione|ingredienti|ascolta la ricetta)$/i.test(cleaned)) return false;
  if (isGialloZafferanoEditorialHeading(cleaned)) return false;
  return true;
}

function cleanGialloZafferanoStep(step: string): string {
  return normalizeImportText(
    stripImportLinksAndImages(step)
      // Remove GialloZafferano inline image-reference numbers like "strutto 1,"
      // or "minuti 25." while preserving real quantities such as "160°",
      // "1 o 2 pezzi" and "4-5 minuti".
      .replace(
        /(?<=\p{L})\s+\d{1,2}(?=(?:[.,;:!?](?:\s|$)|\s+(?:e|ed|poi|quindi|infine|dopodiche|dopodiché)\b))/gu,
        '',
      )
      .replace(/\s+([.,;:!?])/g, '$1'),
  );
}

function parseGialloZafferanoAdapter(markdown: string, url: string): ImportPreviewRecipe {
  const md = normalizeImportText(markdown);
  if (isGialloZafferanoDeadPage(md)) throw new Error('GZ_PAGE_NOT_FOUND');
  const titleMatch = md.match(/^#\s+(.+)$/m) || md.match(/^Title:\s*(.+)$/m);
  const difficultyMatch = md.match(/\*\s+Difficoltà:\s+\*\*(.*?)\*\*/i);
  const prepMatch = md.match(/\*\s+Preparazione:\s+\*\*(.*?)\*\*/i);
  const cookMatch = md.match(/\*\s+Cottura:\s+\*\*(.*?)\*\*/i);
  const servingsMatch = md.match(/\*\s+Dosi per:\s+\*\*(.*?)\*\*/i);
  const ingredientsHeadingMatch = md.match(/^(?:##\s*)?INGREDIENTI\s*$/im);
  if (!ingredientsHeadingMatch || ingredientsHeadingMatch.index == null) throw new Error('GZ_INGREDIENTS_NOT_FOUND');
  const ingredientsHeadingStart = ingredientsHeadingMatch.index;
  const ingredientsStart = ingredientsHeadingStart + ingredientsHeadingMatch[ 0 ].length;

  const sectionHeadings = [ ...md.matchAll(/^##\s+(.+)$/gm) ].map(match => ({
    raw: match[ 1 ],
    index: match.index ?? -1,
  }));

  const preparationHeading = sectionHeadings.find(heading => (
    heading.index > ingredientsHeadingStart && isGialloZafferanoPreparationHeading(heading.raw)
  ));
  if (!preparationHeading || preparationHeading.index === -1) throw new Error('GZ_STEPS_NOT_FOUND');
  const stepsStart = preparationHeading.index;
  if (ingredientsStart >= stepsStart) throw new Error('GZ_INGREDIENTS_NOT_FOUND');

  let ingredientsEnd = md.indexOf('[AGGIUNGI ALLA LISTA DELLA SPESA]', ingredientsStart);
  // Some GZ pages omit the shopping-list CTA button and/or nutrition disclaimer text.
  // In those cases, use a standalone "Preparazione" marker when present, else fall back to
  // the "## Come preparare ..." heading as section boundary.
  if (ingredientsEnd === -1) {
    const prepInBlock = md.slice(ingredientsStart, stepsStart).search(/\n\s*Preparazione\s*(?:\n|$)/);
    ingredientsEnd = prepInBlock !== -1 ? ingredientsStart + prepInBlock : stepsStart;
  }
  if (ingredientsEnd <= ingredientsStart) throw new Error('GZ_INGREDIENTS_NOT_FOUND');

  const stepsEndHeading = sectionHeadings.find(heading => (
    heading.index > stepsStart && (
      isGialloZafferanoEditorialHeading(heading.raw) ||
      /^\[.*\]\(.*\)$/.test(heading.raw.trim())
    )
  ));
  const stepsEnd = stepsEndHeading?.index ?? md.length;

  const ingredients = parseGialloZafferanoIngredients(md.slice(ingredientsStart, ingredientsEnd));
  const steps = md
    .slice(stepsStart, stepsEnd)
    .split(/\n\s*\n/)
    .map(cleanGialloZafferanoStep)
    .filter(part => part && !part.startsWith('## ') && !part.startsWith('Image '))
    .filter(part => !/^Preparazione$/i.test(part));

  if (!titleMatch || !ingredients.length || !steps.length) throw new Error('GZ_PARSE_INCOMPLETE');

  const prep = prepMatch ? prepMatch[ 1 ].trim() : '';
  const cook = cookMatch ? cookMatch[ 1 ].trim() : '';
  const cleanTitle = cleanGialloZafferanoTitle(titleMatch[ 1 ]).replace(/:.*$/, '').trim();
  const localCategory = extractNearbyCategorySignal(md, cleanTitle);
  const presentationSection = (md.match(/## PRESENTAZIONE\s*\n([\s\S]*?)(?:\n##\s*|$)/i) || [])[ 1 ] || '';
  const category = normalizeImportCategory(localCategory || inferImportCategoryFromTitleAndText(cleanTitle, presentationSection));
  const domain = normalizeSourceDomain(url);
  const tips = extractGzEditorialTips(md, sectionHeadings, stepsEnd);

  return buildImportedRecipe(url, {
    name: cleanTitle,
    category,
    emoji: inferImportEmoji(category),
    time: [ prep, cook ].filter(Boolean).join(' + ') || 'n.d.',
    servings: servingsMatch ? normalizeImportedServings(servingsMatch[ 1 ], '4') : '4',
    difficolta: difficultyMatch ? difficultyMatch[ 1 ].trim() : '',
    ingredients,
    steps,
    ...(tips.length ? { importedInfo: { tips } } : {}),
    timerMinutes: parseImportMinutes(cook),
    preparationType: 'classic',
    tags: suggestImportTags(domain, 'classic', category, cleanTitle),
  });
}

export const gialloZafferanoAdapter: WebsiteImportAdapter = {
  domain: 'giallozafferano.it',
  // Also handle giallozafferano.com (international/mirror domain)
  canHandle: (url: string) => /giallozafferano\.com\//i.test(url),
  parse: parseGialloZafferanoAdapter,
};
