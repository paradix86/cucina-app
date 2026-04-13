/**
 * ui.js — Rendering and UI navigation
 */

/* ================================================================
   SERVINGS SCALING (Point 2)
   ================================================================ */

let _detailRecipe = null; // current recipe open in detail view
let _currentDetailRecipe = null;
let _savedAppHTML = '';
let _cookingRecipe = null;
let _cookingStepIdx = 0;
let cookingTimerInterval = null;
let cookingTimerRemaining = 0;
let cookingTimerRunning = false;
let cookingTimerTotal = 0;
let wakeLock = null;

/**
 * Scale numeric quantities in an ingredient list.
 * Handles integers, decimals (. or ,), and unicode fractions (½ ¼ ¾ …).
 * Leaves strings with no numbers unchanged (e.g. "sale q.b.").
 */
function scaleIngredients(ingredients, base, target) {
  if (base === target) return ingredients;
  const factor = target / base;

  const FRAC = {
    '½': '0.5', '¼': '0.25', '¾': '0.75',
    '⅓': '0.333', '⅔': '0.667',
    '⅛': '0.125', '⅜': '0.375', '⅝': '0.625', '⅞': '0.875',
  };
  const FRAC_INV = { 0.5: '½', 0.25: '¼', 0.75: '¾' };

  return ingredients.map(ing => {
    let s = ing;
    for (const [f, v] of Object.entries(FRAC)) s = s.split(f).join(v);

    s = s.replace(/\d+(?:[.,]\d+)?/g, m => {
      const n      = parseFloat(m.replace(',', '.'));
      const scaled = n * factor;
      const r      = Math.round(scaled * 10) / 10;
      if (FRAC_INV[r] !== undefined) return FRAC_INV[r];
      if (r === Math.floor(r))        return String(Math.floor(r));
      return r.toFixed(1);
    });

    return s;
  });
}

/** Called by the −/+ buttons in the detail view. */
function changeServings(delta) {
  if (!_detailRecipe) return;
  const valEl = document.getElementById('servings-val');
  if (!valEl) return;

  const base    = parseInt(_detailRecipe.servings) || 4;
  const current = parseInt(valEl.textContent);
  const target  = Math.max(1, Math.min(20, current + delta));
  if (target === current) return;

  valEl.textContent = target;

  const scaled = scaleIngredients(_detailRecipe.ingredients || [], base, target);
  const ingList = valEl.closest('.detail-wrap')?.querySelector('.ing-list')
    || document.querySelector('#builtin-detail .ing-list, #saved-detail-view .ing-list');
  if (ingList) ingList.innerHTML = scaled.map(i => `<li>${i}</li>`).join('');
}

/* ================================================================
   SEARCH & FILTER HELPERS (Point 3)
   ================================================================ */

/**
 * Returns true when `recipe` matches `query` across name, category,
 * ingredients and steps.
 */
function recipeMatchesQuery(recipe, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const haystack = [
    recipe.name || recipe.nome || '',
    recipe.category || recipe.cat || '',
    ...(recipe.ingredients || recipe.ingredienti || []),
    ...(recipe.steps || []),
  ].join(' ').toLowerCase();
  return haystack.includes(q);
}

/**
 * Wrap every occurrence of `query` in `text` with <mark>.
 * Only safe to use with trusted content (recipe names from data.js or user input).
 */
function highlight(text, query) {
  if (!query || !text) return text || '';
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark>$1</mark>');
}

/**
 * Parse a time string like "35 min", "1h 30 min", "30 min + 4h riposo"
 * and return total minutes.
 */
function parseRecipeTime(timeStr) {
  if (!timeStr) return 0;
  const hours   = (timeStr.match(/(\d+)\s*h/)   || [])[1] || 0;
  const minutes = (timeStr.match(/(\d+)\s*min/) || [])[1] || 0;
  return parseInt(hours) * 60 + parseInt(minutes);
}

/* ================================================================
   SOURCE INFO
   ================================================================ */

