<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import mealPrepGuideRaw from '../content/duemme/meal_prep_guide.md?raw';
import { t } from '../lib/i18n';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
});

const renderedGuide = computed(() => md.render(mealPrepGuideRaw));
</script>

<template>
  <section class="panel active">
    <article class="card guide-article">
      <h3>{{ t('guide_meal_prep_title') }}</h3>
      <p class="muted-label guide-source">{{ t('guide_meal_prep_source') }}</p>
      <div class="guide-content markdown-body" v-html="renderedGuide"></div>
    </article>
  </section>
</template>
