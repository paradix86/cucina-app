function normalizeVersionLabel(value: string | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'v0.0.0';
  return raw.startsWith('v') ? raw : `v${raw}`;
}

export interface AppMeta {
  version: string;
  commit: string;
  buildDate: string;
  buildId: string;
  cacheName: string;
  authorLine: string;
}

export const APP_META: AppMeta = {
  version: normalizeVersionLabel(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined),
  commit: typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : 'dev',
  buildDate: typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : new Date().toISOString().slice(0, 10),
  buildId: typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '0.0.0+dev',
  cacheName: typeof __SW_CACHE_NAME__ !== 'undefined' ? __SW_CACHE_NAME__ : 'dev',
  authorLine: 'Made with ❤️ by Alan in Switzerland',
};

export function formatEuropeanDate(isoDate: string | null | undefined): string {
  const match = String(isoDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate ?? '');
  return `${match[3]}-${match[2]}-${match[1]}`;
}
