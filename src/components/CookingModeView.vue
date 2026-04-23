<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWakeLock } from '@vueuse/core';
import { extractStepSeconds, formatClock, getPreparationInfo } from '../lib/recipes.js';
import { detectBimbyAction } from '../lib/bimbyIcons.js';
import { t } from '../lib/i18n.js';
import { useToasts } from '../composables/useToasts.js';
import { useTimerAlerts } from '../composables/useTimerAlerts.js';
import { useCookingPreferences } from '../composables/useCookingPreferences.js';
import BimbyActionIcon from './BimbyActionIcon.vue';

const props = defineProps({
  recipe: { type: Object, required: true },
});

const emit = defineEmits(['exit']);

const stepIndex = ref(0);
const timerTotal = ref(0);
const timerRemaining = ref(0);
const timerRunning = ref(false);
let timerInterval = null;
const isEditingTimer = ref(false);
const editMin = ref(0);
const editSec = ref(0);
const { showToast } = useToasts();
const { triggerTimerAlert } = useTimerAlerts();
const { keepScreenAwake } = useCookingPreferences();
const { request: requestWakeLock, release: releaseWakeLock, isSupported: wakeLockSupported } = useWakeLock();

const prepInfo = computed(() => getPreparationInfo(props.recipe));
const currentStep = computed(() => props.recipe.steps?.[stepIndex.value] || '');
const isComplete = ref(false);
const ingredientCount = computed(() => props.recipe.ingredients?.length || 0);

const progressPct = computed(() => {
  const total = props.recipe.steps?.length || 1;
  return Math.round(((stepIndex.value + 1) / total) * 100);
});

const timerStateKey = computed(() => {
  if (timerTotal.value <= 0) return 'cooking_timer_none';
  if (timerRunning.value) return 'cooking_timer_running';
  if (timerRemaining.value <= 0) return 'cooking_timer_finished';
  if (timerRemaining.value < timerTotal.value) return 'cooking_timer_paused';
  return 'cooking_timer_ready';
});

const timerHelpKey = computed(() => {
  if (isEditingTimer.value) return '';
  if (timerTotal.value <= 0) return 'cooking_timer_add_hint';
  if (timerRunning.value) return '';
  return 'cooking_timer_edit_hint';
});

const currentStepStructured = computed(() => {
  const step = currentStep.value;
  if (prepInfo.value.type === 'bimby') {
    const sep = step.indexOf(' — ');
    if (sep !== -1) {
      const tags = step.slice(0, sep).split('·').map(tg => tg.trim()).filter(Boolean);
      const text = step.slice(sep + 3);
      return { type: 'bimby', tags, text };
    }
  }
  return { type: 'plain', text: step };
});

const currentStepAction = computed(() => {
  if (prepInfo.value.type === 'bimby') {
    return detectBimbyAction(currentStep.value);
  }
  return null;
});

function clearTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerTotal.value = 0;
  timerRemaining.value = 0;
  timerRunning.value = false;
}

function setupStepTimer() {
  clearTimer();
  isEditingTimer.value = false;
  const seconds = extractStepSeconds(currentStep.value);
  if (seconds <= 0) return;
  timerTotal.value = seconds;
  timerRemaining.value = seconds;
}

function startEditTimer() {
  editMin.value = Math.floor((timerTotal.value || 0) / 60);
  editSec.value = (timerTotal.value || 0) % 60;
  isEditingTimer.value = true;
}

function applyEditTimer() {
  const total = (Number(editMin.value) || 0) * 60 + (Number(editSec.value) || 0);
  timerRunning.value = false;
  timerTotal.value = Math.max(0, total);
  timerRemaining.value = timerTotal.value;
  isEditingTimer.value = false;
}

function cancelEditTimer() {
  isEditingTimer.value = false;
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
      const message = t('toast_cooking_timer_done');
      showToast(message, 'success');
      triggerTimerAlert(message);
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
  releaseCookingWakeLock();
  emit('exit');
}

async function acquireCookingWakeLock() {
  if (!keepScreenAwake.value) return;
  if (wakeLockSupported && wakeLockSupported.value === false) return;
  try {
    await requestWakeLock('screen');
  } catch (error) {
    console.warn('[cooking-mode] screen wake lock unavailable', error);
  }
}

async function releaseCookingWakeLock() {
  try {
    await releaseWakeLock();
  } catch (_) {
    // Best effort only.
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    acquireCookingWakeLock();
    return;
  }
  releaseCookingWakeLock();
}

setupStepTimer();
onMounted(() => {
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.addEventListener('visibilitychange', handleVisibilityChange);
  acquireCookingWakeLock();
});
watch(keepScreenAwake, enabled => {
  if (enabled) {
    acquireCookingWakeLock();
    return;
  }
  releaseCookingWakeLock();
}, { immediate: true });
onBeforeUnmount(() => {
  clearTimer();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  releaseCookingWakeLock();
});
</script>

