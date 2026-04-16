import { normalizeSourceDomain } from './core';
import type { ImportPreviewRecipe, PreparationType, WebsiteImportAdapter } from '../../types';

type AppCategory = '' | 'Primi' | 'Secondi' | 'Dolci' | 'Antipasti' | 'Zuppe' | 'Sughi' | 'Bevande';

function normalizeImportText(value: string | null | undefined): string {
  return (value || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripImportMarkdownNoise(value: string | null | undefined): string {
  return normalizeImportText(
    (value || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\s+\d+(?:\s+\d+)*/g, match => (match.length <= 8 ? ' ' : match)),
  );
}

function stripImportLinksAndImages(value: string | null | undefined): string {
  return normalizeImportText(
    (value || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'),
  );
}

function parseImportMinutes(value: string | null | undefined): number {
  const text = String(value || '');
  const hour = text.match(/(\d+)\s*h/i);
  const min = text.match(/(\d+)\s*min/i);
  const hours = hour ? parseInt(hour[1], 10) : 0;
  const minutes = min ? parseInt(min[1], 10) : 0;
  return hours * 60 + minutes;
}

function normalizeImportCategory(category: string): AppCategory {
  return ['Primi', 'Secondi', 'Dolci', 'Antipasti', 'Zuppe', 'Sughi', 'Bevande'].includes(category)
    ? (category as AppCategory)
    : '';
}

function normalizeCategorySignal(text: string | null | undefined): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function mapCategorySignalToAppCategory(text: string | null | undefined): AppCategory {
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

function getLastImportHeadingIndex(markdown: string, title: string): number {
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

function extractNearbyCategorySignal(markdown: string, title: string): AppCategory {
  const lines = markdown.split('\n').map(line => line.trim());
  const headingIdx = getLastImportHeadingIndex(markdown, title);
  if (headingIdx === -1) return '';

  const start = Math.max(0, headingIdx - 18);
  const nearby = lines
    .slice(start, headingIdx)
    .map(line => stripImportLinksAndImages(line))
    .filter(line => line && !/^men[uù]$/i.test(line));

  for (let i = nearby.length - 1; i >= 0; i -= 1) {
    const mapped = mapCategorySignalToAppCategory(nearby[i]);
    if (mapped) return mapped;
  }
  return '';
}

function inferImportCategoryFromTitleAndText(title: string, text = ''): AppCategory {
  return normalizeImportCategory(mapCategorySignalToAppCategory(`${title}\n${text}`));
}

function inferImportEmoji(category: AppCategory): string {
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

function normalizeImportedServings(text: string | null | undefined, fallback = '1'): string {
  const cleaned = normalizeImportText(text)
    .replace(/\s*persone?\b/gi, '')
    .replace(/\s*persona\b/gi, '')
    .trim();
  return cleaned || fallback;
}

function inferImportPreparationType(text: string, domain: string): PreparationType {
  if (domain === 'ricetteperbimby.it') return 'bimby';
  const lower = text.toLowerCase();
  if (/\bbimby\b|tm[56]\b|tm31\b|varoma\b|nel boccale|vel\./.test(lower)) return 'bimby';
  if (/air\s*fryer|friggitrice\s+ad\s+aria|\bcestello\b/.test(lower)) return 'airfryer';
  return 'classic';
}

const DOMAIN_TAG_MAP: Record<string, string> = {
  'giallozafferano.it': 'GialloZafferano',
  'ricetteperbimby.it': 'RicettePerBimby',
};

function suggestImportTags(
  domain: string | undefined,
  preparationType: PreparationType | undefined,
  category: string | undefined,
  name: string | undefined,
): string[] {
  const tags: string[] = [];
  const domainTag = domain ? DOMAIN_TAG_MAP[domain] : '';
  if (domainTag) tags.push(domainTag);
  if (preparationType === 'bimby') tags.push('Bimby');
  if (preparationType === 'airfryer') tags.push('Air Fryer');
  if (/frullat|frapp[eé]|smoothie|succo\b|bevanda|cocktail|granita|sorbett/i.test(name || '')) tags.push('Drink');
  return tags;
}

function buildImportedRecipe(url: string, fields: Partial<ImportPreviewRecipe>): ImportPreviewRecipe {
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
    tags: [],
    ...fields,
  };
}

function cleanGialloZafferanoTitle(title: string): string {
  return stripImportMarkdownNoise(title)
    .replace(/^Ricetta\s+/i, '')
    .replace(/\s*-\s*La Ricetta di GialloZafferano\s*$/i, '')
    .trim();
}

function parseGialloZafferanoIngredients(block: string): string[] {
  const cleanedBlock = normalizeImportText((block || '').replace(/!\[[^\]]*]\([^)]*\)/g, ' '));
  const firstIngredientIdx = cleanedBlock.search(/\[[^\]]+\]\([^)]*\)/);
  if (firstIngredientIdx === -1) return [];

  return cleanedBlock
    .slice(firstIngredientIdx)
    .split(/(?=\[[^\]]+\]\([^)]*\))/g)
    .map(chunk => {
      const match = chunk.match(/^\[([^\]]+)\]\([^)]*\)\s*(.*)$/s);
      if (!match) return null;
      const name = match[1].trim();
      const rest = normalizeImportText(match[2]).replace(/\s*!+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
      return rest ? `${name} ${rest}`.trim() : name;
    })
    .filter((v): v is string => Boolean(v));
}

