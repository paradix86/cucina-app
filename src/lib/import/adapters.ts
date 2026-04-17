import { normalizeSourceDomain } from './core';
import { fetchHtmlForJsonLd } from './web';
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

function decodeImportEntities(value: string | null | undefined): string {
  return String(value || '')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&deg;/gi, '°');
}

function parseImportMinutes(value: string | null | undefined): number {
  const text = String(value || '');
  const hour = text.match(/(\d+)\s*h/i);
  const min = text.match(/(\d+)\s*min/i);
  const hours = hour ? parseInt(hour[ 1 ], 10) : 0;
  const minutes = min ? parseInt(min[ 1 ], 10) : 0;
  return hours * 60 + minutes;
}

function normalizeImportCategory(category: string): AppCategory {
  return [ 'Primi', 'Secondi', 'Dolci', 'Antipasti', 'Zuppe', 'Sughi', 'Bevande' ].includes(category)
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
    const mapped = mapCategorySignalToAppCategory(nearby[ i ]);
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
  if (domain === 'ricette-bimby.net') return 'bimby';
  const lower = text.toLowerCase();
  if (/\bbimby\b|tm[56]\b|tm31\b|varoma\b|nel boccale|vel\./.test(lower)) return 'bimby';
  if (/air\s*fryer|friggitrice\s+ad\s+aria|\bcestello\b/.test(lower)) return 'airfryer';
  return 'classic';
}

const DOMAIN_TAG_MAP: Record<string, string> = {
  'giallozafferano.it': 'GialloZafferano',
  'ricetteperbimby.it': 'RicettePerBimby',
  'ricette-bimby.net': 'Ricette Bimby',
};

function suggestImportTags(
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
      const name = match[ 1 ].trim();
      const rest = normalizeImportText(match[ 2 ]).replace(/\s*!+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
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

  const prep = prepMatch ? prepMatch[ 1 ].trim() : '';
  const cook = cookMatch ? cookMatch[ 1 ].trim() : '';
  const cleanTitle = cleanGialloZafferanoTitle(titleMatch[ 1 ]).replace(/:.*$/, '').trim();
  const localCategory = extractNearbyCategorySignal(md, cleanTitle);
  const presentationSection = (md.match(/## PRESENTAZIONE\s*\n([\s\S]*?)(?:\n##\s*|$)/i) || [])[ 1 ] || '';
  const category = normalizeImportCategory(localCategory || inferImportCategoryFromTitleAndText(cleanTitle, presentationSection));

  return buildImportedRecipe(url, {
    name: cleanTitle,
    category,
    emoji: inferImportEmoji(category),
    time: [ prep, cook ].filter(Boolean).join(' + ') || 'n.d.',
    servings: servingsMatch ? normalizeImportedServings(servingsMatch[ 1 ], '4') : '4',
    difficolta: difficultyMatch ? difficultyMatch[ 1 ].trim() : '',
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
  });
}

function cleanRicetteBimbyNetTitle(title: string): string {
  return stripImportMarkdownNoise(decodeImportEntities(title))
    .replace(/\s*-\s*Ricette[-\s]*Bimby\s*$/i, '')
    .trim();
}

function extractBimbyTaggedStep(stepText: string): string {
  const text = decodeImportEntities(stripImportLinksAndImages(stepText))
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';

  const tags: string[] = [];
  const timeMatch = text.match(/(\d+\s*(?:sec(?:ondi?)?\.?|min(?:uti?)?\.?))/i);
  const speedMatch = text.match(/\bvel\.?\s*([0-9]+(?:\.[0-9]+)?)/i);
  const tempMatch = text.match(/(?:\btemp\.?\s*|\b)(\d{2,3})\s*°\s*[cf]?/i);
  const varomaMatch = text.match(/\btemp(?:eratura)?\.?\s*Varoma\b/i);

  if (tempMatch) tags.push(`Temp. ${tempMatch[ 1 ]}°`);
  else if (varomaMatch) tags.push('Varoma');
  if (speedMatch) tags.push(`Vel. ${speedMatch[ 1 ]}`);
  if (timeMatch) {
    const normalizedTime = timeMatch[ 1 ]
      .replace(/sec(?:ondi?)?\.?/i, 'sec')
      .replace(/min(?:uti?)?\.?/i, 'min')
      .replace(/\s+/g, ' ')
      .trim();
    tags.push(normalizedTime);
  }

  if (!tags.length) return text;

  const instruction = text
    .replace(/(\d+\s*(?:sec(?:ondi?)?\.?|min(?:uti?)?\.?))/i, '')
    .replace(/\bvel\.?\s*[0-9]+(?:\.[0-9]+)?/i, '')
    .replace(/(?:\btemp\.?\s*|\b)\d{2,3}\s*°\s*[cf]?/i, '')
    .replace(/\btemp(?:eratura)?\.?\s*Varoma\b/i, '')
    .replace(/^[,;:\-\s]+/, '')
    .replace(/\s*[,;:]+\s*\.\s*$/, '.')  // clean trailing ": ." artifacts e.g. "emulsionare: ." → "emulsionare."
    .replace(/\s{2,}/g, ' ')
    .trim();

  const safeInstruction = instruction || text;
  return `${tags.join(' · ')} — ${safeInstruction}`;
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
  const steps = prepBlock
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
      const cleaned = extractBimbyTaggedStep(rawStep);
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
    }, []);

  if (!titleMatch || !ingredients.length || !steps.length) throw new Error('RBN_PARSE_INCOMPLETE');

  const cleanTitle = cleanRicetteBimbyNetTitle(titleMatch[ 1 ]);
  const localCategory = extractNearbyCategorySignal(md, cleanTitle);
  const category = normalizeImportCategory(localCategory || inferImportCategoryFromTitleAndText(cleanTitle, prepBlock));
  const total = totalTimeMatch ? stripImportLinksAndImages(totalTimeMatch[ 1 ]).trim() : '';

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
  });
}

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

  return buildImportedRecipe(url, {
    name: cleanTitle,
    category,
    emoji: inferImportEmoji(category),
    ingredients,
    steps,
    servings,
    preparationType: 'classic',
  });
}

