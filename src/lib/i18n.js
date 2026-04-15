import { ref } from 'vue';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from './i18nData.js';

const LANG_STORAGE_KEY = 'cucina_lang';
const browserLang = (typeof navigator !== 'undefined' ? navigator.language : 'it').slice(0, 2);
const initialLang = typeof localStorage !== 'undefined' && SUPPORTED_LANGUAGES.includes(localStorage.getItem(LANG_STORAGE_KEY))
  ? localStorage.getItem(LANG_STORAGE_KEY)
  : (SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : 'it');

export const currentLang = ref(initialLang);

export function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  currentLang.value = lang;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  document.documentElement.setAttribute('lang', lang);
}

export function initLanguage() {
  document.documentElement.setAttribute('lang', currentLang.value);
}

export function t(key, vars) {
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
