<script setup>
import { computed, ref } from 'vue';
import { APP_META, formatEuropeanDate } from '../lib/appMeta';
import { t } from '../lib/i18n.js';
import { refreshAppRuntime } from '../composables/useServiceWorker';
import { CHANGELOG } from '../lib/changelog.ts';

const year = computed(() => new Date().getFullYear());
const creditsOpen = ref(false);
const changelogOpen = ref(false);
const latestEntry = computed(() => CHANGELOG[0] ?? null);

function buildReportProblemHref() {
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const subject = 'Cucina App - Problema';
  const body = [
    'Pagina:',
    pageUrl,
    '',
    'User agent:',
    userAgent,
  ].join('\n');

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
</script>

<template>
  <footer class="app-footer" id="app-footer">
    <span class="footer-meta">{{ APP_META.authorLine }} · {{ year }} · {{ APP_META.version }}+{{ APP_META.commit }} · build {{ formatEuropeanDate(APP_META.buildDate) }} · {{ APP_META.cacheName }}</span>
    <div class="footer-actions">
      <button class="footer-link-btn" id="footer-whats-new-btn" @click="changelogOpen = true">{{ APP_META.version }} · {{ t('whats_new') }}</button>
      <button class="footer-link-btn" id="footer-credits-btn" @click="creditsOpen = true">{{ t('credits_link') }}</button>
      <a class="footer-link-btn footer-report-link" :href="buildReportProblemHref()">{{ t('report_problem') }}</a>
      <button class="footer-refresh" @click="refreshAppRuntime">{{ t('app_refresh') }}</button>
    </div>
  </footer>

  <div v-if="changelogOpen" class="credits-overlay changelog-overlay" @click.self="changelogOpen = false">
    <div class="credits-modal card changelog-modal" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
      <div class="credits-head">
        <h3 id="changelog-title">{{ t('changelog_title') }}</h3>
        <button class="btn-ghost" id="changelog-close-btn" @click="changelogOpen = false">{{ t('changelog_close') }}</button>
      </div>
      <template v-if="latestEntry">
        <p class="muted-label changelog-version">{{ latestEntry.version }} · {{ latestEntry.date }}</p>
        <ul class="credits-list changelog-list">
          <li v-for="(change, i) in latestEntry.changes" :key="i">{{ change }}</li>
        </ul>
      </template>
      <p v-else class="muted-label">{{ t('changelog_empty') }}</p>
    </div>
  </div>

  <div v-if="creditsOpen" class="credits-overlay" @click.self="creditsOpen = false">
    <div class="credits-modal card" role="dialog" aria-modal="true" aria-labelledby="credits-title">
      <div class="credits-head">
        <h3 id="credits-title">{{ t('credits_title') }}</h3>
        <button class="btn-ghost" id="credits-close-btn" @click="creditsOpen = false">{{ t('credits_close') }}</button>
      </div>
      <p class="muted-label">{{ t('credits_intro') }}</p>
      <ul class="credits-list">
        <li>
          <a href="https://github.com/duemme/piano_alimentare" target="_blank" rel="noopener">duemme/piano_alimentare</a>
          <span class="credits-note">{{ t('credits_used_pack') }}</span>
        </li>
      </ul>
      <p class="muted-label">{{ t('credits_license_note') }}</p>
    </div>
  </div>
</template>
