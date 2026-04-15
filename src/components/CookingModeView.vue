<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { useWakeLock } from '@vueuse/core';
import { extractStepSeconds, formatClock } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';
import { useToasts } from '../composables/useToasts.js';

const props = defineProps({
  recipe: { type: Object, required: true },
});

const emit = defineEmits(['exit']);

const stepIndex = ref(0);
const timerTotal = ref(0);
const timerRemaining = ref(0);
const timerRunning = ref(false);
let timerInterval = null;
const { showToast } = useToasts();
const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();

const currentStep = computed(() => props.recipe.steps?.[stepIndex.value] || '');
const isComplete = ref(false);

function clearTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerTotal.value = 0;
  timerRemaining.value = 0;
  timerRunning.value = false;
}

function setupStepTimer() {
  clearTimer();
  const seconds = extractStepSeconds(currentStep.value);
  if (seconds <= 0) return;
  timerTotal.value = seconds;
  timerRemaining.value = seconds;
}

function ensureTimer() {
  if (timerInterval) return;
  timerInterval = window.setInterval(() => {
    if (!timerRunning.value || timerRemaining.value <= 0) return;
    timerRemaining.value -= 1;
    if (timerRemaining.value <= 0) {
      timerRemaining.value = 0;
      timerRunning.value = false;
      window.clearInterval(timerInterval);
      timerInterval = null;
      showToast(t('toast_cooking_timer_done'), 'success');
    }
  }, 1000);
}

function toggleTimer() {
  if (timerTotal.value <= 0) return;
  timerRunning.value = !timerRunning.value;
  if (timerRunning.value) ensureTimer();
}

function resetTimer() {
  timerRunning.value = false;
  timerRemaining.value = timerTotal.value;
}

function prevStep() {
  if (stepIndex.value === 0) return;
  isComplete.value = false;
  stepIndex.value -= 1;
  setupStepTimer();
}

function nextStep() {
  if (stepIndex.value >= (props.recipe.steps?.length || 0) - 1) {
    isComplete.value = true;
    clearTimer();
    return;
  }
  stepIndex.value += 1;
  isComplete.value = false;
  setupStepTimer();
}

function exitMode() {
  clearTimer();
  releaseWakeLock().catch(() => {});
  emit('exit');
}

setupStepTimer();
requestWakeLock('screen').catch(() => {});
onBeforeUnmount(() => {
  clearTimer();
  releaseWakeLock().catch(() => {});
});
</script>

<template>
  <div class="cooking-mode">
    <div class="cooking-header">
      <button class="cooking-exit" @click="exitMode">{{ t('cooking_exit') }}</button>
      <span class="cooking-recipe-name">{{ recipe.name }}</span>
      <span class="cooking-progress">{{ t('cooking_step_of', { current: stepIndex + 1, total: recipe.steps?.length || 0 }) }}</span>
    </div>

    <details class="cooking-ingredients">
      <summary>{{ t('detail_ingredients') }}</summary>
      <ul class="ing-list">
        <li v-for="ingredient in recipe.ingredients" :key="ingredient">{{ ingredient }}</li>
      </ul>
    </details>

    <div class="cooking-step-wrap">
      <template v-if="!isComplete">
        <div class="cooking-step-number">{{ stepIndex + 1 }}</div>
        <div class="cooking-step-text">{{ currentStep }}</div>
      </template>
      <div v-else class="cooking-complete">
        <div class="cooking-complete-icon">✓</div>
        <div class="cooking-complete-title">{{ t('cooking_done') }}</div>
        <div class="cooking-complete-sub">{{ t('cooking_done_sub') }}</div>
      </div>
    </div>

    <div v-if="timerTotal > 0 && !isComplete" class="cooking-step-timer">
      <div class="sec-label">{{ t('cooking_step_timer') }}</div>
      <div class="cooking-timer-display" id="cooking-timer-display">{{ formatClock(timerRemaining) }}</div>
      <div class="cooking-timer-btns">
        <button id="cooking-timer-toggle" @click="toggleTimer">{{ timerRunning ? t('timer_pause') : t('timer_start') }}</button>
        <button @click="resetTimer">{{ t('timer_reset') }}</button>
      </div>
    </div>

    <div class="cooking-nav">
      <button class="cooking-btn-prev" :disabled="stepIndex === 0" @click="prevStep">{{ t('cooking_prev') }}</button>
      <button class="cooking-btn-next" :disabled="isComplete" @click="nextStep">{{ stepIndex === (recipe.steps?.length || 1) - 1 ? t('cooking_done') : t('cooking_next') }}</button>
    </div>
  </div>
</template>
