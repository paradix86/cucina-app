/**
 * import.js — Recipe import from URL via Claude AI
 *
 * Uses the Anthropic /v1/messages endpoint to analyse a link
 * and extract (or synthesise) a structured recipe.
 *
 * NOTE: the API key is injected by the claude.ai proxy when the app
 * runs inside the widget. For standalone use (e.g. GitHub Pages),
 * set your API key in ANTHROPIC_API_KEY below or use a backend proxy.
 */

const ANTHROPIC_API_KEY = ''; // leave empty when using the claude.ai proxy

let pendingRecipe = null;

function normalizeSourceDomain(url) {
  try {
    let hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'youtu.be' || hostname.endsWith('.youtube.com')) hostname = 'youtube.com';
    if (hostname.endsWith('.instagram.com')) hostname = 'instagram.com';
    if (hostname.endsWith('.tiktok.com')) hostname = 'tiktok.com';
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length >= 3) {
      const tail = parts.slice(-2).join('.');
      if (tail === 'co.uk' || tail === 'com.br' || tail === 'com.au') {
        return parts.slice(-3).join('.');
      }
      return tail;
    }
    return hostname;
  } catch {
    return '';
  }
}

function normalizeText(s) {
  return (s || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdownNoise(s) {
  return normalizeText(
    (s || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\s+\d+(?:\s+\d+)*/g, match => match.length <= 8 ? ' ' : match)
  );
}

function parseMinutesFromText(s) {
  const text = String(s || '');
  const hour = text.match(/(\d+)\s*h/i);
  const min = text.match(/(\d+)\s*min/i);
  const hours = hour ? parseInt(hour[1]) : 0;
  const minutes = min ? parseInt(min[1]) : 0;
  return hours * 60 + minutes;
}

function inferCategoryFromText(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('primo piatto') || t.includes('primi piatti')) return 'Primi';
  if (t.includes('secondo piatto') || t.includes('secondi piatti')) return 'Secondi';
  if (t.includes('dolci')) return 'Dolci';
  if (t.includes('antipasti')) return 'Antipasti';
  if (t.includes('zuppe')) return 'Zuppe';
  if (t.includes('sughi')) return 'Sughi';
  return 'Primi';
}

function inferEmoji(category) {
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

async function fetchReadablePage(url) {
  const proxyUrl = `https://r.jina.ai/http://${url}`;
  const resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error(`WEB_FETCH_${resp.status}`);
  return resp.text();
}

function cleanGialloZafferanoTitle(title) {
  return stripMarkdownNoise(title)
    .replace(/^Ricetta\s+/i, '')
    .replace(/\s*-\s*La Ricetta di GialloZafferano\s*$/i, '')
      .trim();
}

function stripLinksAndImages(s) {
  return normalizeText(
    (s || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  );
}

function normalizeImportedServings(text, fallback = '1') {
  const cleaned = normalizeText(text)
    .replace(/\s*persone?\b/gi, '')
    .replace(/\s*persona\b/gi, '')
    .trim();
  return cleaned || fallback;
}

function parseGialloZafferanoIngredients(block) {
  const cleanedBlock = normalizeText(
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
      const rest = normalizeText(match[2])
        .replace(/\s*!+\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (!rest) return name;
      return `${name} ${rest}`.trim();
    })
    .filter(Boolean);
}

function parseGialloZafferanoRecipe(markdown, url) {
  const md = normalizeText(markdown);
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

  const stepsBlock = md.slice(stepsStart, stepsEnd);
  const steps = stepsBlock
    .split(/\n\s*\n/)
    .map(stripMarkdownNoise)
    .filter(p => p && !p.startsWith('## ') && !p.startsWith('Image '))
    .filter(p => !/^Preparazione$/i.test(p));

  if (!titleMatch || !ingredients.length || !steps.length) throw new Error('GZ_PARSE_INCOMPLETE');

  const prep = prepMatch ? prepMatch[1].trim() : '';
  const cook = cookMatch ? cookMatch[1].trim() : '';
  const totalTime = [prep, cook].filter(Boolean).join(' + ');
  const category = inferCategoryFromText(md);

  return {
    id: 'imp_' + Date.now(),
    name: cleanGialloZafferanoTitle(titleMatch[1]).replace(/:.*$/, '').trim(),
    category,
    emoji: inferEmoji(category),
    time: totalTime || 'n.d.',
    servings: servingsMatch ? servingsMatch[1].replace(/\s*persone?/i, '').trim() : '4',
    difficolta: difficultyMatch ? difficultyMatch[1].trim() : '',
    ingredients,
    steps,
    timerMinutes: parseMinutesFromText(cook),
    preparationType: 'classic',
    source: 'web',
    sourceDomain: normalizeSourceDomain(url),
    url,
  };
}

function cleanRicettePerBimbyTitle(title) {
  return stripMarkdownNoise(title)
    .replace(/\s*-\s*Ricette Bimby\s*$/i, '')
    .trim();
}

function parseRicettePerBimbyRecipe(markdown, url) {
  const md = normalizeText(markdown);
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const difficultyMatch = md.match(/Difficoltà\s*\n+\s*([^\n]+)/i);
  const totalTimeMatch = md.match(/Tempo totale\s*\n+\s*([^\n]+)/i);
  const prepTimeMatch = md.match(/Preparazione\s*\n+\s*([^\n]+)/i);
  const servingsMatch = md.match(/Quantità\s*\n+\s*([^\n]+)/i);

  const ingredientsStart = md.indexOf('## Ingredienti');
  const stepsStart = md.indexOf('## Come fare il', ingredientsStart);
  if (ingredientsStart === -1 || stepsStart === -1) throw new Error('RPB_SECTIONS_NOT_FOUND');

  const ingredientsBlock = md.slice(ingredientsStart, stepsStart);
  const ingredients = ingredientsBlock
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('*'))
    .map(line => line.replace(/^\*\s+/, '').trim())
    .filter(Boolean);

  const stepsBlock = md.slice(stepsStart);
  const steps = [...stepsBlock.matchAll(/^\d+\.\s+(.*)$/gm)]
    .map(match => stripLinksAndImages(match[1]))
    .filter(Boolean);

  if (!titleMatch || !ingredients.length || !steps.length) throw new Error('RPB_PARSE_INCOMPLETE');

  const prep = prepTimeMatch ? prepTimeMatch[1].trim() : '';
  const total = totalTimeMatch ? totalTimeMatch[1].trim() : '';
  const category = inferCategoryFromText(md) === 'Primi' && /drink|frullat|frapp[eé]|sorbett|granita/i.test(md)
    ? 'Bevande'
    : inferCategoryFromText(md);

  return {
    id: 'imp_' + Date.now(),
    name: cleanRicettePerBimbyTitle(titleMatch[1]),
    category,
    emoji: category === 'Bevande' ? '🥤' : inferEmoji(category),
    time: [prep, total && total !== prep ? total : ''].filter(Boolean).join(' + ') || 'n.d.',
    servings: servingsMatch ? normalizeImportedServings(servingsMatch[1], '1') : '1',
    difficolta: difficultyMatch ? difficultyMatch[1].trim() : '',
    ingredients,
    steps,
    timerMinutes: parseMinutesFromText(total || prep),
    preparationType: 'bimby',
    source: 'web',
    sourceDomain: normalizeSourceDomain(url),
    url,
  };
}

async function importGenericWebsiteRecipe(url) {
  const markdown = await fetchReadablePage(url);
  if (/giallozafferano\.it/i.test(url)) {
    return parseGialloZafferanoRecipe(markdown, url);
  }
  if (/ricetteperbimby\.it/i.test(url)) {
    return parseRicettePerBimbyRecipe(markdown, url);
  }
  throw new Error('UNSUPPORTED_WEB_IMPORT');
}

function detectSource(url) {
  if (/youtube\.com|youtu\.be/i.test(url))  return 'youtube';
  if (/tiktok\.com/i.test(url))              return 'tiktok';
  if (/instagram\.com/i.test(url))           return 'instagram';
  return 'web';
}

function setImportStatus(msg, type) {
  const el      = document.getElementById('import-status');
  el.textContent = msg;
  el.className   = 'status-msg ' + type;
}

async function importRecipe() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { setImportStatus(t('import_invalid_url'), 'err'); return; }

  const source    = detectSource(url);
  const sourceMap = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', web: 'sito web' };
  const btn       = document.getElementById('btn-import-go');

  btn.disabled = true;
  document.getElementById('preview-box').style.display = 'none';
  pendingRecipe = null;

  setImportStatus(t('import_loading'), 'loading');
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

  try {
    if (source === 'web') {
      const recipe = await importGenericWebsiteRecipe(url);
      pendingRecipe = recipe;
      showImportPreview(recipe);
      setImportStatus(t('import_success'), 'ok');
      btn.disabled = false;
      return;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (ANTHROPIC_API_KEY) {
      headers['x-api-key']         = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers,
      body:    JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data   = await resp.json();
    const raw    = data.content.map(c => c.text || '').join('');
    const clean  = raw.replace(/```json|```/g, '').trim();
    const recipe = JSON.parse(clean);

    recipe.id     = 'imp_' + Date.now();
    recipe.source = source;
    recipe.preparationType = normalizePreparationTypeValue(recipe.preparationType) || 'classic';
    recipe.sourceDomain = normalizeSourceDomain(url);
    recipe.url    = url;

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

function showImportPreview(r) {
  document.getElementById('preview-title').textContent = `${r.emoji || '🍴'} ${r.name}`;
  document.getElementById('preview-meta').textContent  =
    `${r.category} · ${r.time} · ${r.servings} ${t('detail_servings').toLowerCase()}${r.difficolta ? ' · ' + r.difficolta : ''}`;

  document.getElementById('preview-ing').innerHTML =
    (r.ingredients || []).map(i => `<li>${i}</li>`).join('');

  document.getElementById('preview-steps').innerHTML =
    (r.steps || []).map((s, i) =>
      `<div class="step-row"><span class="step-n">${i + 1}</span><p class="step-txt">${s}</p></div>`
    ).join('');

  document.getElementById('preview-box').style.display = 'block';
}

function savePreviewed() {
  if (!pendingRecipe) return;
  const ok = addRecipe(pendingRecipe);
  if (ok) {
    document.getElementById('preview-box').style.display = 'none';
    document.getElementById('url-input').value = '';
    setImportStatus(t('builtin_saved_ok'), 'ok');
    pendingRecipe = null;
    setTimeout(() => showTab('saved', document.querySelectorAll('.tab')[0]), 700);
  }
}

function discardPreview() {
  document.getElementById('preview-box').style.display = 'none';
  document.getElementById('import-status').className   = 'status-msg';
  pendingRecipe = null;
}