function parseGenericReadableRecipe(markdown: string, url: string): ImportPreviewRecipe | null {
  const md = normalizeImportText(markdown);
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const ingredientsMatch = md.match(/##\s*(?:Ingredienti|Ingredients)\s*\n([\s\S]*?)\n##\s*/i);
  const stepsSection = md.match(/##\s*(?:Come preparare|Procedimento|Instructions|Preparazione|Metodo|Directions)\s*\n([\s\S]*?)(?:\n##\s*|$)/i);
  if (!titleMatch || !ingredientsMatch || !stepsSection) return null;

  const ingredients = ingredientsMatch[ 1 ]
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*]/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  const numberedSteps = [ ...stepsSection[ 1 ].matchAll(/^\d+\.\s+(.*)$/gm) ].map(match => stripImportLinksAndImages(match[ 1 ]));
  const bulletSteps = stepsSection[ 1 ]
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*]/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim());
  const steps = numberedSteps.length ? numberedSteps : bulletSteps;
  if (!ingredients.length || !steps.length) return null;

  const domain = normalizeSourceDomain(url);
  const category = normalizeImportCategory(inferImportCategoryFromTitleAndText(titleMatch[ 1 ], stepsSection[ 1 ]));
  return buildImportedRecipe(url, {
    name: stripImportMarkdownNoise(titleMatch[ 1 ]).trim(),
    category,
    emoji: inferImportEmoji(category),
    ingredients,
    steps,
    preparationType: inferImportPreparationType(md, domain),
  });
}

const WEBSITE_IMPORT_ADAPTERS: WebsiteImportAdapter[] = [
  {
    domain: 'giallozafferano.it',
    // Also handle giallozafferano.com (international/mirror domain)
    canHandle: (url: string) => /giallozafferano\.com\//i.test(url),
    parse: parseGialloZafferanoAdapter,
  },
  { domain: 'ricetteperbimby.it', parse: parseRicettePerBimbyAdapter },
  { domain: 'ricette-bimby.net', parse: parseRicetteBimbyNetAdapter },
  { domain: 'vegolosi.it', parse: parseVegolositAdapter },
];

