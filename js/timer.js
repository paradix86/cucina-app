/**
 * timer.js — Multiple parallel timers
 */

let timers = {};
let timerInterval = null;

function addTimer() {
  const name  = document.getElementById('t-name').value.trim() || 'Pietanza';
  const min   = parseInt(document.getElementById('t-min').value) || 0;
  const sec   = parseInt(document.getElementById('t-sec').value) || 0;
  const total = min * 60 + sec;
  if (total <= 0) { showToast(t('timer_invalid'), 'error'); return; }

  const id = 't' + Date.now();
  timers[id] = { name, total, remaining: total, running: true };
  renderTimers();
  ensureTimerInterval();
  document.getElementById('t-name').value = '';
}

function startRecipeTimer(name, min) {
  const existing = Object.values(timers).find(
    timer => timer.name === name && timer.remaining > 0
  );
  if (existing) {
    showTab('timer', document.getElementById('tab-timer'));
    return;
  }

  const id = 't' + Date.now();
  timers[id] = { name, total: min * 60, remaining: min * 60, running: true };
  renderTimers();
  ensureTimerInterval();
  showTab('timer', document.getElementById('tab-timer'));
}

function toggleTimer(id) {
  if (!timers[id]) return;
  timers[id].running = !timers[id].running;
  renderTimers();
}

function resetTimer(id) {
  if (!timers[id]) return;
  timers[id].remaining = timers[id].total;
  timers[id].running   = false;
  renderTimers();
}

function deleteTimer(id) {
  delete timers[id];
  renderTimers();
}

function formatTime(s) {
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function renderTimers() {
  const grid  = document.getElementById('timer-grid');
  const empty = document.getElementById('timer-empty');
  const ids   = Object.keys(timers);

  if (!ids.length) {
    grid.innerHTML     = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = ids.map(id => {
    const timer    = timers[id];
    const cls      = timer.remaining <= 0 ? 'done' : timer.running ? 'running' : '';
    const disp     = timer.remaining <= 0 ? t('timer_ready') : formatTime(timer.remaining);
    const btnLabel = (timer.running && timer.remaining > 0) ? t('timer_pause') : t('timer_start');

    return `<div class="timer-card">
      <div class="t-name">${timer.name}</div>
      <div class="t-display ${cls}">${disp}</div>
      <div class="t-btns">
        <button onclick="toggleTimer('${id}')">${btnLabel}</button>
        <button onclick="resetTimer('${id}')">${t('timer_reset')}</button>
        <button class="t-del" onclick="deleteTimer('${id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

function ensureTimerInterval() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    let changed = false;
    Object.keys(timers).forEach(id => {
      const timer = timers[id];
      if (timer.running && timer.remaining > 0) { timer.remaining--; changed = true; }
      if (timer.remaining === 0 && timer.running) {
        timer.running = false;
        changed = true;
        showToast(t('toast_timer_done', { name: timer.name }), 'success');
      }
    });
    if (changed) renderTimers();
  }, 1000);
}
