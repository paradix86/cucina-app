/* global __APP_VERSION__, __APP_COMMIT__, __APP_BUILD_DATE__, __APP_BUILD_ID__ */

function normalizeVersionLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'v0.0.0';
  return raw.startsWith('v') ? raw : `v${raw}`;
}

export const APP_META = {
  version: normalizeVersionLabel(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''),
  commit: typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : 'dev',
  buildDate: typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : new Date().toISOString().slice(0, 10),
  buildId: typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '0.0.0+dev',
  authorLine: 'Made with ❤️ by Alan in Switzerland',
};

export function formatEuropeanDate(isoDate) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate || '');
  return `${match[3]}-${match[2]}-${match[1]}`;
}