<template>
  <div class="cooking-mode">
    <div class="cooking-header">
      <button class="cooking-exit" @click="exitMode">{{ t('cooking_exit') }}</button>
      <span class="cooking-recipe-name">{{ recipe.name }}</span>
      <span class="cooking-progress">{{ t('cooking_step_of', { current: stepIndex + 1, total: recipe.steps?.length || 0 }) }}</span>
    </div>

    <div class="cooking-progress-bar" role="progressbar" :aria-valuenow="stepIndex + 1" :aria-valuemax="recipe.steps?.length || 0">
      <div class="cooking-progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <details class="cooking-ingredients">
      <summary>
        <span>{{ t('detail_ingredients') }}</span>
        <span class="cooking-ingredients-count">{{ ingredientCount }}</span>
      </summary>
      <ul class="ing-list">
        <li v-for="ingredient in recipe.ingredients" :key="ingredient">{{ ingredient }}</li>
      </ul>
    </details>

    <div class="cooking-step-wrap">
      <template v-if="!isComplete">
        <div class="cooking-step-number">{{ stepIndex + 1 }}</div>
        <div class="cooking-step-content">
          <template v-if="currentStepStructured.type === 'bimby'">
            <div class="cooking-bimby-tags">
              <BimbyActionIcon :action="currentStepAction" />
              <span v-for="tag in currentStepStructured.tags" :key="tag" class="bimby-tag cooking-bimby-tag">{{ tag }}</span>
            </div>
            <div class="cooking-step-text">{{ currentStepStructured.text }}</div>
          </template>
          <div v-else class="cooking-step-text">{{ currentStepStructured.text }}</div>
        </div>
      </template>
      <div v-else class="cooking-complete">
        <div class="cooking-complete-icon">✓</div>
        <div class="cooking-complete-title">{{ t('cooking_done') }}</div>
        <div class="cooking-complete-sub">{{ t('cooking_done_sub') }}</div>
        <button class="cooking-complete-action" @click="exitMode">{{ t('cooking_exit') }}</button>
      </div>
    </div>

    <div v-if="!isComplete" class="cooking-step-timer" :class="{ 'has-timer': timerTotal > 0 }">
      <div class="cooking-timer-top">
        <div class="cooking-timer-heading">
          <div class="cooking-timer-header">
            <span class="cooking-timer-label">{{ t('cooking_step_timer') }}</span>
            <span class="cooking-timer-status" :class="`is-${timerStateKey.replace('cooking_timer_', '')}`">{{ t(timerStateKey) }}</span>
          </div>
          <div v-if="timerHelpKey" class="cooking-timer-help">{{ t(timerHelpKey) }}</div>
        </div>
        <button v-if="!timerRunning && !isEditingTimer" class="cooking-timer-edit-btn" @click="startEditTimer">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          {{ t('cooking_timer_edit') }}
        </button>
      </div>
      <template v-if="isEditingTimer">
        <div class="cooking-timer-edit">
          <div class="cooking-timer-edit-fields">
            <label class="cooking-timer-edit-field">
              <input class="cooking-timer-input" type="number" inputmode="numeric" pattern="[0-9]*" min="0" max="99" v-model.number="editMin" @keyup.enter="applyEditTimer" />
              <span class="cooking-timer-unit">{{ t('timer_label_min') }}</span>
            </label>
            <span class="cooking-timer-sep">:</span>
            <label class="cooking-timer-edit-field">
              <input class="cooking-timer-input" type="number" inputmode="numeric" pattern="[0-9]*" min="0" max="59" v-model.number="editSec" @keyup.enter="applyEditTimer" />
              <span class="cooking-timer-unit">{{ t('timer_label_sec') }}</span>
            </label>
          </div>
          <div class="cooking-timer-btns">
            <button class="cooking-timer-confirm-btn" @click="applyEditTimer">{{ t('cooking_timer_confirm') }}</button>
            <button @click="cancelEditTimer">{{ t('cooking_timer_cancel') }}</button>
          </div>
        </div>
      </template>
      <template v-else-if="timerTotal > 0">
        <div class="cooking-timer-face">
          <div class="cooking-timer-display" id="cooking-timer-display">{{ formatClock(timerRemaining) }}</div>
        </div>
        <div class="cooking-timer-btns">
          <button id="cooking-timer-toggle" class="cooking-timer-toggle-btn" @click="toggleTimer">{{ timerRunning ? t('timer_pause') : t('timer_start') }}</button>
          <button class="cooking-timer-reset-btn" @click="resetTimer">{{ t('timer_reset') }}</button>
        </div>
      </template>
    </div>

    <div class="cooking-nav">
      <button class="cooking-btn-prev" :disabled="stepIndex === 0" @click="prevStep">{{ t('cooking_prev') }}</button>
      <button class="cooking-btn-next" :disabled="isComplete" @click="nextStep">{{ stepIndex === (recipe.steps?.length || 1) - 1 ? t('cooking_done') : t('cooking_next') }}</button>
    </div>
  </div>
</template>
