/**
 * import.js — Importazione ricette da URL tramite Claude AI
 *
 * Usa l'endpoint Anthropic /v1/messages per analizzare un link
 * e estrarre (o ricostruire) la ricetta strutturata.
 *
 * NOTA: l'API key viene iniettata dal proxy claude.ai quando l'app
 * gira all'interno del widget. Per uso standalone su GitHub Pages,
 * inserisci la tua API key nella variabile ANTHROPIC_API_KEY qui sotto
 * oppure usa un backend proxy.
 */

const ANTHROPIC_API_KEY = ''; // lascia vuoto se usi il proxy claude.ai

let previewedRicetta = null;

function detectFonte(url) {
  if (/youtube\.com|youtu\.be/i.test(url))  return 'youtube';
  if (/tiktok\.com/i.test(url))              return 'tiktok';
  if (/instagram\.com/i.test(url))           return 'instagram';
  return 'web';
}

function setStatus(msg, type) {
  const el = document.getElementById('import-status');
  el.textContent  = msg;
  el.className    = 'status-msg ' + type;
}

async function importaRicetta() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { setStatus('Inserisci un link valido.', 'err'); return; }

  const fonte    = detectFonte(url);
  const fonteMap = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', web: 'sito web' };
  const btn      = document.getElementById('btn-import-go');

  btn.disabled = true;
  document.getElementById('preview-box').style.display = 'none';
  previewedRicetta = null;

  setStatus(`Analizzo il link ${fonteMap[fonte]} con l'AI…`, 'loading');

  const prompt = `Sei un assistente culinario esperto. Analizza questo URL: ${url}

Il link proviene da: ${fonteMap[fonte]}.

Basandoti sull'URL e su tutto ciò che puoi dedurre (titolo, canale, stile del contenuto), estrai o CREA una ricetta plausibile e dettagliata in italiano.
Se non riesci a ricavare la ricetta esatta, crea una ricetta realistica e gustosa ispirata al probabile contenuto del link.

Rispondi SOLO con un oggetto JSON valido, senza backtick, senza testo aggiuntivo prima o dopo:
{
  "nome": "Nome della ricetta",
  "cat": "Categoria (Primi/Secondi/Dolci/Antipasti/Zuppe/Sughi/Bevande)",
  "emoji": "emoji appropriata",
  "tempo": "es. 30 min",
  "porzioni": "es. 4",
  "difficolta": "Facile/Media/Difficile",
  "ingredienti": ["ingrediente 1 con quantità", "ingrediente 2", "..."],
  "steps": ["passo 1 dettagliato", "passo 2", "..."],
  "timerMin": numero_minuti_cottura_principale
}`;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (ANTHROPIC_API_KEY) {
      headers['x-api-key']         = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data  = await resp.json();
    const raw   = data.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const ricetta = JSON.parse(clean);

    ricetta.id    = 'imp_' + Date.now();
    ricetta.fonte = fonte;
    ricetta.url   = url;

    previewedRicetta = ricetta;
    showPreview(ricetta);
    setStatus('Ricetta estratta! Controlla e salva nel tuo ricettario.', 'ok');

  } catch (e) {
    console.error(e);
    setStatus('Errore nell\'analisi del link. Controlla che l\'URL sia corretto e riprova.', 'err');
  }

  btn.disabled = false;
}

function showPreview(r) {
  document.getElementById('preview-title').textContent = `${r.emoji || '🍴'} ${r.nome}`;
  document.getElementById('preview-meta').textContent  =
    `${r.cat} · ${r.tempo} · ${r.porzioni} porzioni · ${r.difficolta || ''}`;

  document.getElementById('preview-ing').innerHTML =
    (r.ingredienti || []).map(i => `<li>${i}</li>`).join('');

  document.getElementById('preview-steps').innerHTML =
    (r.steps || []).map((s, i) =>
      `<div class="step-row"><span class="step-n">${i + 1}</span><p class="step-txt">${s}</p></div>`
    ).join('');

  document.getElementById('preview-box').style.display = 'block';
}

function salvaPreviewed() {
  if (!previewedRicetta) return;
  const ok = addToSaved(previewedRicetta);
  if (ok) {
    document.getElementById('preview-box').style.display = 'none';
    document.getElementById('url-input').value = '';
    setStatus('Ricetta salvata nel ricettario!', 'ok');
    previewedRicetta = null;
    setTimeout(() => showTab('saved', document.querySelectorAll('.tab')[0]), 700);
  }
}

function discardPreview() {
  document.getElementById('preview-box').style.display = 'none';
  document.getElementById('import-status').className = 'status-msg';
  previewedRicetta = null;
}
