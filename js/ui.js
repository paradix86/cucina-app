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
      const n = parseFloat(m.replace(',', '.'));
      const scaled = n * factor;
      const r = Math.round(scaled * 10) / 10;
      if (FRAC_INV[r] !== undefined) return FRAC_INV[r];
      if (r === Math.floor(r)) return String(Math.floor(r));
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

  const base = parseInt(_detailRecipe.servings) || 4;
  const current = parseInt(valEl.textContent);
  const target = Math.max(1, Math.min(20, current + delta));
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
  const hours = (timeStr.match(/(\d+)\s*h/) || [])[1] || 0;
  const minutes = (timeStr.match(/(\d+)\s*min/) || [])[1] || 0;
  return parseInt(hours) * 60 + parseInt(minutes);
}

/* ================================================================
   SOURCE INFO
   ================================================================ */

// Maps stored source value → i18n key for display label
const SOURCE_LABEL_KEYS = {
  youtube: 'source_youtube',
  tiktok: 'source_tiktok',
  instagram: 'source_instagram',
  bimby: 'source_bimby',
  classica: 'source_classic',
  manual: 'source_manual',
};

function getSourceInfo(source) {
  const key = SOURCE_LABEL_KEYS[source];
  const txt = key ? t(key) : t('source_web');
  switch (source) {
    case 'youtube': return { cls: 'badge-yt', txt };
    case 'tiktok': return { cls: 'badge-tt', txt };
    case 'instagram': return { cls: 'badge-ig', txt };
    case 'bimby': return { cls: 'badge-bimby', txt };
    case 'classica': return { cls: 'badge-classica', txt };
    case 'manual': return { cls: 'badge-web', txt };
    default: return { cls: 'badge-web', txt: t('source_web') };
  }
}

function getSourceDomainLabel(domain) {
  const normalized = String(domain || '').trim().toLowerCase();
  if (!normalized) return '';
  const pretty = {
    'giallozafferano.it': 'GialloZafferano',
    'ricetteperbimby.it': 'RicettePerBimby',
    'youtube.com': 'YouTube',
    'youtu.be': 'YouTube',
    'instagram.com': 'Instagram',
    'tiktok.com': 'TikTok',
    'cookidoo.it': 'Cookidoo',
    'allrecipes.com': 'Allrecipes',
  };
  return pretty[normalized] || normalized;
}

function getPreparationInfo(recipe) {
  const preparationType = getPreparationType(recipe);
  switch (preparationType) {
    case 'bimby':
      return { type: preparationType, cls: 'badge-bimby', txt: t('prep_bimby'), cardCls: ' is-bimby' };
    case 'airfryer':
      return { type: preparationType, cls: 'badge-airfryer', txt: t('prep_airfryer'), cardCls: ' is-airfryer' };
    default:
      return { type: 'classic', cls: 'badge-classica', txt: t('prep_classic'), cardCls: '' };
  }
}

/* ================================================================
   RECIPE DETAIL BUILDERS
   ================================================================ */

