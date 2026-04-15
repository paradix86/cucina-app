import { APP_META } from '../lib/appMeta.js';

const SW_RELOAD_FLAG = `cucina_sw_reloaded_${APP_META.buildDate}`;

export async function refreshAppRuntime() {
  try {
    sessionStorage.removeItem(SW_RELOAD_FLAG);
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.update().catch(() => {})));
      regs.forEach(reg => {
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      });
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch (error) {
    console.warn('App refresh failed:', error);
  }
  window.location.reload();
}

export function initServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return;

  let hasReloadedForUpdate = sessionStorage.getItem(SW_RELOAD_FLAG) === '1';

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloadedForUpdate) return;
    hasReloadedForUpdate = true;
    sessionStorage.setItem(SW_RELOAD_FLAG, '1');
    window.location.reload();
  });

  navigator.serviceWorker.register('/sw.js').then(reg => {
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
  }).catch(error => {
    console.warn('Service Worker registration failed:', error);
  });
}
