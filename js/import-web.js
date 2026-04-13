/**
 * import-web.js — web import orchestration using adapter-based site parsers.
 * Loaded after import.js so it can override importRecipe() with website support.
 */

async function fetchReadableImportPage(url) {
  const resp = await fetch(`https://r.jina.ai/${url}`);
  if (!resp.ok) throw new Error(`WEB_FETCH_${resp.status}`);
  return resp.text();
}

function extractPageHeadingsHint(markdown) {
  const headings = (markdown || '').split('\n')
    .map(l => l.trim())
    .filter(l => /^#{1,3} /.test(l))
    .slice(0, 8);
  return headings.length ? headings.join(' · ') : null;
}

function inferImportFailureStage(message) {
  if (!message) return 'parse-content';
  if (message.startsWith('WEB_FETCH_') || message.startsWith('HTTP ')) return 'fetch-readable-page';
  if (message === 'UNSUPPORTED_WEB_IMPORT') return 'select-adapter';
  if (/(?:_NOT_FOUND|_PARSE|_INCOMPLETE|_UNSUPPORTED)/.test(message)) return 'parse-content';
  return 'parse-content';
}

async function importRecipe() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { setImportStatus(t('import_invalid_url'), 'err'); clearImportDiagnostics(); return; }

  const source = detectSource(url);
  const sourceMap = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', web: 'sito web' };
  const btn = document.getElementById('btn-import-go');
  const domain = normalizeSourceDomain(url);
  const adapterObj = getImportAdapterForDomain(domain);
  const adapterLabel = adapterObj ? adapterObj.domain : 'generic fallback';

  btn.disabled = true;
  document.getElementById('preview-box').style.display = 'none';
  pendingRecipe = null;
  setImportStatus(t('import_loading'), 'loading');
  clearImportDiagnostics();

  let _fetchedMarkdown = null;
  try {
    if (source === 'web') {
      _fetchedMarkdown = await fetchReadableImportPage(url);
      const recipe = importWebsiteRecipeWithAdapters(_fetchedMarkdown, url);
      pendingRecipe = recipe;
      showImportPreview(recipe);
      setImportStatus(t('import_success'), 'ok');
      clearImportDiagnostics();
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
    const rawError = String(e.message || e).trim();
    const isWebImportLimit = source === 'web' && (
      rawError.includes('UNSUPPORTED_WEB_IMPORT') ||
      rawError.includes('WEB_FETCH') ||
      rawError.includes('GZ_') ||
      rawError.includes('RPB_')
    );

    if (source === 'web') {
      const stage = inferImportFailureStage(rawError);
      const hint = _fetchedMarkdown && stage === 'parse-content'
        ? extractPageHeadingsHint(_fetchedMarkdown)
        : null;
      showImportDiagnostics({
        domain: domain || url,
        adapter: adapterLabel,
        stage,
        reason: rawError || t('import_error'),
        hint,
      });
    } else {
      clearImportDiagnostics();
    }

    setImportStatus(isWebImportLimit ? t('import_error_web_blocked') : t('import_error'), 'err');
  }

  btn.disabled = false;
}

window.importRecipe = importRecipe;
