/**
 * timer.js — Gestione timer multipli in parallelo
 */

let timers = {};
let timerInterval = null;

function addTimer() {
  const nome = document.getElementById('t-name').value.trim() || 'Pietanza';
  const min  = parseInt(document.getElementById('t-min').value)  || 0;
  const sec  = parseInt(document.getElementById('t-sec').value)  || 0;
  const tot  = min * 60 + sec;
  if (tot <= 0) { alert('Inserisci un tempo valido!'); return; }

  const id = 't' + Date.now();
  timers[id] = { nome, totale: tot, rimasto: tot, running: true };
  renderTimers();
  ensureInterval();
  document.getElementById('t-name').value = '';
}

function avviaTimerDaRicetta(nome, min) {
  const id = 't' + Date.now();
  timers[id] = { nome, totale: min * 60, rimasto: min * 60, running: true };
  renderTimers();
  ensureInterval();
  showTab('timer', document.querySelectorAll('.tab')[3]);
}

function toggleTimer(id) {
  if (!timers[id]) return;
  timers[id].running = !timers[id].running;
  renderTimers();
}

function resetTimer(id) {
  if (!timers[id]) return;
  timers[id].rimasto = timers[id].totale;
  timers[id].running = false;
  renderTimers();
}

function deleteTimer(id) {
  delete timers[id];
  renderTimers();
}

function fmtTime(s) {
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

function renderTimers() {
  const grid  = document.getElementById('timer-grid');
  const empty = document.getElementById('timer-empty');
  const ids   = Object.keys(timers);

  if (!ids.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = ids.map(id => {
    const t    = timers[id];
    const cls  = t.rimasto <= 0 ? 'done' : t.running ? 'running' : '';
    const disp = t.rimasto <= 0 ? 'PRONTO!' : fmtTime(t.rimasto);
    const btnLabel = (t.running && t.rimasto > 0) ? 'Pausa' : 'Avvia';

    return `<div class="timer-card">
      <div class="t-name">${t.nome}</div>
      <div class="t-display ${cls}">${disp}</div>
      <div class="t-btns">
        <button onclick="toggleTimer('${id}')">${btnLabel}</button>
        <button onclick="resetTimer('${id}')">Reset</button>
        <button class="t-del" onclick="deleteTimer('${id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

function ensureInterval() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    let changed = false;
    Object.keys(timers).forEach(id => {
      const t = timers[id];
      if (t.running && t.rimasto > 0) { t.rimasto--; changed = true; }
      if (t.rimasto === 0 && t.running) { t.running = false; changed = true; }
    });
    if (changed) renderTimers();
  }, 1000);
}
