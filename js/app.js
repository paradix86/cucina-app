/**
 * app.js — Entry point: initialisation on page load
 */

document.addEventListener('DOMContentLoaded', () => {
  migrateFromV2();   // one-time localStorage migration v2 → v3
  initI18n();        // detect/restore language, apply translations
  renderRecipeBook();
  renderSavedSourceFilter();
  renderBuiltinCategories();
  renderBuiltinRecipes();
  renderTimers();
});

/* ---- PWA: Service Worker registration ---- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.warn('Service Worker registration failed:', err);
  });
}