function buildStepsHtml(steps, preparationType) {
  return steps.map((s, i) => {
    if (preparationType === 'bimby') {
      const sep = s.indexOf(' — ');
      if (sep !== -1) {
        const tags = s.slice(0, sep).split('·').map(tag => tag.trim()).filter(Boolean);
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

function joinMetaParts(parts) {
  return (parts || []).filter(Boolean).join(' · ');
}

function buildDetailHtml(r, onBack) {
  _detailRecipe = r;
  _currentDetailRecipe = r;

  const prepInfo = getPreparationInfo(r);
  const basePort = parseInt(r.servings) || 4;
  const ingHtml = (r.ingredients || []).map(i => `<li>${i}</li>`).join('');
  const stepHtml = buildStepsHtml(r.steps || [], prepInfo.type);
  const sourceDomainHtml = r.sourceDomain
    ? `<p class="detail-origin"><span class="sec-label-inline">${t('detail_source_site')}:</span> ${getSourceDomainLabel(r.sourceDomain)}</p>`
    : '';
  const methodHtml = `<p class="detail-method"><span class="sec-label-inline">${t('detail_method')}:</span> ${prepInfo.txt}</p>`;

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

  const stepsLabel = prepInfo.type === 'bimby' ? t('detail_steps_bimby') : t('detail_steps');
  const shoppingBtn = `<button class="btn-shopping" onclick="addCurrentRecipeIngredientsToShoppingList()">🛒 ${t('shopping_add')}</button>`;

  return `
    <button class="detail-back" onclick="${onBack}">${t('detail_back')}</button>
    <div class="detail-wrap">
      <h2 class="detail-title">${r.emoji || '🍴'} ${r.name}</h2>
      <p class="detail-meta">${joinMetaParts([r.category, r.time, r.difficolta])}</p>
      ${methodHtml}
      ${sourceDomainHtml}

      ${servingsCtrl}

      <div class="sec-label" style="margin-top:1rem">${t('detail_ingredients')}</div>
      <ul class="ing-list">${ingHtml}</ul>
      <div style="margin-top:0.8rem">${shoppingBtn}</div>

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
  cookingTimerRunning = false;
  timerWrap.style.display = 'block';
  updateCookingTimerUI();
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

  if (id === 'saved') { renderRecipeBook(); renderSavedSourceFilter(); }
  if (id === 'builtin') { renderBuiltinCategories(); renderBuiltinRecipes(); }
  if (id === 'shopping') renderShoppingList();
  if (id === 'timer') renderTimers();
}

function goHome() {
  if (document.querySelector('.cooking-mode')) {
    exitCookingMode();
  }

  const savedList = document.getElementById('saved-list-view');
  const savedDetail = document.getElementById('saved-detail-view');
  if (savedList) savedList.style.display = '';
  if (savedDetail) savedDetail.style.display = 'none';

  const builtinGrid = document.getElementById('builtin-grid');
  const builtinToolbar = document.getElementById('builtin-toolbar');
  const builtinDetail = document.getElementById('builtin-detail');
  if (builtinGrid) builtinGrid.style.display = '';
  if (builtinToolbar) builtinToolbar.style.display = '';
  if (builtinDetail) builtinDetail.style.display = 'none';

  const firstTab = document.querySelector('.tab');
  if (firstTab) showTab('saved', firstTab);
}

/* ================================================================
   SHOPPING LIST
   ================================================================ */

function formatShoppingCount(count) {
  return count === 1
    ? t('shopping_count', { n: count })
    : t('shopping_count_plural', { n: count });
}

function addCurrentRecipeIngredientsToShoppingList() {
  const recipe = _currentDetailRecipe;
  if (!recipe || !Array.isArray(recipe.ingredients) || !recipe.ingredients.length) return;
  const added = addShoppingListItems(recipe.ingredients, { id: recipe.id, name: recipe.name });
  if (!added) return;
  showToast(t('shopping_added_toast', { n: added }), 'success');
}

function renderShoppingList() {
  const listEl = document.getElementById('shopping-list');
  const countEl = document.getElementById('shopping-count');
  const clearBtn = document.getElementById('shopping-clear-btn');
  if (!listEl || !countEl || !clearBtn) return;

  const items = loadShoppingList();
  countEl.textContent = formatShoppingCount(items.length);
  clearBtn.style.display = items.length ? '' : 'none';

  if (!items.length) {
    listEl.innerHTML = `<p class="empty">${t('shopping_empty')}</p>`;
    return;
  }

  // Group items intelligently
  const { grouped, ungrouped } = groupShoppingItems(items);

  // Build grouped section first
  const groupedHtml = grouped.map(group => {
    const groupId = `group-${group.baseName.replace(/\s+/g, '-')}`;
    const itemsHtml = group.items.map(item => {
      const parsed = parseIngredient(item.text);
      const displayQty = parsed.parsedQty
        ? `${formatQuantity(parsed.parsedQty)} ${parsed.parsedUnit}`
        : '';
      const recipeName = item.sourceRecipeName || '?';
      return `
        <div class="shopping-group-contribution">
          <span class="contrib-qty">${displayQty}</span>
          <span class="contrib-recipe">· ${recipeName}</span>
        </div>`;
    }).join('');

    return `
      <div class="shopping-grouped-item">
        <label class="shopping-item-main">
          <input type="checkbox"
            class="shopping-group-checkbox"
            data-group="${groupId}"
            ${group.items.some(i => !i.checked) ? '' : 'checked'}
            onchange="toggleShoppingGroupCheckboxes('${groupId}', this.checked)">
          <span class="shopping-item-text shopping-item-total">
            ${group.baseName} — ${group.displayQty} ${group.unit}
          </span>
        </label>
        <button class="shopping-remove" onclick="removeShoppingGroupUI('${groupId}')"
          aria-label="${t('shopping_remove')}">✕</button>
        <div class="shopping-group-breakdown">
          ${itemsHtml}
        </div>
      </div>`;
  }).join('');

  // Build ungrouped section
  const ungroupedHtml = ungrouped.map(item => `
    <div class="shopping-item${item.checked ? ' is-checked' : ''}">
      <label class="shopping-item-main">
        <input type="checkbox" ${item.checked ? 'checked' : ''}
          onchange="toggleShoppingListItemUI('${item.id}')">
        <span class="shopping-item-text">${item.text}</span>
      </label>
      <button class="shopping-remove" onclick="removeShoppingListItemUI('${item.id}')"
        aria-label="${t('shopping_remove')}">✕</button>
    </div>`).join('');

  listEl.innerHTML = `<div class="shopping-list-rows">` +
    (groupedHtml || '') +
    (ungroupedHtml || '') +
    `</div>`;
}

function toggleShoppingGroupCheckboxes(groupId, checked) {
  const items = loadShoppingList();
  const baseName = groupId.replace('group-', '').replace(/-/g, ' ');
  const parsed = items
    .filter(item => {
      const p = parseIngredient(item.text);
      return p.parsedName === baseName;
    });

  parsed.forEach(item => {
    item.checked = checked;
  });

  saveShoppingList(items);
  renderShoppingList();
}

function removeShoppingGroupUI(groupId) {
  const items = loadShoppingList();
  const baseName = groupId.replace('group-', '').replace(/-/g, ' ');

  // Remove all items in this group
  const filtered = items.filter(item => {
    const p = parseIngredient(item.text);
    return p.parsedName !== baseName;
  });

  if (filtered.length === items.length) return; // Nothing removed
  saveShoppingList(filtered);
  renderShoppingList();
}

function toggleShoppingListItemUI(id) {
  if (!toggleShoppingListItem(id)) return;
  renderShoppingList();
}

function removeShoppingListItemUI(id) {
  if (!removeShoppingListItem(id)) return;
  renderShoppingList();
}

function clearShoppingListUI() {
  const items = loadShoppingList();
  if (!items.length) return;
  if (!confirm(t('shopping_clear_confirm'))) return;
  clearShoppingList();
  renderShoppingList();
  showToast(t('shopping_cleared_toast'), 'info');
}

/* ================================================================
   RECIPE BOOK (saved)
   ================================================================ */

let activeSavedSourceFilter = 'all';
let activeSavedFilterType = 'all'; // 'all', 'favorites', 'recent'
let activeSavedSiteFilter = 'all'; // 'all' | a sourceDomain value

function renderSavedSourceFilter() {
  const container = document.getElementById('saved-source-filter');
  if (!container) return;

  const sources = ['all', 'youtube', 'tiktok', 'instagram', 'classica', 'bimby', 'web', 'manual'];
  const types = ['all', 'favorites', 'recent'];
  const sourceLabels = {
    all: window.t('filter_all'),
    youtube: window.t('source_youtube'),
    tiktok: window.t('source_tiktok'),
    instagram: window.t('source_instagram'),
    classica: window.t('source_classic'),
    bimby: window.t('source_bimby'),
    web: window.t('source_web'),
    manual: window.t('source_manual')
  };

  // Site filter: dynamically built from persisted sourceDomain values
  const allRecipes = loadRecipeBook();
  const domains = [...new Set(allRecipes.map(r => r.sourceDomain).filter(Boolean))];
  const siteCounts = domains.reduce((acc, domain) => {
    acc[domain] = allRecipes.filter(r => r.sourceDomain === domain).length;
    return acc;
  }, {});
  domains.sort((a, b) => getSourceDomainLabel(a).localeCompare(getSourceDomainLabel(b)));
  if (activeSavedSiteFilter !== 'all' && !domains.includes(activeSavedSiteFilter)) activeSavedSiteFilter = 'all';
  const siteFilterHtml = domains.length
    ? `<div class="saved-filter-group">
      <span class="filter-group-label">${window.t('filter_site')}:</span>
      <div class="filter-row">` +
    `<button class="site-pill${activeSavedSiteFilter === 'all' ? ' active' : ''}"
        onclick="activeSavedSiteFilter='all'; renderSavedSourceFilter(); renderRecipeBook();">${window.t('filter_all_sites')} <span class="pill-count">(${allRecipes.length})</span></button>` +
    domains.map(d => {
      const label = getSourceDomainLabel(d);
      const active = activeSavedSiteFilter === d ? ' active' : '';
      const safeD = d.replace(/'/g, "\\'");
      return `<button class="site-pill${active}"
          onclick="activeSavedSiteFilter='${safeD}'; renderSavedSourceFilter(); renderRecipeBook();">${label} <span class="pill-count">(${siteCounts[d] || 0})</span></button>`;
    }).join('') +
    '</div></div>'
    : '';

  container.innerHTML =
    '<div class="saved-filter-group"><div class="filter-row">' +
    sources.map(s => {
      const label = sourceLabels[s];
      const active = activeSavedSourceFilter === s ? ' active' : '';
      return `<button class="src-pill${active}"
        onclick="activeSavedSourceFilter='${s}'; renderSavedSourceFilter(); renderRecipeBook();">${label}</button>`;
    }).join('') +
    '</div></div><div class="saved-filter-group"><div class="filter-row">' +
    types.map(tp => {
      const label = tp === 'all' ? window.t('filter_all') : window.t(`filter_${tp}`);
      const active = activeSavedFilterType === tp ? ' active' : '';
      return `<button class="type-pill${active}"
        onclick="activeSavedFilterType='${tp}'; renderSavedSourceFilter(); renderRecipeBook();">${label}</button>`;
    }).join('') +
    '</div>' +
    siteFilterHtml;
}

function renderRecipeBook() {
  const all = loadRecipeBook();
  const q = (document.getElementById('saved-search')?.value || '').toLowerCase().trim();

  const fil = all.filter(r => {
    const matchQ = recipeMatchesQuery(r, q);
    const matchS = activeSavedSourceFilter === 'all' || (r.source || 'web') === activeSavedSourceFilter;
    const matchT = activeSavedFilterType === 'all' ||
      (activeSavedFilterType === 'favorites' && r.favorite) ||
      (activeSavedFilterType === 'recent' && r.lastViewedAt);
    const matchSite = activeSavedSiteFilter === 'all' || r.sourceDomain === activeSavedSiteFilter;
    return matchQ && matchS && matchT && matchSite;
  });

  // Sort for recent
  if (activeSavedFilterType === 'recent') {
    fil.sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0));
  }

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
    const prep = getPreparationInfo(r);
    const domainLabel = r.sourceDomain ? getSourceDomainLabel(r.sourceDomain) : '';
    return `<div class="ricetta-card" onclick="openSavedDetail('${r.id}')">
      <span class="card-src ${prep.cls}">${prep.txt}</span>
      <button class="card-del btn-danger"
        onclick="event.stopPropagation(); confirmDeleteRecipe('${r.id}')"
        title="✕">✕</button>
      <button class="card-fav"
        onclick="event.stopPropagation(); toggleRecipeFavorite('${r.id}'); renderRecipeBook();"
        title="${r.favorite ? t('favorite_remove') : t('favorite_add')}">${r.favorite ? '★' : '☆'}</button>
      <div class="card-name">${highlight(r.name || '', q)}</div>
      <div class="card-meta">${joinMetaParts([r.category, r.time])}</div>
      ${domainLabel ? `<div class="card-origin">${domainLabel}</div>` : ''}
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
  markRecipeViewed(id); // Mark as viewed
  document.getElementById('saved-list-view').style.display = 'none';
  const dv = document.getElementById('saved-detail-view');
  dv.style.display = 'block';
  dv.innerHTML = buildDetailHtml(r,
    `document.getElementById('saved-list-view').style.display='';
     document.getElementById('saved-detail-view').style.display='none';`
  ) + `
    <div class="detail-actions">
      <button class="btn-secondary" onclick="toggleRecipeFavorite('${r.id}'); openSavedDetail('${r.id}');">
        ${r.favorite ? t('favorite_remove') : t('favorite_add')}
      </button>
    </div>
    <div class="notes-box card">
      <div class="sec-label">${t('recipe_notes')}</div>
      <textarea id="recipe-notes-input" class="notes-textarea"
        placeholder="${t('recipe_notes_placeholder')}">${r.notes || ''}</textarea>
      <div class="notes-actions">
        <button class="btn-primary" onclick="saveRecipeNotes('${r.id}')">${t('recipe_notes_save')}</button>
      </div>
    </div>`;
}

function saveRecipeNotes(id) {
  const textarea = document.getElementById('recipe-notes-input');
  if (!textarea) return;
  const ok = updateRecipeNotes(id, textarea.value);
  if (ok) showToast(t('recipe_notes_saved'), 'success');
}

function handleExportBackup() {
  const count = exportRecipeBook();
  showToast(t('backup_export_ok'), 'success');
  return count;
}

function triggerImportBackup() {
  const input = document.getElementById('backup-file-input');
  if (!input) return;
  input.click();
}

async function handleImportBackup(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const total = await importRecipeBook(file);
    showToast(t('backup_import_ok', { n: total }), 'success');
    renderRecipeBook();
    renderSavedSourceFilter();
  } catch (err) {
    showToast(t('backup_import_err'), 'error');
  } finally {
    event.target.value = '';
  }
}

/* ================================================================
   BUILT-IN RECIPES
   ================================================================ */

let activeBuiltinCategory = '__all__';
let activePreparationFilter = 'all';      // 'all' | 'classic' | 'bimby' | 'airfryer'
let maxTimeFilter = 120;

function getBuiltinCategories() {
  return ['__all__', ...new Set(BUILTIN_RECIPES.map(r => r.category))];
}

function renderBuiltinCategories() {
  const cont = document.getElementById('builtin-cats');
  cont.innerHTML = getBuiltinCategories().map(c => {
    const label = c === '__all__' ? t('builtin_filter_all') : c;
    const active = c === activeBuiltinCategory ? ' active' : '';
    return `<button class="src-pill${active}"
      onclick="activeBuiltinCategory='${c}'; renderBuiltinCategories(); renderBuiltinRecipes();">${label}</button>`;
  }).join('');

  renderBuiltinFilters();
}

function renderBuiltinFilters() {
  const container = document.getElementById('builtin-filters');
  if (!container) return;

  const isDefaultPreparation = activePreparationFilter === 'all';
  const isDefaultTime = maxTimeFilter >= 120;
  const q = document.getElementById('builtin-search')?.value || '';
  const showReset = activeBuiltinCategory !== '__all__' || !isDefaultPreparation || !isDefaultTime || q;

  const timeLabel = isDefaultTime
    ? t('filter_any_time')
    : `${maxTimeFilter} ${t('minutes_short')}`;

  container.innerHTML = `
    <div class="filter-row">
      <span class="filter-label">${t('filter_method')}:</span>
      <button class="src-pill${activePreparationFilter === 'all' ? ' active' : ''}"
        onclick="activePreparationFilter='all';       renderBuiltinFilters(); renderBuiltinRecipes();">${t('filter_all')}</button>
      <button class="src-pill${activePreparationFilter === 'classic' ? ' active' : ''}"
        onclick="activePreparationFilter='classic';   renderBuiltinFilters(); renderBuiltinRecipes();">${t('filter_classic')}</button>
      <button class="src-pill${activePreparationFilter === 'bimby' ? ' active' : ''}"
        onclick="activePreparationFilter='bimby';     renderBuiltinFilters(); renderBuiltinRecipes();">${t('filter_bimby')}</button>
      <button class="src-pill${activePreparationFilter === 'airfryer' ? ' active' : ''}"
        onclick="activePreparationFilter='airfryer';  renderBuiltinFilters(); renderBuiltinRecipes();">${t('filter_airfryer')}</button>
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
  activePreparationFilter = 'all';
  maxTimeFilter = 120;
  const searchEl = document.getElementById('builtin-search');
  if (searchEl) searchEl.value = '';
  renderBuiltinCategories();
  renderBuiltinRecipes();
}

function renderBuiltinRecipes() {
  const detail = document.getElementById('builtin-detail');
  if (detail && detail.style.display !== 'none') return;

  renderBuiltinFilters();

  const q = (document.getElementById('builtin-search')?.value || '').trim();
  const fil = BUILTIN_RECIPES
    .filter(r => recipeMatchesQuery(r, q))
    .filter(r => activeBuiltinCategory === '__all__' || r.category === activeBuiltinCategory)
    .filter(r => activePreparationFilter === 'all' || getPreparationType(r) === activePreparationFilter)
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
    const prep = getPreparationInfo(r);
    const name = r.name || r.nome || '';
    return `<div class="ricetta-card${prep.cardCls}" onclick="openBuiltinDetail('${r.id}')">
      <span class="card-src ${prep.cls}">${prep.txt}</span>
      <div class="card-name">${highlight(name, q)}</div>
      <div class="card-meta">${r.category} · ${r.time} · ${r.servings} ${t('detail_servings').toLowerCase()}</div>
    </div>`;
  }).join('');
}

function openBuiltinDetail(id) {
  const r = BUILTIN_RECIPES.find(x => x.id === id);
  if (!r) return;

  const grid = document.getElementById('builtin-grid');
  const toolbar = document.getElementById('builtin-toolbar');
  const detail = document.getElementById('builtin-detail');

  grid.style.display = 'none';
  toolbar.style.display = 'none';
  detail.style.display = 'block';

  const saveBtn = `<button class="btn-primary" onclick="saveBuiltinRecipe('${r.id}')">${t('builtin_save')}</button>`;

  detail.innerHTML =
    buildDetailHtml(r, `
      document.getElementById('builtin-grid').style.display='';
      document.getElementById('builtin-toolbar').style.display='';
      document.getElementById('builtin-detail').style.display='none';
    `).replace('</div>', `${saveBtn}</div>`);
}

function saveBuiltinRecipe(id) {
  const r = BUILTIN_RECIPES.find(x => x.id === id);
  if (!r) return;
  const ok = addRecipe({ ...r });
  if (ok) {
    showToast(t('builtin_saved_ok'), 'success');
  } else {
    showToast(t('builtin_already_saved'), 'info');
  }
}
