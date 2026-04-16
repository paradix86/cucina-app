import type { PreparationType, Recipe } from '../types';

type MarkdownModuleMap = Record<string, string>;

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
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'),
  );
}

function parseBlock(markdown: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?:\\n##\\s+|$)`, 'im'));
  return match ? match[1].trim() : '';
}

function extractListLines(block: string): string[] {
  return String(block || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => stripMarkdown(line.replace(/^- /, '')))
    .filter(Boolean);
}

function extractNumberedSteps(block: string): string[] {
  return [...String(block || '').matchAll(/^\d+\.\s+(.+)$/gm)]
    .map(match => stripMarkdown(match[1]))
    .filter(Boolean);
}

function inferPreparationType(markdown: string): PreparationType {
  if (/###\s+🤖\s+Metodo Bimby/i.test(markdown) || /\bBimby-ready\b/i.test(markdown)) return 'bimby';
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

function buildDuemmeRecipe(filePath: string, markdown: string): Recipe | null {
  const pathMatch = filePath.match(/ricette\/([^/]+)\/([^/]+)\.md$/);
  if (!pathMatch) return null;
  const folder = pathMatch[1];
  const slug = pathMatch[2];
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (!titleMatch) return null;

  const categoryMatch = markdown.match(/\*\*Categoria\*\*:\s*([^\n]+)/i);
  const timeMatch = markdown.match(/\*\*Tempo preparazione\*\*:\s*([^\n]+)/i);
  const servingsMatch = markdown.match(/\*\*Porzioni\*\*:\s*([^\n]+)/i);
  const difficultyMatch = markdown.match(/\*\*Difficoltà\*\*:\s*([^\n]+)/i);

  const ingredientsBlock = parseBlock(markdown, 'Ingredienti');
  const preparationBlock = parseBlock(markdown, 'Preparazione');
  const bimbySection = (preparationBlock.match(/###\s+🤖[\s\S]*?(?=\n###\s+|$)/i) || [])[0] || '';
  const classicSection = (preparationBlock.match(/###\s+🍳[\s\S]*?(?=\n###\s+|$)/i) || [])[0] || '';

  const preparationType = inferPreparationType(markdown);
  const ingredients = extractListLines(ingredientsBlock);
  const rawSteps = extractNumberedSteps(
    preparationType === 'bimby' && bimbySection
      ? bimbySection
      : (classicSection || preparationBlock),
  );
  const steps = (preparationType === 'bimby' ? rawSteps.map(normalizeBimbyStep) : rawSteps).filter(Boolean);

  if (!ingredients.length || !steps.length) return null;

  const timerMatch = String(timeMatch?.[1] || '').match(/(\d+)\s*min/i);
  const timerMinutes = timerMatch ? parseInt(timerMatch[1], 10) : 0;
  const folderTagMap: Record<string, string> = {
    colazioni: 'Colazioni',
    pranzi: 'Pranzi',
    cene: 'Cene',
    spuntini: 'Spuntini',
  };

  return {
    id: `duemme-${folder}-${slug}`,
    name: stripMarkdown(titleMatch[1]),
    category: stripMarkdown(categoryMatch?.[1] || ''),
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
    tags: ['Piano Alimentare', 'duemme/piano_alimentare', folderTagMap[folder] || folder],
  };
}

const DUEMME_RECIPE_PACK: Recipe[] = Object.entries(duemmeRecipeModules)
  .map(([path, raw]) => buildDuemmeRecipe(path, raw))
  .filter((recipe): recipe is Recipe => Boolean(recipe));

export { DUEMME_RECIPE_PACK };
