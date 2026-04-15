<script setup>
import { computed } from 'vue';
import { APP_META, formatEuropeanDate } from '../lib/appMeta.js';
import { t } from '../lib/i18n.js';
import { refreshAppRuntime } from '../composables/useServiceWorker.js';

const year = computed(() => new Date().getFullYear());
</script>

<template>
  <footer class="app-footer" id="app-footer">
    <span class="footer-meta">{{ APP_META.authorLine }} · {{ year }} · {{ APP_META.version }} · build {{ formatEuropeanDate(APP_META.buildDate) }}</span>
    <button class="footer-refresh" @click="refreshAppRuntime">{{ t('app_refresh') }}</button>
  </footer>
</template>
