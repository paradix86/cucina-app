import type { PreparationType, Recipe } from '../types';

type MarkdownModuleMap = Record<string, string>;
type SectionKind = 'bimby' | 'classic' | 'full';
type DuemmeWarningCode =
  | 'DUEMME_TITLE_MISSING'
  | 'DUEMME_INGREDIENTS_MISSING'
  | 'DUEMME_STEPS_MISSING'
  | 'DUEMME_FALLBACK_SECTION_USED'
  | 'DUEMME_LOW_INGREDIENT_COUNT'
  | 'DUEMME_LOW_STEP_COUNT';

interface DuemmeQualityReport {
  score: number;
  warnings: DuemmeWarningCode[];
  sectionUsed: SectionKind;
  eligibleForSubset: boolean;
}

interface DuemmeParseResult {
  recipe: Recipe | null;
  quality: DuemmeQualityReport;
}

const duemmeRecipeModules = import.meta.glob('../content/duemme/ricette/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as MarkdownModuleMap;

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function stripMarkdown(value: string | null | undefined): string {
  return normalizeText(
    String(value || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/^#+\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'),
  );
}

function parseBlock(markdown: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Accept headings such as "## Ingredienti (Porzione Singola)" and capture until next level-2 section.
  const match = markdown.match(new RegExp(`(?:^|\\n)##\\s+${escaped}(?:[^\\n]*)\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i'));
  return match ? match[1].trim() : '';
}

function extractListLines(block: string): string[] {
  return String(block || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
    .map(line => stripMarkdown(line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '')))
    .filter(Boolean);
}

function extractNumberedSteps(block: string): string[] {
  const lines = String(block || '').split('\n');
  const steps: string[] = [];
  let current = '';

  lines.forEach(rawLine => {
    const line = rawLine.replace(/\r/g, '').trim();
    if (!line) return;
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      if (current) steps.push(stripMarkdown(current));
      current = numbered[1];
      return;
    }
    if (!current) return;
    if (/^###\s+/.test(line)) return;
    if (/^[-*•]\s+/.test(line)) {
      current += ` ${line.replace(/^[-*•]\s+/, '')}`;
      return;
    }
    if (/^[A-Za-zÀ-ÿ0-9]/.test(line)) {
      current += ` ${line}`;
    }
  });

  if (current) steps.push(stripMarkdown(current));
  return steps.filter(Boolean);
}

function extractPreparationSection(preparationBlock: string, type: Exclude<SectionKind, 'full'>): string {
  const pattern = type === 'bimby'
    ? /###\s+.*(?:🤖|bimby|tm31|tm5|tm6)[\s\S]*?(?=\n###\s+|$)/i
    : /###\s+.*(?:🍳|tradizionale|classico|classica|forno|padella)[\s\S]*?(?=\n###\s+|$)/i;
  return (preparationBlock.match(pattern) || [])[0] || '';
}

function inferPreparationType(markdown: string): PreparationType {
  if (/\*\*Compatibilit[aà]\*\*:\s*.*(?:🤖|bimby)/i.test(markdown)) return 'bimby';
  if (/###\s+.*(?:🤖|bimby|tm31|tm5|tm6)/i.test(markdown) || /\bBimby-ready\b/i.test(markdown)) return 'bimby';
  if (/air\s*fryer|friggitrice\s+ad\s+aria/i.test(markdown)) return 'airfryer';
  return 'classic';
}

function normalizeBimbyStep(step: string): string {
  const raw = stripMarkdown(step);
  const strongTag = raw.match(/^([^:]+):\s*(\d+\s*(?:sec|min))\s*\/\s*vel(?:ocit[àa])?\s*([0-9]+(?:\.[0-9]+)?)\s*$/i);
  if (strongTag) {
    return `Vel. ${strongTag[3]} · ${strongTag[2]} — ${strongTag[1]}`;
  }

  const timeMatch = raw.match(/(\d+\s*(?:sec|min))/i);
  const speedMatch = raw.match(/\bvel(?:ocit[àa])?\.?\s*([0-9]+(?:\.[0-9]+)?)/i);
  const tempMatch = raw.match(/(\d{2,3})\s*°\s*c?/i);
  if (!timeMatch && !speedMatch && !tempMatch) return raw;

  const tags: string[] = [];
  if (tempMatch) tags.push(`Temp. ${tempMatch[1]}°`);
  if (speedMatch) tags.push(`Vel. ${speedMatch[1]}`);
  if (timeMatch) tags.push(timeMatch[1].replace(/\s+/g, ' ').trim());

  const instruction = raw
    .replace(/\d+\s*(?:sec|min)/i, '')
    .replace(/\bvel(?:ocit[àa])?\.?\s*[0-9]+(?:\.[0-9]+)?/i, '')
    .replace(/\d{2,3}\s*°\s*c?/i, '')
    .replace(/^[,;:\-\s]+/, '')
    .trim();
  return instruction ? `${tags.join(' · ')} — ${instruction}` : raw;
}

function parseDuemmeRecipe(filePath: string, markdown: string): DuemmeParseResult {
  const pathMatch = filePath.match(/ricette\/([^/]+)\/([^/]+)\.md(?:\?.*)?$/);
  if (!pathMatch) {
    return {
      recipe: null,
      quality: {
        score: 0,
        warnings: ['DUEMME_TITLE_MISSING'],
        sectionUsed: 'full',
        eligibleForSubset: false,
      },
    };
  }

  const folder = pathMatch[1];
  const slug = pathMatch[2];
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const warnings: DuemmeWarningCode[] = [];
  if (!titleMatch) warnings.push('DUEMME_TITLE_MISSING');

  const categoryMatch = markdown.match(/\*\*Categoria\*\*:\s*([^\n]+)/i);
  const timeMatch = markdown.match(/\*\*Tempo preparazione\*\*:\s*([^\n]+)/i);
  const servingsMatch = markdown.match(/\*\*Porzioni\*\*:\s*([^\n]+)/i);
  const difficultyMatch = markdown.match(/\*\*Difficoltà\*\*:\s*([^\n]+)/i);

  const ingredientsBlock = parseBlock(markdown, 'Ingredienti');
  const preparationBlock = parseBlock(markdown, 'Preparazione');
  const bimbySection = extractPreparationSection(preparationBlock, 'bimby');
  const classicSection = extractPreparationSection(preparationBlock, 'classic');

  const preparationType = inferPreparationType(markdown);
  const ingredients = extractListLines(ingredientsBlock);
  let sectionUsed: SectionKind = 'full';
  let stepSource = preparationBlock;
  if (preparationType === 'bimby' && bimbySection) {
    stepSource = bimbySection;
    sectionUsed = 'bimby';
  } else if (classicSection) {
    stepSource = classicSection;
    sectionUsed = 'classic';
  } else if (bimbySection) {
    stepSource = bimbySection;
    sectionUsed = 'bimby';
  }
  if (sectionUsed === 'full') warnings.push('DUEMME_FALLBACK_SECTION_USED');

  const rawSteps = extractNumberedSteps(stepSource);
  const steps = (preparationType === 'bimby' ? rawSteps.map(normalizeBimbyStep) : rawSteps).filter(Boolean);

  if (!ingredients.length) warnings.push('DUEMME_INGREDIENTS_MISSING');
  if (!steps.length) warnings.push('DUEMME_STEPS_MISSING');
  if (ingredients.length > 0 && ingredients.length < 4) warnings.push('DUEMME_LOW_INGREDIENT_COUNT');
  if (steps.length > 0 && steps.length < 3) warnings.push('DUEMME_LOW_STEP_COUNT');
  if (!titleMatch || !ingredients.length || !steps.length) {
    return {
      recipe: null,
      quality: {
        score: Math.max(0, 100 - warnings.length * 10),
        warnings,
        sectionUsed,
        eligibleForSubset: false,
      },
    };
  }

  const timerMatch = String(timeMatch?.[1] || '').match(/(\d+)\s*min/i);
  const timerMinutes = timerMatch ? parseInt(timerMatch[1], 10) : 0;
  const folderTagMap: Record<string, string> = {
    colazioni: 'Colazioni',
    pranzi: 'Pranzi',
    cene: 'Cene',
    spuntini: 'Spuntini',
  };
  const folderMealOccasionMap: Record<string, string[]> = {
    colazioni: ['Colazione'],
    pranzi: ['Pranzo'],
    cene: ['Cena'],
    spuntini: ['Spuntino'],
  };

  const uniqueTags = Array.from(new Set([
    'Piano Alimentare',
    'duemme/piano_alimentare',
    folderTagMap[folder] || folder,
    preparationType === 'bimby' ? 'Bimby' : (preparationType === 'airfryer' ? 'Air Fryer' : 'Classiche'),
  ]));

  const scoreDeductions: Partial<Record<DuemmeWarningCode, number>> = {
    DUEMME_TITLE_MISSING: 50,
    DUEMME_INGREDIENTS_MISSING: 35,
    DUEMME_STEPS_MISSING: 35,
    DUEMME_FALLBACK_SECTION_USED: 8,
    DUEMME_LOW_INGREDIENT_COUNT: 10,
    DUEMME_LOW_STEP_COUNT: 10,
  };
  const score = warnings.reduce((acc, warning) => acc - (scoreDeductions[warning] || 0), 100);
  const finalScore = Math.max(0, score);
  const eligibleForSubset = finalScore >= 82
    && !warnings.includes('DUEMME_FALLBACK_SECTION_USED')
    && !warnings.includes('DUEMME_LOW_INGREDIENT_COUNT')
    && !warnings.includes('DUEMME_LOW_STEP_COUNT');

  return {
    recipe: {
      id: `duemme-${folder}-${slug}`,
      name: stripMarkdown(titleMatch[1]),
      category: stripMarkdown(categoryMatch?.[1] || folderTagMap[folder] || ''),
      emoji: preparationType === 'bimby' ? '🤖' : '🍴',
      time: stripMarkdown(timeMatch?.[1] || ''),
      servings: stripMarkdown(servingsMatch?.[1] || '1').replace(/\s*\(.+\)\s*$/, '').trim(),
      difficolta: stripMarkdown(difficultyMatch?.[1] || ''),
      ingredients,
      steps,
      timerMinutes,
      source: 'web',
      sourceDomain: 'github.com',
      preparationType,
      bimby: preparationType === 'bimby',
      tags: uniqueTags,
      mealOccasion: folderMealOccasionMap[folder] || [],
    },
    quality: {
      score: finalScore,
      warnings,
      sectionUsed,
      eligibleForSubset,
    },
  };
}

const DUEMME_RECIPE_PACK: Recipe[] = Object.entries(duemmeRecipeModules)
  .map(([path, raw]) => parseDuemmeRecipe(path, raw).recipe)
  .filter((recipe): recipe is Recipe => Boolean(recipe));

export { DUEMME_RECIPE_PACK, parseDuemmeRecipe, extractListLines, extractNumberedSteps, inferPreparationType, normalizeText, stripMarkdown };
