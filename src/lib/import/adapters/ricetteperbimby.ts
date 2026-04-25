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
  extractBimbyTaggedStep,
} from './utils';

// ─── Heading detection patterns ───────────────────────────────────────────────

const RPB_INGREDIENT_HEADING_RE = /^#{1,3}\s+Ingredienti\s*$/mi;
// Accepts "Come fare/preparare/cucinare …", "Procedimento", "Preparazione" as steps headings
const RPB_STEPS_HEADING_RE = /^#{1,3}\s+(?:Come (?:fare|preparare|cucinare)|Procedimento|Preparazione)\b/mi;
// Promo/site sections where extraction must stop
const RPB_STEPS_STOP_RE = /^#{1,4}\s+(?:Ti potrebbe interessare|Accessori|Condividi|Scarica|I nostri social|In evidenza|Più popolari)/mi;
// Useful extra sections to capture into notes
const RPB_NOTES_HEADING_RE = /^#{1,3}\s+(Consigli|Come conservare|Conservazione|Note)\s*$/i;
const RPB_ANY_HEADING_RE = /^#{1,4}\s+/;

// ─── Title extraction ─────────────────────────────────────────────────────────

function cleanRicettePerBimbyTitle(title: string): string {
  return stripImportMarkdownNoise(title).replace(/\s*-\s*Ricette Bimby\s*$/i, '').trim();
}

