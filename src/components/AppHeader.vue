<script setup>
import { currentLang, setLanguage, SUPPORTED_LANGUAGES, t } from '../lib/i18n';
import { useTheme } from '../composables/useTheme';

defineProps({
  onHome: {
    type: Function,
    required: true,
  },
});

const { theme, setThemePreference } = useTheme();

const iconSrc = `${import.meta.env.BASE_URL}icons/icon-192.png`;

const languageOptions = [
  { value: 'it', label: '🇮🇹 IT' },
  { value: 'en', label: '🇬🇧 EN' },
  { value: 'de', label: '🇩🇪 DE' },
  { value: 'fr', label: '🇫🇷 FR' },
  { value: 'es', label: '🇪🇸 ES' },
].filter(option => SUPPORTED_LANGUAGES.includes(option.value));
</script>

<template>
  <header class="app-header">
    <button class="app-brand" @click="onHome" aria-label="Cucina App home">
      <img :src="iconSrc" alt="" aria-hidden="true" class="app-logo" />
      <h1>Cucina App</h1>
    </button>
    <div class="header-right">
      <div class="header-controls">
        <select id="theme-select" :value="theme" :aria-label="t('theme_label')" @change="setThemePreference($event.target.value)">
          <option value="system">{{ t('theme_system') }}</option>
          <option value="light">{{ t('theme_light') }}</option>
          <option value="dark">{{ t('theme_dark') }}</option>
        </select>
        <select id="lang-select" :value="currentLang" aria-label="Language" @change="setLanguage($event.target.value)">
          <option v-for="option in languageOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>
    </div>
  </header>
</template>
