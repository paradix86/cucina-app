import { ref } from 'vue';

const THEME_STORAGE_KEY = 'cucina_theme';
const theme = ref(localStorage.getItem(THEME_STORAGE_KEY) || 'system');

function applyThemePreference(value) {
  if (value === 'light' || value === 'dark') {
    document.documentElement.dataset.theme = value;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

applyThemePreference(theme.value);

export function useTheme() {
  function setThemePreference(value) {
    const next = ['system', 'light', 'dark'].includes(value) ? value : 'system';
    theme.value = next;
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyThemePreference(next);
  }

  return {
    theme,
    setThemePreference,
  };
}
