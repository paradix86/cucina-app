/**
 * ui.js — Rendering e navigazione dell'interfaccia
 */

/* ---- helpers ---- */

function srcInfo(fonte) {
  switch (fonte) {
    case 'youtube':   return { cls: 'badge-yt',       txt: 'YouTube'    };
    case 'tiktok':    return { cls: 'badge-tt',       txt: 'TikTok'     };
    case 'instagram': return { cls: 'badge-ig',       txt: 'Instagram'  };
    case 'bimby':     return { cls: 'badge-bimby',    txt: 'Bimby TM5'  };
    case 'classica':  return { cls: 'badge-classica', txt: 'Classica'   };
    default:          return { cls: 'badge-web',      txt: 'Web'        };
  }
}

function buildStepsHTML(steps, bimby) {
  return steps.map((s, i) => {
    if (bimby) {
      // formato: "Vel. X · Temp. Y · Z min — testo"
      const sep = s.indexOf(' — ');
      if (sep !== -1) {
        const tags = s.slice(0, sep).split('·').map(t => t.trim()).filter(Boolean);
        const testo = s.slice(sep + 3);
        return `<div class="bimby-step">
          <div class="bimby-step-tags">${tags.map(t => `<span class="bimby-tag">${t}</span>`).join('')}</div>
          <p>${i + 1}. ${testo}</p>
        </div>`;
      }
    }
    return `<div class="step-row">
      <span class="step-n">${i + 1}</span>
      <p class="step-txt">${s}</p>
    </div>`;
  }).join('');
}

function buildDetailHTML(r, onBack) {
  const s       = srcInfo(r.fonte || 'web');
  const ingHTML = (r.ingredienti || []).map(i => `<li>${i}</li>`).join('');
  const stepHTML = buildStepsHTML(r.steps || [], r.bimby);
  const timerBtn = r.timerMin > 0
    ? `<button class="btn-primary" onclick="avviaTimerDaRicetta('${r.nome.replace(/'/g,"\\'")}', ${r.timerMin})">
        ⏱ Timer (${r.timerMin >= 60
          ? Math.floor(r.timerMin/60) + 'h' + (r.timerMin%60 ? ' ' + r.timerMin%60 + ' min' : '')
          : r.timerMin + ' min'})
       </button>`
    : '';
  const origLink = r.url
    ? `<a href="${r.url}" class="orig-link" target="_blank" rel="noopener">Apri fonte originale ↗</a>`
    : '';

  return `
    <button class="detail-back" onclick="${onBack}">← Indietro</button>
    <div class="detail-wrap">
      <span class="card-src ${s.cls}">${s.txt}</span>
      <h2 class="detail-title">${r.emoji || '🍴'} ${r.nome}</h2>
      <p class="detail-meta">${r.cat || ''} · ${r.tempo || ''} · ${r.porzioni || ''} porzioni${r.difficolta ? ' · ' + r.difficolta : ''}</p>

      <div class="sec-label">Ingredienti</div>
      <ul class="ing-list">${ingHTML}</ul>

      <div class="sec-label" style="margin-top:1rem">Procedimento${r.bimby ? ' Bimby TM5' : ''}</div>
      ${stepHTML}

      ${origLink}
      <div class="detail-actions">${timerBtn}</div>
    </div>`;
}

/* ---- TAB NAVIGATION ---- */

function showTab(id, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.getElementById('panel-' + id).classList.add('active');
  if (el) { el.classList.add('active'); el.setAttribute('aria-selected', 'true'); }

  if (id === 'saved')   renderSaved();
  if (id === 'builtin') { renderBuiltinCats(); renderBuiltin(); }
  if (id === 'timer')   renderTimers();
}

/* ---- RICETTARIO (saved) ---- */

