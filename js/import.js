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
    recipe.url    = url;

    pendingRecipe = recipe;
    showImportPreview(recipe);
    setImportStatus(t('import_success'), 'ok');

  } catch (e) {
    console.error(e);
    setImportStatus(t('import_error'), 'err');
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