/** Exact domain-string match. Kept for backward compatibility and diagnostics labels. */
function getImportAdapterForDomain(domain: string): WebsiteImportAdapter | null {
  return WEBSITE_IMPORT_ADAPTERS.find(adapter => adapter.domain === domain) || null;
}

/**
 * Full adapter lookup: tries exact domain match first, then falls back to
 * canHandle(url) for adapters that declare URL-pattern support.
 */
function getImportAdapterForUrl(url: string): WebsiteImportAdapter | null {
  const domain = normalizeSourceDomain(url);
  const exact = WEBSITE_IMPORT_ADAPTERS.find(adapter => adapter.domain === domain);
  if (exact) return exact;
  return WEBSITE_IMPORT_ADAPTERS.find(adapter => adapter.canHandle?.(url)) || null;
}

// ─── JSON-LD / Schema.org structured data fallback ───────────────────────────

/**
 * Convert an ISO 8601 duration (PT30M, PT1H30M, PT2H) to a human-readable
 * Italian-style time string (e.g. "30 min", "1h 30 min", "2h").
 */
function parseDurationIso(iso: string | undefined | null): string {
  if (!iso) return '';
  const h = parseInt((String(iso).match(/(\d+)H/i) || [])[ 1 ] || '0', 10);
  const m = parseInt((String(iso).match(/(\d+)M/i) || [])[ 1 ] || '0', 10);
  if (!h && !m) return '';
  if (h && m) return `${h}h ${m} min`;
  if (h) return `${h}h`;
  return `${m} min`;
}

function parseDurationIsoMinutes(iso: string | undefined | null): number {
  if (!iso) return 0;
  const h = parseInt((String(iso).match(/(\d+)H/i) || [])[ 1 ] || '0', 10);
  const m = parseInt((String(iso).match(/(\d+)M/i) || [])[ 1 ] || '0', 10);
  return h * 60 + m;
}

function normalizeJsonLdServings(raw: unknown): string {
  if (raw == null) return '';
  const val = Array.isArray(raw) ? raw[ 0 ] : raw;
  return normalizeImportText(String(val))
    .replace(/\s*persone?\b|\s*persona\b|\s*servings?\b|\s*portions?\b/gi, '')
    .trim();
}

/**
 * Extract plain-text instruction steps from the JSON-LD recipeInstructions value.
 * Handles: plain string, string[], HowToStep[], HowToSection[] (with nested itemListElement).
 */
function extractJsonLdInstructionSteps(raw: unknown): string[] {
  if (!raw) return [];

  if (typeof raw === 'string') {
    return raw.split(/\n+/)
      .map(line => normalizeImportText(line.replace(/^\d+[\.\)]\s*/, '')))
      .filter(Boolean);
  }

  if (!Array.isArray(raw)) return [];

  const steps: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const s = normalizeImportText(item);
      if (s) steps.push(s);
      continue;
    }
    if (!item || typeof item !== 'object') continue;

    const obj = item as Record<string, unknown>;
    const type = String(obj[ '@type' ] || '');

    if (type === 'HowToSection' || (Array.isArray(obj.itemListElement) && !obj.text)) {
      // Recurse into section items
      steps.push(...extractJsonLdInstructionSteps(obj.itemListElement));
      continue;
    }

    // HowToStep, or plain object with text/name
    const text = String(obj.text || obj.name || '').trim();
    const s = normalizeImportText(text);
    if (s) steps.push(s);
  }
  return steps;
}

/**
 * Walk a parsed JSON-LD node (or @graph array) looking for a Recipe @type.
 */
function findRecipeInJsonLdNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;

  const type = obj[ '@type' ];
  const isRecipe = Array.isArray(type)
    ? type.some(t => /recipe/i.test(String(t)))
    : /recipe/i.test(String(type || ''));
  if (isRecipe) return obj;

  // @graph pattern: {"@context":"...","@graph":[...nodes...]}
  if (Array.isArray(obj[ '@graph' ])) {
    for (const child of obj[ '@graph' ] as unknown[]) {
      const found = findRecipeInJsonLdNode(child);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Sanitize a raw JSON-LD string by escaping literal control characters that
 * appear inside string values (e.g. unescaped \n or \t inside a field value).
 * This is technically invalid JSON but common in real-world CMS output.
 * Characters outside of string values are left untouched.
 */
function sanitizeJsonLdText(json: string): string {
  let inString = false;
  let escape = false;
  let out = '';
  for (let i = 0; i < json.length; i++) {
    const ch = json[ i ];
    if (escape) { escape = false; out += ch; continue; }
    if (ch === '\\') { escape = true; out += ch; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString && ch.charCodeAt(0) < 0x20) {
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      continue; // strip other control chars silently
    }
    out += ch;
  }
  return out;
}

/**
 * Scan HTML for all <script type="application/ld+json"> blocks and return
 * the first Recipe node found, or null if none.
 * Applies JSON sanitization to handle sites that embed literal control chars
 * inside string values (technically invalid but common in CMS output).
 */
function findJsonLdRecipeNode(html: string): Record<string, unknown> | null {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(sanitizeJsonLdText(match[ 1 ].trim()));
      const nodes = Array.isArray(parsed) ? parsed : [ parsed ];
      for (const n of nodes) {
        const recipe = findRecipeInJsonLdNode(n);
        if (recipe) return recipe;
      }
    } catch {
      // malformed JSON-LD block — skip
    }
  }
  return null;
}

/**
 * Convert a validated JSON-LD Recipe node into an ImportPreviewRecipe.
 * Throws with a JSONLD_ prefixed code if required fields are missing.
 * `fallbackName` is used when the node's own name field is empty (e.g. supplied from OG title).
 */
function parseJsonLdRecipeNode(node: Record<string, unknown>, url: string, fallbackName?: string): ImportPreviewRecipe {
  const name = normalizeImportText(String(node.name || '')).trim() || fallbackName || '';
  if (!name) throw new Error('JSONLD_NO_NAME');

  const rawIngredients = Array.isArray(node.recipeIngredient) ? node.recipeIngredient : [];
  const ingredients = rawIngredients
    .map(i => normalizeImportText(String(i || '')))
    .filter(Boolean);
  if (!ingredients.length) throw new Error('JSONLD_NO_INGREDIENTS');

  const steps = extractJsonLdInstructionSteps(node.recipeInstructions);
  if (!steps.length) throw new Error('JSONLD_NO_STEPS');

  const timeIso = String(node.totalTime || node.cookTime || node.prepTime || '');
  const time = parseDurationIso(timeIso) || 'n.d.';
  const timerMinutes = parseDurationIsoMinutes(timeIso);

  const servings = normalizeJsonLdServings(node.recipeYield) || '4';

  const rawCat = Array.isArray(node.recipeCategory)
    ? String(node.recipeCategory[ 0 ] || '')
    : String(node.recipeCategory || '');
  const category = normalizeImportCategory(
    mapCategorySignalToAppCategory(rawCat) || inferImportCategoryFromTitleAndText(name),
  );

  const domain = normalizeSourceDomain(url);
  const fullText = ingredients.join(' ') + ' ' + steps.join(' ');
  const preparationType = inferImportPreparationType(fullText, domain);

  return buildImportedRecipe(url, {
    name,
    category,
    emoji: inferImportEmoji(category),
    time,
    servings,
    ingredients,
    steps,
    timerMinutes,
    preparationType,
    tags: suggestImportTags(domain, preparationType, category, name),
  });
}

/**
 * Given raw HTML, find and parse the first Recipe JSON-LD node.
 * Returns null if no usable structured data is found (graceful non-throw).
 * `fallbackName` is passed through to parseJsonLdRecipeNode for OG-title enrichment.
 */
function parseJsonLdRecipeFromHtml(html: string, url: string, fallbackName?: string): ImportPreviewRecipe | null {
  const node = findJsonLdRecipeNode(html);
  if (!node) return null;
  try {
    return parseJsonLdRecipeNode(node, url, fallbackName);
  } catch {
    return null;
  }
}

// ─── OpenGraph / HTML meta extraction ────────────────────────────────────────

interface HtmlMetaFields {
  title: string | null;
  description: string | null;
  image: string | null;
}

/**
 * Extract OpenGraph and standard HTML meta fields from page HTML.
 * Handles both attribute orderings (property before content and vice versa).
 * Used to enrich recipe name when structured parsers find ingredients/steps
 * but the name field is empty.
 */
