import { APP_META } from '../lib/appMeta';
import { t } from '../lib/i18n';

type ShowToast = (message: string, type?: string, options?: { actionLabel?: string; onAction?: () => void }) => void;

const SW_RELOAD_FLAG = `cucina_sw_reloaded_${APP_META.buildId}`;

export async function refreshAppRuntime(): Promise<void> {
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

export function initServiceWorkerUpdates(showToast: ShowToast): void {
  if (!('serviceWorker' in navigator)) return;

  // In dev/HMR we must avoid cache-first SW interference serving stale modules.
  if (!import.meta.env.PROD) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(reg => reg.unregister().catch(() => {}))))
      .catch(() => {});
    if ('caches' in window) {
      caches.keys()
        .then(keys => Promise.all(keys.map(key => caches.delete(key).catch(() => {}))))
        .catch(() => {});
    }
    return;
  }

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  let hasReloadedForUpdate = sessionStorage.getItem(SW_RELOAD_FLAG) === '1';
  let updateToastShown = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloadedForUpdate) return;
    hasReloadedForUpdate = true;
    sessionStorage.setItem(SW_RELOAD_FLAG, '1');
    window.location.reload();
  });

  function showUpdateToast(worker: ServiceWorker): void {
    if (updateToastShown || !showToast) return;
    updateToastShown = true;
    showToast(t('pwa_update_available'), 'update', {
      actionLabel: t('reload'),
      onAction: () => worker.postMessage({ type: 'SKIP_WAITING' }),
    });
  }

  navigator.serviceWorker.register(swUrl).then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateToast(reg.waiting);
    }

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateToast(reg.waiting ?? installing);
        }
      });
    });

    reg.update().catch(() => {});
  }).catch(error => {
    console.warn('Service Worker registration failed:', error);
  });
}
