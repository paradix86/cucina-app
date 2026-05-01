import { ref } from 'vue';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from './i18nData';
import { LANG_KEY } from './storageKeys';

type Language = 'it' | 'en' | 'de' | 'fr' | 'es';

const browserLang = (typeof navigator !== 'undefined' ? navigator.language : 'it').slice(0, 2);
const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_KEY) : null;

function isSupportedLanguage(language: string | null): language is Language {
  return Boolean(language && SUPPORTED_LANGUAGES.includes(language));
}

const initialLang: Language = isSupportedLanguage(storedLang)
  ? storedLang
  : (isSupportedLanguage(browserLang) ? browserLang : 'it');

export const currentLang = ref(initialLang);

export function setLanguage(lang: Language): void {
  if (!isSupportedLanguage(lang)) return;
  currentLang.value = lang;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.setAttribute('lang', lang);
}

export function getLanguage(): Language {
  return currentLang.value;
}

export function initLanguage(): void {
  document.documentElement.setAttribute('lang', currentLang.value);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = TRANSLATIONS[currentLang.value] || TRANSLATIONS.it;
  let str = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.it[key] !== undefined ? TRANSLATIONS.it[key] : key);
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.split(`{${k}}`).join(String(v));
    });
  }
  return str;
}

export { SUPPORTED_LANGUAGES };