function extractHtmlMetaFields(html: string): HtmlMetaFields {
  function firstMatch(patterns: RegExp[]): string | null {
    for (const re of patterns) {
      const m = html.match(re);
      const val = m?.[ 1 ] ? normalizeImportText(decodeImportEntities(m[ 1 ])).trim() : null;
      if (val) return val;
    }
    return null;
  }
  return {
    title: firstMatch([
      /<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
      /<meta\b[^>]*\bcontent=["']([^"'<>]+)["'][^>]*\bproperty=["']og:title["']/i,
      /<meta\b[^>]*\bname=["']title["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
      /<title[^>]*>([^<]{3,120})<\/title>/i,
    ]),
    description: firstMatch([
      /<meta\b[^>]*\bproperty=["']og:description["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
      /<meta\b[^>]*\bcontent=["']([^"'<>]+)["'][^>]*\bproperty=["']og:description["']/i,
      /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
    ]),
    image: firstMatch([
      /<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']([^"'<>]+)["']/i,
      /<meta\b[^>]*\bcontent=["']([^"'<>]+)["'][^>]*\bproperty=["']og:image["']/i,
    ]),
  };
}

// ─── WPRM / embedded plugin JSON extraction ──────────────────────────────────

/**
 * Extract a balanced JSON object starting at index `start` in `text`.
 * Returns the JSON string, or null if the object is not balanced.
 */
function extractJsonObjectAt(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[ i ];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Build an ImportPreviewRecipe from a WP Recipe Maker (WPRM) recipe object.
 * WPRM uses nested arrays: ingredients = [[{amount,unit,name,notes},...], ...]
 *                          instructions = [[{text,...},...], ...]
 * Returns null if the data is insufficient for a usable recipe.
 */
function buildWprmRecipe(
  recipe: Record<string, unknown>,
  url: string,
  metaTitle?: string,
): ImportPreviewRecipe | null {
  const name = normalizeImportText(String(recipe.name || metaTitle || '')).trim();
  if (!name) return null;

  const rawIngGroups = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const ingredients: string[] = [];
  for (const group of rawIngGroups as unknown[]) {
    if (!Array.isArray(group)) continue;
    for (const ing of group as unknown[]) {
      if (!ing || typeof ing !== 'object') continue;
      const obj = ing as Record<string, unknown>;
      const parts = [ String(obj.amount || ''), String(obj.unit || ''), String(obj.name || '') ]
        .map(s => s.trim()).filter(Boolean);
      const notes = String(obj.notes || '').trim();
      const line = parts.join(' ') + (notes ? ` (${notes})` : '');
      if (line.trim()) ingredients.push(line.trim());
    }
  }

  const rawInstrGroups = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const steps: string[] = [];
  for (const group of rawInstrGroups as unknown[]) {
    if (!Array.isArray(group)) continue;
    for (const step of group as unknown[]) {
      if (!step || typeof step !== 'object') continue;
      const text = normalizeImportText(String((step as Record<string, unknown>).text || '')).trim();
      if (text) steps.push(text);
    }
  }

  if (!ingredients.length || !steps.length) return null;

  const totalTime = typeof recipe.total_time === 'number' ? recipe.total_time : 0;
  const time = totalTime > 0 ? `${totalTime} min` : 'n.d.';
  const servings = recipe.servings != null ? String(recipe.servings) : '4';
  const rawCat = String(recipe.course || recipe.cuisine || '');
  const category = normalizeImportCategory(
    mapCategorySignalToAppCategory(rawCat) || inferImportCategoryFromTitleAndText(name),
  );
  const domain = normalizeSourceDomain(url);
  const fullText = ingredients.join(' ') + ' ' + steps.join(' ');
  const preparationType = inferImportPreparationType(fullText, domain);

  return buildImportedRecipe(url, {
    name,
    category,
    emoji: inferImportEmoji(category),
    time,
    servings,
    ingredients,
    steps,
    timerMinutes: totalTime,
    preparationType,
    tags: suggestImportTags(domain, preparationType, category, name),
  });
}

/**
 * Scan page HTML for WP Recipe Maker (WPRM) embedded recipe JSON.
 * WPRM inlines recipe data into `wprm_public_js_data` script variables with a
 * distinctive nested ingredient/instruction array format.
 * Returns a parsed recipe or null if no usable WPRM data is detected.
 */
function parseWprmRecipeFromHtml(
  html: string,
  url: string,
  metaTitle?: string,
): ImportPreviewRecipe | null {
  // Pre-check: WPRM uses nested ingredient arrays — fast bail if not present
  if (!html.includes('"ingredients":[[') && !html.includes('"ingredients": [[')) return null;

  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    const content = m[ 1 ];
    if (!content.includes('"ingredients":[[') && !content.includes('"ingredients": [[')) continue;

    // Locate the wprm_public_js_data assignment and extract the JSON object
    const keyIdx = content.indexOf('wprm_public_js_data');
    const eqIdx = keyIdx >= 0 ? content.indexOf('=', keyIdx) : -1;
    const objStart = eqIdx >= 0 ? content.indexOf('{', eqIdx) : -1;
    if (objStart === -1) continue;

    const jsonStr = extractJsonObjectAt(content, objStart);
    if (!jsonStr) continue;

    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      // wprm_public_js_data nests the recipe under a "recipe" key
      const recipeData = (parsed?.recipe as Record<string, unknown> | undefined)
        ?? (parsed?.ingredients && parsed?.instructions ? parsed : null);
      if (!recipeData) continue;
      const result = buildWprmRecipe(recipeData, url, metaTitle);
      if (result) return result;
    } catch { /* malformed JS — skip */ }
  }
  return null;
}

// ─── Adapter dispatch ─────────────────────────────────────────────────────────

/** Synchronous adapter dispatch (named adapters + generic markdown fallback). */
function importWebsiteRecipeWithAdapters(markdown: string, url: string): ImportPreviewRecipe {
  const adapter = getImportAdapterForUrl(url);
  if (adapter) return adapter.parse(markdown, url);
  const genericRecipe = parseGenericReadableRecipe(markdown, url);
  if (genericRecipe) return genericRecipe;
  throw new Error('UNSUPPORTED_WEB_IMPORT');
}

/**
 * Full async import with structured-data fallbacks.
 *
 * Dispatch order:
 *   1. Named adapter (domain match or canHandle)
 *   2. Generic markdown heading-scanner
 *   3. Jina HTML fetch — extract OpenGraph / meta fields once for all HTML-path fallbacks
 *   4. JSON-LD / Schema.org structured data (OG title used as name fallback when empty)
 *   5. WPRM / embedded plugin JSON (wprm_public_js_data inline script)
 *   6. Throw UNSUPPORTED_WEB_IMPORT
 *
 * Steps 4 and 5 share the same HTML fetch (no extra round-trip).
 * Named adapters and generic markdown are unaffected.
 */
async function importWebsiteRecipeWithFallbacks(markdown: string, url: string): Promise<ImportPreviewRecipe> {
  const adapter = getImportAdapterForUrl(url);
  if (adapter) return adapter.parse(markdown, url);

  const genericRecipe = parseGenericReadableRecipe(markdown, url);
  if (genericRecipe) return genericRecipe;

  // Fetch HTML once — shared by all remaining fallbacks
  const html = await fetchHtmlForJsonLd(url);
  const meta = extractHtmlMetaFields(html);
  const ogTitle = meta.title ?? undefined;

  // JSON-LD / Schema.org (OG title fills in when JSON-LD name is empty)
  const jsonLdRecipe = parseJsonLdRecipeFromHtml(html, url, ogTitle);
  if (jsonLdRecipe) return jsonLdRecipe;

  // WPRM / embedded plugin JSON (OG title fills in when plugin name is absent)
  const wprmRecipe = parseWprmRecipeFromHtml(html, url, ogTitle);
  if (wprmRecipe) return wprmRecipe;

  throw new Error('UNSUPPORTED_WEB_IMPORT');
}

export {
  getImportAdapterForDomain,
  getImportAdapterForUrl,
  importWebsiteRecipeWithAdapters,
  importWebsiteRecipeWithFallbacks,
  suggestImportTags,
  normalizeImportText,
  stripImportLinksAndImages,
  stripImportMarkdownNoise,
  parseJsonLdRecipeFromHtml,
  parseWprmRecipeFromHtml,
  extractHtmlMetaFields,
};
