<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import MarkdownIt from 'markdown-it';
import mealPrepGuideRaw from '../content/duemme/meal_prep_guide.md?raw';
import { t } from '../lib/i18n';
import { GUIDE_CHECKS_KEY } from '../lib/storageKeys';
const guideContentRef = ref<HTMLElement | null>(null);
const checklistState = ref<Record<string, boolean>>({});

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
});

function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadChecklistState(): void {
  try {
    const raw = localStorage.getItem(GUIDE_CHECKS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      checklistState.value = parsed as Record<string, boolean>;
    }
  } catch {
    checklistState.value = {};
  }
}

function saveChecklistState(): void {
  localStorage.setItem(GUIDE_CHECKS_KEY, JSON.stringify(checklistState.value));
}

function renderGuideHtml(): string {
  let html = md.render(mealPrepGuideRaw);

  const headingCounters: Record<string, number> = {};
  html = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, level: string, headingContent: string) => {
    const baseSlug = slugify(stripHtml(headingContent)) || 'section';
    const nextCount = (headingCounters[baseSlug] || 0) + 1;
    headingCounters[baseSlug] = nextCount;
    const headingId = nextCount > 1 ? `${baseSlug}-${nextCount}` : baseSlug;
    return `<h${level} id="${headingId}">${headingContent}</h${level}>`;
  });

  const checklistCounters: Record<string, number> = {};
  html = html.replace(/<li>\s*\[( |x|X)\]\s*([\s\S]*?)<\/li>/g, (_, checkedFlag: string, content: string) => {
    const baseKey = slugify(stripHtml(content)).slice(0, 72) || 'task';
    const nextCount = (checklistCounters[baseKey] || 0) + 1;
    checklistCounters[baseKey] = nextCount;
    const checkId = nextCount > 1 ? `${baseKey}-${nextCount}` : baseKey;
    const isChecked = Object.prototype.hasOwnProperty.call(checklistState.value, checkId)
      ? checklistState.value[checkId]
      : checkedFlag.toLowerCase() === 'x';
    return `<li class="guide-check-item"><label class="guide-check-label"><input type="checkbox" class="guide-check-input" data-guide-check-id="${checkId}" ${isChecked ? 'checked' : ''} /><span>${content}</span></label></li>`;
  });

  return html;
}

const renderedGuide = computed(() => renderGuideHtml());

function scrollToGuideAnchor(anchorId: string): void {
  const container = guideContentRef.value;
  if (!container || !anchorId) return;
  const target = container.querySelector<HTMLElement>(`#${anchorId}`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onGuideClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
  if (!link) return;
  event.preventDefault();
  const anchorId = (link.getAttribute('href') || '').replace(/^#/, '').trim();
  scrollToGuideAnchor(anchorId);
}

function onGuideChange(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target || target.type !== 'checkbox') return;
  const checkId = target.dataset.guideCheckId;
  if (!checkId) return;
  checklistState.value = {
    ...checklistState.value,
    [checkId]: !!target.checked,
  };
  saveChecklistState();
}

onMounted(() => {
  loadChecklistState();
});
</script>

<template>
  <section class="panel active">
    <article class="card guide-article">
      <div class="guide-entry-intro">
        <h2>{{ t('guide_entry_title') }}</h2>
        <p class="muted-label guide-entry-desc">{{ t('guide_entry_desc') }}</p>
        <div class="guide-entry-tags">
          <span class="guide-entry-tag">{{ t('guide_entry_tag_prep') }}</span>
          <span class="guide-entry-tag">{{ t('guide_entry_tag_reference') }}</span>
          <span class="guide-entry-tag">{{ t('guide_entry_tag_guidance') }}</span>
        </div>
      </div>
      <h3>{{ t('guide_meal_prep_title') }}</h3>
      <p class="muted-label guide-source">{{ t('guide_meal_prep_source') }}</p>
      <div
        ref="guideContentRef"
        class="guide-content markdown-body"
        v-html="renderedGuide"
        @click="onGuideClick"
        @change="onGuideChange"
      ></div>
    </article>
  </section>
</template>