function extractRpbTitle(md: string, url: string): string {
  // 1. First H1 in the document
  const h1Match = md.match(/^#\s+(.+)$/m);
  if (h1Match) {
    const cleaned = cleanRicettePerBimbyTitle(h1Match[1]);
    if (cleaned.length > 0) return cleaned;
  }

  // 2. Title: metadata line (Jina sometimes omits the H1)
  const titleMetaMatch = md.match(/^Title:\s*(.+)$/m);
  if (titleMetaMatch) {
    const cleaned = cleanRicettePerBimbyTitle(titleMetaMatch[1]);
    if (cleaned.length > 0) return cleaned;
  }

  // 3. URL slug fallback — humanize the last path segment
  const slugMatch = url.match(/\/([^\/\?#]+)\/?(?:\?.*)?$/);
  if (slugMatch) {
    return slugMatch[1]
      .replace(/-bimby$/i, '')
      .replace(/-/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return '';
}

// ─── Notes extraction (RPB-only) ──────────────────────────────────────────────

/**
 * Scans the document from stepsStart and collects recipe-specific extra
 * sections (Consigli, Conservazione, etc.) into an array of tips.
 * Stops at promotional/site sections.
 * Does NOT affect step extraction.
 */
function extractRpbTips(md: string, stepsStart: number): ImportedRecipeTip[] {
  const section = stepsStart >= 0 ? md.slice(stepsStart) : md;
  const lines = section.split('\n');
  const tips: ImportedRecipeTip[] = [];
  let label = '';
  let content: string[] = [];

  const flush = () => {
    if (label && content.length > 0) {
      tips.push({ title: label, text: content.join(' ').trim() });
    }
    label = '';
    content = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (RPB_STEPS_STOP_RE.test(t)) { flush(); break; }

    const notesMatch = RPB_NOTES_HEADING_RE.exec(t);
    if (notesMatch) {
      flush();
      label = notesMatch[1];
      continue;
    }

    if (label) {
      if (RPB_ANY_HEADING_RE.test(t)) flush();
      else if (t) content.push(stripImportLinksAndImages(t));
    }
  }

  flush();
  return tips;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

function parseRicettePerBimbyAdapter(markdown: string, url: string): ImportPreviewRecipe {
  const md = normalizeImportText(markdown);

  // Metadata — use ^Preparazione to avoid matching ## Preparazione heading
  const difficultyMatch = md.match(/Difficoltà\s*\n+\s*([^\n]+)/i);
  const totalTimeMatch  = md.match(/Tempo totale\s*\n+\s*([^\n]+)/i);
  const prepTimeMatch   = md.match(/^Preparazione\s*\n+\s*([^\n]+)/m);
  const servingsMatch   = md.match(/Quantità\s*\n+\s*([^\n]+)/i);

  // Section detection — support heading levels 1–3
  const ingHeadingMatch = RPB_INGREDIENT_HEADING_RE.exec(md);
  const ingredientsStart = ingHeadingMatch ? md.indexOf(ingHeadingMatch[0]) : -1;

  const stepsSearchBase = ingredientsStart >= 0 ? ingredientsStart : 0;
  const stepsSlice      = md.slice(stepsSearchBase);
  const stepsHeadingMatch = RPB_STEPS_HEADING_RE.exec(stepsSlice);
  const stepsStart = stepsHeadingMatch
    ? stepsSearchBase + stepsSlice.indexOf(stepsHeadingMatch[0])
    : -1;

  // Diagnostic payload for error messages
  const headingsList = [...md.matchAll(/^#{1,4}\s+(.+)$/gm)]
    .slice(0, 8)
    .map((m) => m[0].trim())
    .join(' | ');
  const diag =
    `ingredientsFound=${ingredientsStart >= 0}, stepsFound=${stepsStart >= 0}` +
    (headingsList ? `, headings=[${headingsList}]` : '');

  if (ingredientsStart === -1 || stepsStart === -1) {
    throw new Error(`RPB_SECTIONS_NOT_FOUND — ${diag}`);
  }

  // Ingredients: only bullet/dash lines, skip prose and sub-headings
  const ingredients = md
    .slice(ingredientsStart, stepsStart)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('*') || line.startsWith('-'))
    .map((line) => line.replace(/^[*-]\s+/, '').replace(/\*\*/g, '').trim())
    .filter((text) => text.length > 0 && text.length <= 150);

  // Steps: numbered items from stepsStart, stop at promo sections
  const stepsSection = md.slice(stepsStart);
  const stopMatch    = RPB_STEPS_STOP_RE.exec(stepsSection);
  const stepsContent = stopMatch
    ? stepsSection.slice(0, stepsSection.indexOf(stopMatch[0]))
    : stepsSection;

  const steps = [...stepsContent.matchAll(/^\d+\.\s+(.*)$/gm)]
    .map((match) => extractBimbyTaggedStep(stripImportLinksAndImages(match[1])))
    .filter(Boolean);

  // Title with fallback chain
  const title = extractRpbTitle(md, url);

  if (!title || !ingredients.length || !steps.length) {
    throw new Error(
      `RPB_PARSE_INCOMPLETE — title=${JSON.stringify(title)}, ` +
      `ingredients=${ingredients.length}, steps=${steps.length}, ${diag}`,
    );
  }

  // Extra sections extraction (RPB-only: Consigli, Conservazione, etc.)
  const tips = extractRpbTips(md, stepsStart);

  const prep  = prepTimeMatch  ? prepTimeMatch[1].trim()  : '';
  const total = totalTimeMatch ? totalTimeMatch[1].trim() : '';

  const category = normalizeImportCategory(
    extractNearbyCategorySignal(md, title) || inferImportCategoryFromTitleAndText(title),
  );
  const domain = normalizeSourceDomain(url);

  return buildImportedRecipe(url, {
    name: title,
    category,
    emoji: inferImportEmoji(category),
    time: [prep, total && total !== prep ? total : ''].filter(Boolean).join(' + ') || 'n.d.',
    servings: servingsMatch ? normalizeImportedServings(servingsMatch[1], '1') : '1',
    difficolta: difficultyMatch ? difficultyMatch[1].trim() : '',
    ingredients,
    steps,
    ...(tips.length ? { importedInfo: { tips } } : {}),
    timerMinutes: parseImportMinutes(total || prep),
    preparationType: 'bimby',
    tags: suggestImportTags(domain, 'bimby', category, title),
  });
}

export const ricettePerBimbyAdapter: WebsiteImportAdapter = {
  domain: 'ricetteperbimby.it',
  parse: parseRicettePerBimbyAdapter,
};
