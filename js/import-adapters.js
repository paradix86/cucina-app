/**
 * import-adapters.js — lightweight adapter registry for website imports
 */

function normalizeImportText(s) {
  return (s || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripImportMarkdownNoise(s) {
  return normalizeImportText(
    (s || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\s+\d+(?:\s+\d+)*/g, match => match.length <= 8 ? ' ' : match)
  );
}

function stripImportLinksAndImages(s) {
  return normalizeImportText(
    (s || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  );
}

function parseImportMinutes(s) {
  const text = String(s || '');
  const hour = text.match(/(\d+)\s*h/i);
  const min = text.match(/(\d+)\s*min/i);
  const hours = hour ? parseInt(hour[1]) : 0;
  const minutes = min ? parseInt(min[1]) : 0;
  return hours * 60 + minutes;
}

function inferImportCategory(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('primo piatto') || t.includes('primi piatti')) return 'Primi';
  if (t.includes('secondo piatto') || t.includes('secondi piatti')) return 'Secondi';
  if (t.includes('dolci')) return 'Dolci';
  if (t.includes('antipasti')) return 'Antipasti';
  if (t.includes('zuppe')) return 'Zuppe';
  if (t.includes('sughi')) return 'Sughi';
  return 'Primi';
}

function inferImportEmoji(category) {
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

function normalizeImportedServings(text, fallback = '1') {
  const cleaned = normalizeImportText(text)
    .replace(/\s*persone?\b/gi, '')
    .replace(/\s*persona\b/gi, '')
    .trim();
  return cleaned || fallback;
}

function buildImportedRecipe(url, fields) {
  return {
    id: 'imp_' + Date.now(),
    name: '',
    category: 'Primi',
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
    ...fields,
  };
}

function cleanGialloZafferanoTitle(title) {
  return stripImportMarkdownNoise(title)
    .replace(/^Ricetta\s+/i, '')
    .replace(/\s*-\s*La Ricetta di GialloZafferano\s*$/i, '')
    .trim();
}

function parseGialloZafferanoIngredients(block) {
  const cleanedBlock = normalizeImportText(
    (block || '').replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
  );
  const firstIngredientIdx = cleanedBlock.search(/\[[^\]]+\]\([^)]*\)/);
  if (firstIngredientIdx === -1) return [];

  return cleanedBlock
    .slice(firstIngredientIdx)
    .split(/(?=\[[^\]]+\]\([^)]*\))/g)
    .map(chunk => {
      const match = chunk.match(/^\[([^\]]+)\]\([^)]*\)\s*(.*)$/s);
      if (!match) return null;

      const name = match[1].trim();
      const rest = normalizeImportText(match[2])
        .replace(/\s*!+\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (!rest) return name;
      return `${name} ${rest}`.trim();
    })
    .filter(Boolean);
}

function parseGialloZafferanoAdapter(markdown, url) {
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
    .filter(p => p && !p.startsWith('## ') && !p.startsWith('Image '))
    .filter(p => !/^Preparazione$/i.test(p));

  if (!titleMatch || !ingredients.length || !steps.length) throw new Error('GZ_PARSE_INCOMPLETE');

  const prep = prepMatch ? prepMatch[1].trim() : '';
  const cook = cookMatch ? cookMatch[1].trim() : '';
  const category = inferImportCategory(md);

  return buildImportedRecipe(url, {
    name: cleanGialloZafferanoTitle(titleMatch[1]).replace(/:.*$/, '').trim(),
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

function cleanRicettePerBimbyTitle(title) {
  return stripImportMarkdownNoise(title)
    .replace(/\s*-\s*Ricette Bimby\s*$/i, '')
    .trim();
}

function parseRicettePerBimbyAdapter(markdown, url) {
  const md = normalizeImportText(markdown);
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const difficultyMatch = md.match(/Difficoltà\s*\n+\s*([^\n]+)/i);
  const totalTimeMatch = md.match(/Tempo totale\s*\n+\s*([^\n]+)/i);
  const prepTimeMatch = md.match(/Preparazione\s*\n+\s*([^\n]+)/i);
  const servingsMatch = md.match(/Quantità\s*\n+\s*([^\n]+)/i);

  const ingredientsStart = md.indexOf('## Ingredienti');
  const stepsStart = md.indexOf('## Come fare il', ingredientsStart);
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
  const inferred = inferImportCategory(md);
  const category = inferred === 'Primi' && /drink|frullat|frapp[eé]|sorbett|granita/i.test(md)
    ? 'Bevande'
    : inferred;

  return buildImportedRecipe(url, {
    name: cleanRicettePerBimbyTitle(titleMatch[1]),
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

function parseGenericReadableRecipe(markdown, url) {
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

  const numberedSteps = [...stepsSection[1].matchAll(/^\d+\.\s+(.*)$/gm)].map(m => stripImportLinksAndImages(m[1]));
  const bulletSteps = stepsSection[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*]/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim());
  const steps = numberedSteps.length ? numberedSteps : bulletSteps;

  if (!ingredients.length || !steps.length) return null;

  const category = inferImportCategory(md);
  return buildImportedRecipe(url, {
    name: stripImportMarkdownNoise(titleMatch[1]).trim(),
    category,
    emoji: inferImportEmoji(category),
    ingredients,
    steps,
    preparationType: 'classic',
  });
}

const WEBSITE_IMPORT_ADAPTERS = [
  {
    domain: 'giallozafferano.it',
    parse: parseGialloZafferanoAdapter,
  },
  {
    domain: 'ricetteperbimby.it',
    parse: parseRicettePerBimbyAdapter,
  },
];

function getImportAdapterForDomain(domain) {
  return WEBSITE_IMPORT_ADAPTERS.find(adapter => adapter.domain === domain) || null;
}

function importWebsiteRecipeWithAdapters(markdown, url) {
  const domain = normalizeSourceDomain(url);
  const adapter = getImportAdapterForDomain(domain);
  if (adapter) return adapter.parse(markdown, url);

  const genericRecipe = parseGenericReadableRecipe(markdown, url);
  if (genericRecipe) return genericRecipe;

  throw new Error('UNSUPPORTED_WEB_IMPORT');
}