function renderSaved() {
  const arr  = loadSaved();
  const q    = (document.getElementById('saved-search')?.value || '').toLowerCase();
  const fil  = arr.filter(r =>
    !q || r.nome.toLowerCase().includes(q) || (r.cat || '').toLowerCase().includes(q)
  );

  document.getElementById('saved-count').textContent =
    `${arr.length} ricett${arr.length === 1 ? 'a' : 'e'} salvat${arr.length === 1 ? 'a' : 'e'}`;

  const grid = document.getElementById('saved-grid');

  if (!arr.length) {
    grid.innerHTML = `<p class="empty">Il tuo ricettario è vuoto.<br>
      Importa una ricetta dal tab <strong>+ Importa</strong>
      oppure salva quelle del tab <strong>🍝 Ricette</strong>.</p>`;
    return;
  }
  if (!fil.length) {
    grid.innerHTML = '<p class="empty">Nessuna ricetta trovata.</p>';
    return;
  }

  grid.innerHTML = fil.map(r => {
    const s = srcInfo(r.fonte || 'web');
    return `<div class="ricetta-card" onclick="openSavedDetail('${r.id}')">
      <span class="card-src ${s.cls}">${s.txt}</span>
      <button class="card-del btn-danger"
        onclick="event.stopPropagation(); confirmDelete('${r.id}')"
        title="Elimina">✕</button>
      <div class="card-nome">${r.emoji || '🍴'} ${r.nome}</div>
      <div class="card-meta">${r.cat || ''} · ${r.tempo || ''}</div>
    </div>`;
  }).join('');
}

function confirmDelete(id) {
  if (!confirm('Eliminare questa ricetta dal ricettario?')) return;
  deleteFromSaved(id);
  renderSaved();
}

function openSavedDetail(id) {
  const r = loadSaved().find(x => x.id === id);
  if (!r) return;
  document.getElementById('saved-list-view').style.display = 'none';
  const dv = document.getElementById('saved-detail-view');
  dv.style.display = 'block';
  dv.innerHTML = buildDetailHTML(r,
    `document.getElementById('saved-list-view').style.display='';
     document.getElementById('saved-detail-view').style.display='none';`
  );
}

/* ---- BUILT-IN ---- */

let builtinCatAttiva = 'Tutto';

function builtinCats() {
  return ['Tutto', ...new Set(BUILTIN_RICETTE.map(r => r.cat))];
}

function renderBuiltinCats() {
  const cont = document.getElementById('builtin-cats');
  cont.innerHTML = builtinCats().map(c =>
    `<button class="src-pill${c === builtinCatAttiva ? ' active' : ''}"
      onclick="builtinCatAttiva='${c}'; renderBuiltinCats(); renderBuiltin();">${c}</button>`
  ).join('');
}

function renderBuiltin() {
  const detail = document.getElementById('builtin-detail');
  if (detail && detail.style.display !== 'none') return;

  const q   = (document.getElementById('builtin-search')?.value || '').toLowerCase();
  const fil = BUILTIN_RICETTE.filter(r => {
    const mc = builtinCatAttiva === 'Tutto' || r.cat === builtinCatAttiva;
    const mq = !q || r.nome.toLowerCase().includes(q);
    return mc && mq;
  });

  const grid = document.getElementById('builtin-grid');
  if (!fil.length) { grid.innerHTML = '<p class="empty">Nessuna ricetta trovata.</p>'; return; }

  grid.innerHTML = fil.map(r => {
    const s = srcInfo(r.fonte || 'classica');
    return `<div class="ricetta-card${r.bimby ? ' is-bimby' : ''}" onclick="openBuiltinDetail('${r.id}')">
      <span class="card-src ${s.cls}">${s.txt}</span>
      <div class="card-nome">${r.emoji} ${r.nome}</div>
      <div class="card-meta">${r.cat} · ${r.tempo} · ${r.porzioni} porz.</div>
    </div>`;
  }).join('');
}

function openBuiltinDetail(id) {
  const r = BUILTIN_RICETTE.find(x => x.id === id);
  if (!r) return;

  const grid    = document.getElementById('builtin-grid');
  const toolbar = document.getElementById('builtin-toolbar');
  const detail  = document.getElementById('builtin-detail');

  grid.style.display    = 'none';
  toolbar.style.display = 'none';
  detail.style.display  = 'block';

  const saveBtn = `<button class="btn-primary" onclick="salvaBuiltin('${r.id}')">
    Salva nel ricettario</button>`;

  detail.innerHTML =
    buildDetailHTML(r, `
      document.getElementById('builtin-grid').style.display='';
      document.getElementById('builtin-toolbar').style.display='';
      document.getElementById('builtin-detail').style.display='none';
    `) .replace('</div>', `${saveBtn}</div>`);
}

function salvaBuiltin(id) {
  const r = BUILTIN_RICETTE.find(x => x.id === id);
  if (!r) return;
  const ok = addToSaved({ ...r });
  if (ok) alert('Ricetta salvata nel ricettario!');
}
