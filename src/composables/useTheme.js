import { watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';

const THEME_STORAGE_KEY = 'cucina_theme';
const VALID_THEMES = ['system', 'light', 'dark'];
const THEME_COLORS = {
  light: '#ffffff',
  dark: '#1a1a18',
};
const theme = useLocalStorage(THEME_STORAGE_KEY, 'system');
const systemDarkQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function normalizeThemePreference(value) {
  return VALID_THEMES.includes(value) ? value : 'system';
}

function getResolvedTheme(value) {
  if (value === 'light' || value === 'dark') return value;
  return systemDarkQuery?.matches ? 'dark' : 'light';
}

function ensureThemeColorMeta() {
  if (typeof document === 'undefined') return null;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  return meta;
}

function applyThemePreference(value) {
  if (typeof document === 'undefined') return;
  const next = normalizeThemePreference(value);
  const resolved = getResolvedTheme(next);

  if (next === 'light' || next === 'dark') {
    document.documentElement.dataset.theme = next;
  } else {
    delete document.documentElement.dataset.theme;
  }

  document.documentElement.style.colorScheme = resolved;
  ensureThemeColorMeta()?.setAttribute('content', THEME_COLORS[resolved]);
}

watch(theme, value => {
  const next = normalizeThemePreference(value);
  if (next !== theme.value) theme.value = next;
  applyThemePreference(next);
}, { immediate: true, flush: 'sync' });

systemDarkQuery?.addEventListener?.('change', () => {
  if (theme.value === 'system') applyThemePreference('system');
});

export function useTheme() {
  function setThemePreference(value) {
    const next = normalizeThemePreference(value);
    theme.value = next;
    applyThemePreference(next);
  }

  return {
    theme,
    setThemePreference,
  };
}
