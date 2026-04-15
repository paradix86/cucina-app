export const APP_META = {
  version: 'v0.10.0',
  buildDate: '2026-04-15',
  authorLine: 'Made with ❤️ by Alan in Switzerland',
};

export function formatEuropeanDate(isoDate) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate || '');
  return `${match[3]}-${match[2]}-${match[1]}`;
}
