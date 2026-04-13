/**
 * app.js — Entry point: initialisation on page load
 */

const THEME_STORAGE_KEY = 'cucina_theme';

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

function bootApp() {
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
  renderTimers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

/* ---- PWA: Service Worker registration ---- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.warn('Service Worker registration failed:', err);
  });
}