function parseGialloZafferanoAdapter(markdown: string, url: string): ImportPreviewRecipe {
  const md = normalizeImportText(markdown);
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const difficultyMatch = md.match(/\*\s+Difficoltà:\s+\*\*(.*?)\*\*/i);
  const prepMatch = md.match(/\*\s+Preparazione:\s+\*\*(.*?)\*\*/i);
  const cookMatch = md.match(/\*\s+Cottura:\s+\*\*(.*?)\*\*/i);
  const servingsMatch = md.match(/\*\s+Dosi per:\s+\*\*(.*?)\*\*/i);
  const stepsStart = md.indexOf('## Come preparare');
  const stepsEnd = md.indexOf('## Conservazione', stepsStart);
  if (stepsStart === -1) throw new Error('GZ_STEPS_NOT_FOUND');

  const ingredientsStart = md.lastIndexOf('In caso di dubbi', stepsStart);
  const ingredientsEnd = md.indexOf('[AGGIUNGI ALLA LISTA DELLA SPESA]', ingredientsStart);
  if (ingredientsStart === -1 || ingredientsEnd === -1) throw new Error('GZ_INGREDIENTS_NOT_FOUND');

  const ingredients = parseGialloZafferanoIngredients(md.slice(ingredientsStart, ingredientsEnd));
  const steps = md
    .slice(stepsStart, stepsEnd)
    .split(/\n\s*\n/)
    .map(stripImportMarkdownNoise)
    .filter(part => part && !part.startsWith('## ') && !part.startsWith('Image '))
    .filter(part => !/^Preparazione$/i.test(part));

  if (!titleMatch || !ingredients.length || !steps.length) throw new Error('GZ_PARSE_INCOMPLETE');

  const prep = prepMatch ? prepMatch[1].trim() : '';
  const cook = cookMatch ? cookMatch[1].trim() : '';
  const cleanTitle = cleanGialloZafferanoTitle(titleMatch[1]).replace(/:.*$/, '').trim();
  const localCategory = extractNearbyCategorySignal(md, cleanTitle);
  const presentationSection = (md.match(/## PRESENTAZIONE\s*\n([\s\S]*?)(?:\n##\s*|$)/i) || [])[1] || '';
  const category = normalizeImportCategory(localCategory || inferImportCategoryFromTitleAndText(cleanTitle, presentationSection));

  return buildImportedRecipe(url, {
    name: cleanTitle,
    category,
    emoji: inferImportEmoji(category),
    time: [prep, cook].filter(Boolean).join(' + ') || 'n.d.',
    servings: servingsMatch ? normalizeImportedServings(servingsMatch[1], '4') : '4',
    difficolta: difficultyMatch ? difficultyMatch[1].trim() : '',
    ingredients,
    steps,
    timerMinutes: parseImportMinutes(cook),
    preparationType: 'classic',
  });
}

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
    .map(line => line.replace(/^\*\s+/, '').trim())
    .filter(Boolean);

  const steps = [...md.slice(stepsStart).matchAll(/^\d+\.\s+(.*)$/gm)]
    .map(match => stripImportLinksAndImages(match[1]))
    .filter(Boolean);

  if (!titleMatch || !ingredients.length || !steps.length) throw new Error('RPB_PARSE_INCOMPLETE');

  const prep = prepTimeMatch ? prepTimeMatch[1].trim() : '';
  const total = totalTimeMatch ? totalTimeMatch[1].trim() : '';
  const cleanTitle = cleanRicettePerBimbyTitle(titleMatch[1]);
  const localCategory = extractNearbyCategorySignal(md, cleanTitle);
  const category = normalizeImportCategory(localCategory || inferImportCategoryFromTitleAndText(cleanTitle));

  return buildImportedRecipe(url, {
    name: cleanTitle,
    category,
    emoji: inferImportEmoji(category),
    time: [prep, total && total !== prep ? total : ''].filter(Boolean).join(' + ') || 'n.d.',
    servings: servingsMatch ? normalizeImportedServings(servingsMatch[1], '1') : '1',
    difficolta: difficultyMatch ? difficultyMatch[1].trim() : '',
    ingredients,
    steps,
    timerMinutes: parseImportMinutes(total || prep),
    preparationType: 'bimby',
  });
}

function parseGenericReadableRecipe(markdown: string, url: string): ImportPreviewRecipe | null {
  const md = normalizeImportText(markdown);
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const ingredientsMatch = md.match(/##\s*(?:Ingredienti|Ingredients)\s*\n([\s\S]*?)\n##\s*/i);
  const stepsSection = md.match(/##\s*(?:Come preparare|Procedimento|Instructions|Preparazione|Metodo|Directions)\s*\n([\s\S]*?)(?:\n##\s*|$)/i);
  if (!titleMatch || !ingredientsMatch || !stepsSection) return null;

  const ingredients = ingredientsMatch[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*]/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  const numberedSteps = [...stepsSection[1].matchAll(/^\d+\.\s+(.*)$/gm)].map(match => stripImportLinksAndImages(match[1]));
  const bulletSteps = stepsSection[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*]/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim());
  const steps = numberedSteps.length ? numberedSteps : bulletSteps;
  if (!ingredients.length || !steps.length) return null;

  const domain = normalizeSourceDomain(url);
  const category = normalizeImportCategory(inferImportCategoryFromTitleAndText(titleMatch[1], stepsSection[1]));
  return buildImportedRecipe(url, {
    name: stripImportMarkdownNoise(titleMatch[1]).trim(),
    category,
    emoji: inferImportEmoji(category),
    ingredients,
    steps,
    preparationType: inferImportPreparationType(md, domain),
  });
}

const WEBSITE_IMPORT_ADAPTERS: WebsiteImportAdapter[] = [
  { domain: 'giallozafferano.it', parse: parseGialloZafferanoAdapter },
  { domain: 'ricetteperbimby.it', parse: parseRicettePerBimbyAdapter },
];

function getImportAdapterForDomain(domain: string): WebsiteImportAdapter | null {
  return WEBSITE_IMPORT_ADAPTERS.find(adapter => adapter.domain === domain) || null;
}

function importWebsiteRecipeWithAdapters(markdown: string, url: string): ImportPreviewRecipe {
  const domain = normalizeSourceDomain(url);
  const adapter = getImportAdapterForDomain(domain);
  if (adapter) return adapter.parse(markdown, url);
  const genericRecipe = parseGenericReadableRecipe(markdown, url);
  if (genericRecipe) return genericRecipe;
  throw new Error('UNSUPPORTED_WEB_IMPORT');
}

export {
  getImportAdapterForDomain,
  importWebsiteRecipeWithAdapters,
  suggestImportTags,
  normalizeImportText,
  stripImportLinksAndImages,
  stripImportMarkdownNoise,
};
