import { watchEffect } from 'vue';
import { useLocalStorage } from '@vueuse/core';

const THEME_STORAGE_KEY = 'cucina_theme';
const theme = useLocalStorage(THEME_STORAGE_KEY, 'system');

function applyThemePreference(value) {
  if (value === 'light' || value === 'dark') {
    document.documentElement.dataset.theme = value;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

watchEffect(() => {
  const next = ['system', 'light', 'dark'].includes(theme.value) ? theme.value : 'system';
  if (next !== theme.value) theme.value = next;
  applyThemePreference(next);
});

export function useTheme() {
  function setThemePreference(value) {
    const next = ['system', 'light', 'dark'].includes(value) ? value : 'system';
    theme.value = next;
  }

  return {
    theme,
    setThemePreference,
  };
}
