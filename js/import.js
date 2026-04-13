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

function detectSource(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'web';
}

function setImportStatus(msg, type) {
  const el = document.getElementById('import-status');
  el.textContent = msg;
  el.className = 'status-msg ' + type;
}

function clearImportDiagnostics() {
  const diagnostics = document.getElementById('import-diagnostics');
  if (!diagnostics) return;
  diagnostics.style.display = 'none';
  diagnostics.innerHTML = '';
}

function showImportDiagnostics(diagnostic) {
  const diagnostics = document.getElementById('import-diagnostics');
  if (!diagnostics || !diagnostic) return clearImportDiagnostics();

  const items = [
    { label: t('import_diag_domain'), value: diagnostic.domain || '' },
    { label: t('import_diag_adapter'), value: diagnostic.adapter || '' },
    { label: t('import_diag_stage'), value: diagnostic.stage || '' },
    { label: t('import_diag_reason'), value: diagnostic.reason || '' },
  ].filter(item => item.value);

  const hintHtml = diagnostic.hint
    ? `<details class="import-diagnostics-hint">
        <summary>${t('import_diag_hint')}</summary>
        <div class="import-diagnostics-hint-body">${diagnostic.hint}</div>
      </details>`
    : '';

  diagnostics.innerHTML = `
    <div class="import-diagnostics-title">${t('import_diag_title')}</div>
    ${items.map(item => `
      <div class="import-diagnostics-item">
        <span class="import-diagnostics-label">${item.label}:</span>
        <span class="import-diagnostics-value">${item.value}</span>
      </div>
    `).join('')}
    ${hintHtml}
  `;
  diagnostics.style.display = 'block';
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
      const markdown = await fetchReadableImportPage(url);
      const recipe = importWebsiteRecipeWithAdapters(markdown, url);
      pendingRecipe = recipe;
      showImportPreview(recipe);
      setImportStatus(t('import_success'), 'ok');
      btn.disabled = false;
      return;
    }

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

/* ---- tiny HTML helpers (import preview only) ---- */
function _escHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}

function showImportPreview(r) {
  document.getElementById('preview-title').textContent = `${r.emoji || '🍴'} ${r.name}`;
  document.getElementById('preview-meta').textContent =
    [r.category, r.time, `${r.servings} ${t('detail_servings').toLowerCase()}`, r.difficolta]
      .filter(Boolean)
      .join(' · ');

  /* ---- metadata section ---- */
  const metaEl = document.getElementById('preview-metadata');
  if (metaEl) {
    const prettyDomain = (typeof getSourceDomainLabel === 'function')
      ? getSourceDomainLabel(r.sourceDomain) || r.sourceDomain || ''
      : r.sourceDomain || '';
    const prepType = r.preparationType || 'classic';
    const tags = Array.isArray(r.tags) ? r.tags : [];

    const prepPillsHtml = ['classic', 'bimby', 'airfryer'].map(p =>
      `<button class="prep-pill${p === prepType ? ' active' : ''}" data-prep="${p}"
         onclick="selectImportPrepType(this)">${_escHtml(t('prep_' + p))}</button>`
    ).join('');

    const tagsHtml = tags.map(tag =>
      `<span class="preview-tag" data-tag="${_escHtml(tag)}">${_escHtml(tag)}<button class="tag-remove" onclick="removeImportTag(this)" aria-label="remove">×</button></span>`
    ).join('');

    const sourceRow = prettyDomain
      ? `<div class="preview-meta-row">
           <span class="preview-meta-label">${_escHtml(t('import_source_site'))}:</span>
           <span class="preview-meta-value">${_escHtml(prettyDomain)}</span>
         </div>`
      : '';

    metaEl.innerHTML = `<div class="preview-metadata">${sourceRow}
      <div class="preview-meta-row">
        <span class="preview-meta-label">${_escHtml(t('import_prep_type'))}:</span>
        <div class="prep-type-pills" id="preview-prep-type">${prepPillsHtml}</div>
      </div>
      <div class="preview-meta-row">
        <span class="preview-meta-label">${_escHtml(t('import_tags'))}:</span>
        <div class="preview-tags-wrap" id="preview-tags-container">
          ${tagsHtml}
          <input type="text" class="tag-add-input" id="preview-tag-input"
            placeholder="${_escHtml(t('import_tag_add_placeholder'))}"
            onkeydown="if(event.key==='Enter'){addImportTag();event.preventDefault();}" />
          <button class="tag-add-btn" onclick="addImportTag()">+</button>
        </div>
      </div>
    </div>`;
  }

  document.getElementById('preview-ing').innerHTML =
    (r.ingredients || []).map(i => `<li>${i}</li>`).join('');

  document.getElementById('preview-steps').innerHTML =
    (r.steps || []).map((s, i) =>
      `<div class="step-row"><span class="step-n">${i + 1}</span><p class="step-txt">${s}</p></div>`
    ).join('');

  document.getElementById('preview-box').style.display = 'block';
}

function selectImportPrepType(btn) {
  document.querySelectorAll('#preview-prep-type .prep-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
}

function removeImportTag(btn) {
  btn.closest('.preview-tag')?.remove();
}

function addImportTag() {
  const input = document.getElementById('preview-tag-input');
  if (!input) return;
  const value = input.value.trim();
  if (!value) return;
  const container = document.getElementById('preview-tags-container');
  if (!container) return;
  // Deduplicate
  const existing = Array.from(container.querySelectorAll('.preview-tag')).map(el => el.dataset.tag);
  if (existing.includes(value)) { input.value = ''; return; }
  const tagEl = document.createElement('span');
  tagEl.className = 'preview-tag';
  tagEl.dataset.tag = value;
  tagEl.innerHTML = `${_escHtml(value)}<button class="tag-remove" onclick="removeImportTag(this)" aria-label="remove">×</button>`;
  container.insertBefore(tagEl, input);
  input.value = '';
}

function savePreviewed() {
  if (!pendingRecipe) return;

  // Read back user-edited preparation type
  const activePrepBtn = document.querySelector('#preview-prep-type .prep-pill.active');
  if (activePrepBtn) {
    pendingRecipe.preparationType = activePrepBtn.dataset.prep;
    pendingRecipe.bimby = activePrepBtn.dataset.prep === 'bimby';
  }

  // Read back user-edited tags
  const tagEls = document.querySelectorAll('#preview-tags-container .preview-tag');
  pendingRecipe.tags = Array.from(tagEls).map(el => el.dataset.tag).filter(Boolean);

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
  document.getElementById('import-status').className = 'status-msg';
  pendingRecipe = null;
}
