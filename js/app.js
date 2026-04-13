/**
 * app.js — Entry point: initialisation on page load
 */

const THEME_STORAGE_KEY = 'cucina_theme';
const APP_META = {
  version: 'v0.10.0',
  buildDate: '2026-04-13',
  authorLine: 'Made with ❤️ by Alan in Switzerland',
};
const SW_RELOAD_FLAG = 'cucina_sw_reloaded_once';

function formatEuropeanDate(isoDate) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate || '');
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function renderFooter() {
  const footer = document.getElementById('app-footer');
  if (!footer) return;
  const year = new Date().getFullYear();
  footer.textContent = `${APP_META.authorLine} · ${year} · ${APP_META.version} · build ${formatEuropeanDate(APP_META.buildDate)}`;
}

function applyThemePreference(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
  applyThemePreference(savedTheme);

  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.value = savedTheme;
    themeSelect.onchange = event => setThemePreference(event.target.value);
    themeSelect.oninput = event => setThemePreference(event.target.value);
  }
}

function setThemePreference(theme) {
  const nextTheme = ['system', 'light', 'dark'].includes(theme) ? theme : 'system';
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyThemePreference(nextTheme);
}

window.setThemePreference = setThemePreference;

function initServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return;

  let hasReloadedForUpdate = sessionStorage.getItem(SW_RELOAD_FLAG) === '1';

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloadedForUpdate) return;
    hasReloadedForUpdate = true;
    sessionStorage.setItem(SW_RELOAD_FLAG, '1');
    window.location.reload();
  });

  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.update().catch(() => {});

    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          installing.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  }).catch(err => {
    console.warn('Service Worker registration failed:', err);
  });
}

function bootApp() {
  renderFooter();
  initTheme();
  migrateFromV2();   // one-time localStorage migration v2 → v3
  initI18n();        // detect/restore language, apply translations
  const backupInput = document.getElementById('backup-file-input');
  if (backupInput && !backupInput.dataset.bound) {
    backupInput.addEventListener('change', handleImportBackup);
    backupInput.dataset.bound = 'true';
  }
  renderRecipeBook();
  renderSavedSourceFilter();
  renderBuiltinCategories();
  renderBuiltinRecipes();
  renderShoppingList();
  renderTimers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

/* ---- PWA: Service Worker registration ---- */
initServiceWorkerUpdates();