// Maps stored source value → i18n key for display label
const SOURCE_LABEL_KEYS = {
  youtube:   'source_youtube',
  tiktok:    'source_tiktok',
  instagram: 'source_instagram',
  bimby:     'source_bimby',
  classica:  'source_classic',
  manual:    'source_manual',
};

function getSourceInfo(source) {
  const key = SOURCE_LABEL_KEYS[source];
  const txt = key ? t(key) : t('source_web');
  switch (source) {
    case 'youtube':   return { cls: 'badge-yt',       txt };
    case 'tiktok':    return { cls: 'badge-tt',       txt };
    case 'instagram': return { cls: 'badge-ig',       txt };
    case 'bimby':     return { cls: 'badge-bimby',    txt };
    case 'classica':  return { cls: 'badge-classica', txt };
    case 'manual':    return { cls: 'badge-web',      txt };
    default:          return { cls: 'badge-web',      txt: t('source_web') };
  }
}

/* ================================================================
   RECIPE DETAIL BUILDERS
   ================================================================ */

function buildStepsHtml(steps, bimby) {
  return steps.map((s, i) => {
    if (bimby) {
      const sep = s.indexOf(' — ');
      if (sep !== -1) {
        const tags  = s.slice(0, sep).split('·').map(tag => tag.trim()).filter(Boolean);
        const testo = s.slice(sep + 3);
        return `<div class="bimby-step">
          <div class="bimby-step-tags">${tags.map(tag => `<span class="bimby-tag">${tag}</span>`).join('')}</div>
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

/** Format timer duration using i18n units. */
function formatTimerLabel(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m
      ? `${h}${t('hours_short')} ${m} ${t('minutes_short')}`
      : `${h}${t('hours_short')}`;
  }
  return `${min} ${t('minutes_short')}`;
}

function buildDetailHtml(r, onBack) {
  _detailRecipe = r;
  _currentDetailRecipe = r;

  const s        = getSourceInfo(r.source || 'web');
  const basePort = parseInt(r.servings) || 4;
  const ingHtml  = (r.ingredients || []).map(i => `<li>${i}</li>`).join('');
  const stepHtml = buildStepsHtml(r.steps || [], r.bimby);

  const timerBtn = r.timerMinutes > 0
    ? `<button class="btn-primary" onclick="startRecipeTimer('${r.name.replace(/'/g, "\\'")}', ${r.timerMinutes})">
        ${t('detail_timer_btn', { t: formatTimerLabel(r.timerMinutes) })}
       </button>`
    : '';

  const origLink = r.url
    ? `<a href="${r.url}" class="orig-link" target="_blank" rel="noopener">${t('detail_open_source')}</a>`
    : '';

  const servingsCtrl = `
    <div class="servings-ctrl">
      <span class="sec-label">${t('detail_servings')}</span>
      <div class="servings-row">
        <button class="servings-btn" onclick="changeServings(-1)" aria-label="−">−</button>
        <span id="servings-val">${basePort}</span>
        <button class="servings-btn" onclick="changeServings(+1)" aria-label="+">+</button>
      </div>
    </div>`;

  const stepsLabel = r.bimby ? t('detail_steps_bimby') : t('detail_steps');

  return `
    <button class="detail-back" onclick="${onBack}">${t('detail_back')}</button>
    <div class="detail-wrap">
      <span class="card-src ${s.cls}">${s.txt}</span>
      <h2 class="detail-title">${r.emoji || '🍴'} ${r.name}</h2>
      <p class="detail-meta">${r.category || ''} · ${r.time || ''}${r.difficolta ? ' · ' + r.difficolta : ''}</p>

      ${servingsCtrl}

      <div class="sec-label" style="margin-top:1rem">${t('detail_ingredients')}</div>
      <ul class="ing-list">${ingHtml}</ul>

      <div class="sec-label" style="margin-top:1rem">${stepsLabel}</div>
      ${stepHtml}

      <button class="btn-cooking" onclick="startCookingMode('${r.id}')">${t('cooking_start')}</button>

      ${origLink}
      <div class="detail-actions">${timerBtn}</div>
    </div>`;
}

function extractStepMinutes(stepText) {
  const minMatch = stepText.match(/(\d+)\s*min/i);
  const secMatch = stepText.match(/(\d+)\s*sec/i);
  const hourMatch = stepText.match(/(\d+)\s*h/i);
  if (!minMatch && !secMatch && !hourMatch) return 0;
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minMatch ? parseInt(minMatch[1]) : 0;
  const seconds = secMatch ? parseInt(secMatch[1]) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatCookingTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function clearCookingTimer() {
  clearInterval(cookingTimerInterval);
  cookingTimerInterval = null;
  cookingTimerRemaining = 0;
  cookingTimerRunning = false;
  cookingTimerTotal = 0;
}

function updateCookingTimerUI() {
  const display = document.getElementById('cooking-timer-display');
  const toggleBtn = document.getElementById('cooking-timer-toggle');
  if (display) display.textContent = formatCookingTime(cookingTimerRemaining);
  if (toggleBtn) toggleBtn.textContent = cookingTimerRunning ? t('timer_pause') : t('timer_start');
}

function startCookingTimerInterval() {
  clearInterval(cookingTimerInterval);
  cookingTimerInterval = setInterval(() => {
    if (!cookingTimerRunning || cookingTimerRemaining <= 0) return;
    cookingTimerRemaining--;
    if (cookingTimerRemaining <= 0) {
      cookingTimerRemaining = 0;
      cookingTimerRunning = false;
      clearInterval(cookingTimerInterval);
      cookingTimerInterval = null;
      showToast(t('toast_cooking_timer_done'), 'success');
    }
    updateCookingTimerUI();
  }, 1000);
}

function setupCookingStepTimer(stepText) {
  const timerWrap = document.getElementById('cooking-step-timer');
  if (!timerWrap) return;

  const seconds = extractStepMinutes(stepText);
  clearCookingTimer();

  if (seconds <= 0) {
    timerWrap.style.display = 'none';
    return;
  }

  cookingTimerTotal = seconds;
  cookingTimerRemaining = seconds;
  cookingTimerRunning = true;
  timerWrap.style.display = 'block';
  updateCookingTimerUI();
  startCookingTimerInterval();
}

function toggleCookingTimer() {
  if (cookingTimerTotal <= 0) return;
  cookingTimerRunning = !cookingTimerRunning;
  if (cookingTimerRunning && !cookingTimerInterval) startCookingTimerInterval();
  updateCookingTimerUI();
}

function resetCookingTimer() {
  if (cookingTimerTotal <= 0) return;
  clearInterval(cookingTimerInterval);
  cookingTimerInterval = null;
  cookingTimerRemaining = cookingTimerTotal;
  cookingTimerRunning = false;
  updateCookingTimerUI();
}

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) {
      console.warn('Wake Lock not available:', e);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

function showCookingComplete() {
  const stepWrap = document.querySelector('.cooking-step-wrap');
  const timerWrap = document.querySelector('.cooking-step-timer');
  const nextBtn = document.querySelector('.cooking-btn-next');
  if (!stepWrap || !nextBtn) return;

  clearCookingTimer();
  stepWrap.innerHTML = `
    <div class="cooking-complete">
      <div class="cooking-complete-icon">✓</div>
      <div class="cooking-complete-title">${t('cooking_done')}</div>
      <div class="cooking-complete-sub">${t('cooking_done_sub')}</div>
    </div>`;
  if (timerWrap) timerWrap.style.display = 'none';
  nextBtn.disabled = true;
}

function renderCookingMode(recipe, stepIndex = 0) {
  const app = document.querySelector('.app');
  if (!app || !recipe) return;

  const steps = recipe.steps || [];
  const stepText = steps[stepIndex] || '';
  const nextLabel = stepIndex === steps.length - 1 ? t('cooking_done') : t('cooking_next');

  app.innerHTML = `
    <div class="cooking-mode">
      <div class="cooking-header">
        <button class="cooking-exit" onclick="exitCookingMode()">${t('cooking_exit')}</button>
        <span class="cooking-recipe-name">${recipe.name}</span>
        <span class="cooking-progress">${t('cooking_step_of', { current: stepIndex + 1, total: steps.length })}</span>
      </div>

      <details class="cooking-ingredients">
        <summary>${t('detail_ingredients')}</summary>
        <ul class="ing-list">
          ${(recipe.ingredients || []).map(i => `<li>${i}</li>`).join('')}
        </ul>
      </details>

      <div class="cooking-step-wrap">
        <div class="cooking-step-number">${stepIndex + 1}</div>
        <div class="cooking-step-text">${stepText}</div>
      </div>

      <div class="cooking-step-timer" id="cooking-step-timer" style="display:none">
        <div class="sec-label">${t('cooking_step_timer')}</div>
        <div class="cooking-timer-display" id="cooking-timer-display">00:00</div>
        <div class="cooking-timer-btns">
          <button id="cooking-timer-toggle" onclick="toggleCookingTimer()">${t('timer_start')}</button>
          <button onclick="resetCookingTimer()">${t('timer_reset')}</button>
        </div>
      </div>

      <div class="cooking-nav">
        <button class="cooking-btn-prev" onclick="cookingStep(-1)" ${stepIndex === 0 ? 'disabled' : ''}>${t('cooking_prev')}</button>
        <button class="cooking-btn-next" onclick="cookingStep(1)">${nextLabel}</button>
      </div>
    </div>`;

  setupCookingStepTimer(stepText);
}

function startCookingMode(recipeId) {
  const recipe = _currentDetailRecipe;
  if (!recipe) return;
  _cookingRecipe = recipe;
  _cookingStepIdx = 0;
  const app = document.querySelector('.app');
  if (!app) return;
  _savedAppHTML = app.innerHTML;
  requestWakeLock();
  renderCookingMode(recipe, 0);
}

function exitCookingMode() {
  clearCookingTimer();
  releaseWakeLock();
  const app = document.querySelector('.app');
  if (!app) return;
  app.innerHTML = _savedAppHTML;
  applyLanguage();
}

function cookingStep(delta) {
  if (!_cookingRecipe) return;
  const wasLastStep = _cookingStepIdx === _cookingRecipe.steps.length - 1;
  if (delta > 0 && wasLastStep) {
    showCookingComplete();
    return;
  }

  clearCookingTimer();
  _cookingStepIdx = Math.max(0, Math.min(_cookingRecipe.steps.length - 1, _cookingStepIdx + delta));
  renderCookingMode(_cookingRecipe, _cookingStepIdx);
}

/* ================================================================
   TAB NAVIGATION
   ================================================================ */

function showTab(id, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });
  document.getElementById('panel-' + id).classList.add('active');
  if (el) { el.classList.add('active'); el.setAttribute('aria-selected', 'true'); }

  if (id === 'saved')   { renderRecipeBook(); renderSavedSourceFilter(); }
  if (id === 'builtin') { renderBuiltinCategories(); renderBuiltinRecipes(); }
  if (id === 'timer')   renderTimers();
}

/* ================================================================
   RECIPE BOOK (saved)
   ================================================================ */

let activeSavedSourceFilter = 'all';

function renderSavedSourceFilter() {
  const container = document.getElementById('saved-source-filter');
  if (!container) return;

  const sources = ['all', 'youtube', 'tiktok', 'instagram', 'classica', 'bimby', 'web', 'manual'];
  container.innerHTML = '<div class="filter-row">' +
    sources.map(s => {
      const label = s === 'all'
        ? t('filter_all')
        : t(SOURCE_LABEL_KEYS[s] || 'source_web');
      const active = activeSavedSourceFilter === s ? ' active' : '';
      return `<button class="src-pill${active}"
        onclick="activeSavedSourceFilter='${s}'; renderSavedSourceFilter(); renderRecipeBook();">${label}</button>`;
    }).join('') +
    '</div>';
}

function renderRecipeBook() {
  const all = loadRecipeBook();
  const q   = (document.getElementById('saved-search')?.value || '').toLowerCase().trim();

  const fil = all.filter(r => {
    const matchQ = recipeMatchesQuery(r, q);
    const matchS = activeSavedSourceFilter === 'all' || (r.source || 'web') === activeSavedSourceFilter;
    return matchQ && matchS;
  });

  // Result count
  const countEl = document.getElementById('saved-results-count');
  if (countEl) {
    countEl.textContent = (fil.length < all.length)
      ? t('results_showing', { n: fil.length, total: all.length })
      : '';
  }

  // Saved count label
  const n = all.length;
  document.getElementById('saved-count').textContent =
    n === 1 ? t('recipebook_saved', { n }) : t('recipebook_saved_plural', { n });

  const grid = document.getElementById('saved-grid');

  if (!all.length) {
    grid.innerHTML = `<p class="empty">${t('recipebook_empty')}<br>${t('recipebook_empty_hint')}</p>`;
    return;
  }
  if (!fil.length) {
    grid.innerHTML = `<p class="empty">${t('recipebook_notfound')}</p>`;
    return;
  }

  grid.innerHTML = fil.map(r => {
    const s = getSourceInfo(r.source || 'web');
    return `<div class="ricetta-card" onclick="openSavedDetail('${r.id}')">
      <span class="card-src ${s.cls}">${s.txt}</span>
      <button class="card-del btn-danger"
        onclick="event.stopPropagation(); confirmDeleteRecipe('${r.id}')"
        title="✕">✕</button>
      <div class="card-name">${highlight(r.name || '', q)}</div>
      <div class="card-meta">${r.category || ''} · ${r.time || ''}</div>
    </div>`;
  }).join('');
}

function confirmDeleteRecipe(id) {
  if (!confirm(t('delete_confirm'))) return;
  deleteRecipe(id);
  renderRecipeBook();
}

function openSavedDetail(id) {
  const r = loadRecipeBook().find(x => x.id === id);
  if (!r) return;
  document.getElementById('saved-list-view').style.display = 'none';
  const dv = document.getElementById('saved-detail-view');
  dv.style.display = 'block';
  dv.innerHTML = buildDetailHtml(r,
    `document.getElementById('saved-list-view').style.display='';
     document.getElementById('saved-detail-view').style.display='none';`
  );
}

/* ================================================================
   BUILT-IN RECIPES
   ================================================================ */

let activeBuiltinCategory  = '__all__';
let activeSourceFilter     = 'all';      // 'all' | 'classic' | 'bimby'
let maxTimeFilter          = 120;

function getBuiltinCategories() {
  return ['__all__', ...new Set(BUILTIN_RECIPES.map(r => r.category))];
}

function renderBuiltinCategories() {
  const cont = document.getElementById('builtin-cats');
  cont.innerHTML = getBuiltinCategories().map(c => {
    const label  = c === '__all__' ? t('builtin_filter_all') : c;
    const active = c === activeBuiltinCategory ? ' active' : '';
    return `<button class="src-pill${active}"
      onclick="activeBuiltinCategory='${c}'; renderBuiltinCategories(); renderBuiltinRecipes();">${label}</button>`;
  }).join('');

  renderBuiltinFilters();
}

function renderBuiltinFilters() {
  const container = document.getElementById('builtin-filters');
  if (!container) return;

  const isDefaultSource = activeSourceFilter === 'all';
  const isDefaultTime   = maxTimeFilter >= 120;
  const q               = document.getElementById('builtin-search')?.value || '';
  const showReset       = activeBuiltinCategory !== '__all__' || !isDefaultSource || !isDefaultTime || q;

  const timeLabel = isDefaultTime
    ? t('filter_any_time')
    : `${maxTimeFilter} ${t('minutes_short')}`;

  container.innerHTML = `
    <div class="filter-row">
      <span class="filter-label">${t('filter_source')}:</span>
      <button class="src-pill${activeSourceFilter === 'all'     ? ' active' : ''}"
        onclick="activeSourceFilter='all';     renderBuiltinFilters(); renderBuiltinRecipes();">${t('filter_all')}</button>
      <button class="src-pill${activeSourceFilter === 'classic' ? ' active' : ''}"
        onclick="activeSourceFilter='classic'; renderBuiltinFilters(); renderBuiltinRecipes();">${t('filter_classic')}</button>
      <button class="src-pill${activeSourceFilter === 'bimby'   ? ' active' : ''}"
        onclick="activeSourceFilter='bimby';   renderBuiltinFilters(); renderBuiltinRecipes();">${t('filter_bimby')}</button>
    </div>
    <div class="filter-row time-slider-row">
      <span class="filter-label">${t('filter_max_time')}:</span>
      <input type="range" min="5" max="120" step="5" value="${maxTimeFilter}"
        oninput="maxTimeFilter=parseInt(this.value);
                 document.getElementById('time-val').textContent=
                   this.value>=120 ? t('filter_any_time') : this.value+' '+t('minutes_short');
                 renderBuiltinRecipes();" />
      <span id="time-val">${timeLabel}</span>
    </div>
    ${showReset
      ? `<button class="reset-filters" onclick="resetBuiltinFilters()">${t('filter_reset')}</button>`
      : ''}`;
}

function resetBuiltinFilters() {
  activeBuiltinCategory = '__all__';
  activeSourceFilter    = 'all';
  maxTimeFilter         = 120;
  const searchEl = document.getElementById('builtin-search');
  if (searchEl) searchEl.value = '';
  renderBuiltinCategories();
  renderBuiltinRecipes();
}

function renderBuiltinRecipes() {
  const detail = document.getElementById('builtin-detail');
  if (detail && detail.style.display !== 'none') return;

  renderBuiltinFilters();

  const q   = (document.getElementById('builtin-search')?.value || '').trim();
  const fil = BUILTIN_RECIPES
    .filter(r => recipeMatchesQuery(r, q))
    .filter(r => activeBuiltinCategory === '__all__' || r.category === activeBuiltinCategory)
    .filter(r =>
      activeSourceFilter === 'all' ||
      (activeSourceFilter === 'bimby'   && r.bimby) ||
      (activeSourceFilter === 'classic' && !r.bimby)
    )
    .filter(r => parseRecipeTime(r.time) <= maxTimeFilter);

  // Result count
  const countEl = document.getElementById('builtin-results-count');
  if (countEl) {
    countEl.textContent = (fil.length < BUILTIN_RECIPES.length)
      ? t('results_showing', { n: fil.length, total: BUILTIN_RECIPES.length })
      : '';
  }

  const grid = document.getElementById('builtin-grid');
  if (!fil.length) {
    grid.innerHTML = `<p class="empty">${t('recipebook_notfound')}</p>`;
    return;
  }

  grid.innerHTML = fil.map(r => {
    const s = getSourceInfo(r.source || 'classica');
    const name = r.name || r.nome || '';
    return `<div class="ricetta-card${r.bimby ? ' is-bimby' : ''}" onclick="openBuiltinDetail('${r.id}')">
      <span class="card-src ${s.cls}">${s.txt}</span>
      <div class="card-name">${highlight(name, q)}</div>
      <div class="card-meta">${r.category} · ${r.time} · ${r.servings} ${t('detail_servings').toLowerCase()}</div>
    </div>`;
  }).join('');
}

function openBuiltinDetail(id) {
  const r = BUILTIN_RECIPES.find(x => x.id === id);
  if (!r) return;

  const grid    = document.getElementById('builtin-grid');
  const toolbar = document.getElementById('builtin-toolbar');
  const detail  = document.getElementById('builtin-detail');

  grid.style.display    = 'none';
  toolbar.style.display = 'none';
  detail.style.display  = 'block';

  const saveBtn = `<button class="btn-primary" onclick="saveBuiltinRecipe('${r.id}')">${t('builtin_save')}</button>`;

  detail.innerHTML =
    buildDetailHtml(r, `
      document.getElementById('builtin-grid').style.display='';
      document.getElementById('builtin-toolbar').style.display='';
      document.getElementById('builtin-detail').style.display='none';
    `).replace('</div>', `${saveBtn}</div>`);
}

function saveBuiltinRecipe(id) {
  const r  = BUILTIN_RECIPES.find(x => x.id === id);
  if (!r) return;
  const ok = addRecipe({ ...r });
  if (ok) {
    showToast(t('builtin_saved_ok'), 'success');
  } else {
    showToast(t('builtin_already_saved'), 'info');
  }
}
