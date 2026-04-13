/**
 * import-web.js — pragmatic browser-side fallback for generic recipe pages.
 * Loaded after import.js so it can override importRecipe() with web support.
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
    default: return '🍴';
  }
}

async function fetchReadableImportPage(url) {
  const resp = await fetch(`https://r.jina.ai/http://${url}`);
  if (!resp.ok) throw new Error(`WEB_FETCH_${resp.status}`);
  return resp.text();
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

function parseGialloZafferanoImport(markdown, url) {
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

  const ingredientsBlock = md.slice(ingredientsStart, ingredientsEnd);
  const ingredients = parseGialloZafferanoIngredients(ingredientsBlock);

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

  return {
    id: 'imp_' + Date.now(),
    name: cleanGialloZafferanoTitle(titleMatch[1]).replace(/:.*$/, '').trim(),
    category,
    emoji: inferImportEmoji(category),
    time: [prep, cook].filter(Boolean).join(' + ') || 'n.d.',
    servings: servingsMatch ? servingsMatch[1].replace(/\s*persone?/i, '').trim() : '4',
    difficolta: difficultyMatch ? difficultyMatch[1].trim() : '',
    ingredients,
    steps,
    timerMinutes: parseImportMinutes(cook),
    preparationType: 'classic',
    source: 'web',
    sourceDomain: normalizeSourceDomain(url),
    url,
  };
}

async function importRecipe() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { setImportStatus(t('import_invalid_url'), 'err'); return; }

  const source = detectSource(url);
  const sourceMap = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', web: 'sito web' };
  const btn = document.getElementById('btn-import-go');

  btn.disabled = true;
  document.getElementById('preview-box').style.display = 'none';
  pendingRecipe = null;
  setImportStatus(t('import_loading'), 'loading');

  try {
    if (source === 'web') {
      const markdown = await fetchReadableImportPage(url);
      if (!/giallozafferano\.it/i.test(url)) throw new Error('UNSUPPORTED_WEB_IMPORT');
      const recipe = parseGialloZafferanoImport(markdown, url);
      pendingRecipe = recipe;
      showImportPreview(recipe);
      setImportStatus(t('import_success'), 'ok');
      btn.disabled = false;
      return;
    }

    const prompt = `Sei un assistente culinario esperto. Analizza questo URL: ${url}

Il link proviene da: ${sourceMap[source]}.

Basandoti sull'URL e su tutto ciò che puoi dedurre (titolo, canale, stile del contenuto), estrai o CREA una ricetta plausibile e dettagliata in italiano.
Se non riesci a ricavare la ricetta esatta, crea una ricetta realistica e gustosa ispirata al probabile contenuto del link.

Rispondi SOLO con un oggetto JSON valido, senza backtick, senza testo aggiuntivo prima o dopo:
{
  "name": "Nome della ricetta",
  "category": "Categoria (Primi/Secondi/Dolci/Antipasti/Zuppe/Sughi/Bevande)",
  "emoji": "emoji appropriata",
  "time": "es. 30 min",
  "servings": "es. 4",
  "difficolta": "Facile/Media/Difficile",
  "ingredients": ["ingrediente 1 con quantità", "ingrediente 2", "..."],
  "steps": ["passo 1 dettagliato", "passo 2", "..."],
  "timerMinutes": numero_minuti_cottura_principale
}`;

    const headers = { 'Content-Type': 'application/json' };
    if (ANTHROPIC_API_KEY) {
      headers['x-api-key'] = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const raw = data.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const recipe = JSON.parse(clean);

    recipe.id = 'imp_' + Date.now();
    recipe.source = source;
    recipe.preparationType = normalizePreparationTypeValue(recipe.preparationType) || 'classic';
    recipe.sourceDomain = normalizeSourceDomain(url);
    recipe.url = url;

    pendingRecipe = recipe;
    showImportPreview(recipe);
    setImportStatus(t('import_success'), 'ok');
  } catch (e) {
    console.error(e);
    const isWebImportLimit = source === 'web' && (
      String(e).includes('UNSUPPORTED_WEB_IMPORT') ||
      String(e).includes('WEB_FETCH') ||
      String(e).includes('GZ_')
    );
    setImportStatus(isWebImportLimit ? t('import_error_web_blocked') : t('import_error'), 'err');
  }

  btn.disabled = false;
}

window.importRecipe = importRecipe;
