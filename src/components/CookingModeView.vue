<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWakeLock } from '@vueuse/core';
import { extractStepSeconds, formatClock, getPreparationInfo } from '../lib/recipes';
import { detectBimbyAction } from '../lib/bimbyIcons';
import { t } from '../lib/i18n';
import { parseCookingProgress } from '../lib/cookingPersistence';
import { getCookingProgressKey } from '../lib/storageKeys';
import { useToasts } from '../composables/useToasts';
import { useTimerAlerts } from '../composables/useTimerAlerts';
import { useCookingPreferences } from '../composables/useCookingPreferences';
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

function saveCookingProgress() {
  if (!props.recipe.id) return;
  try {
    localStorage.setItem(getCookingProgressKey(props.recipe), JSON.stringify({
      stepIndex: stepIndex.value,
      checklist: ingredientChecklist.value,
      updatedAt: Date.now(),
    }));
  } catch (_) {}
}

function loadCookingProgress() {
  if (!props.recipe.id) return;
  try {
    const raw = localStorage.getItem(getCookingProgressKey(props.recipe));
    const data = parseCookingProgress(raw, props.recipe.steps?.length || 0);
    if (!data) {
      clearCookingProgress();
      return;
    }
    if (data.stepIndex !== undefined) stepIndex.value = data.stepIndex;
    if (data.checklist !== undefined) ingredientChecklist.value = data.checklist;
  } catch (_) {}
}

function clearCookingProgress() {
  try { localStorage.removeItem(getCookingProgressKey(props.recipe)); } catch (_) {}
}

function snoozeStepTimer() {
  timerRemaining.value += 120;
  timerTotal.value = Math.max(timerTotal.value, timerRemaining.value);
  timerRunning.value = true;
  ensureTimer();
}
const { keepScreenAwake } = useCookingPreferences();
const { request: requestWakeLock, release: releaseWakeLock, isSupported: wakeLockSupported } = useWakeLock();

const prepInfo = computed(() => getPreparationInfo(props.recipe));
const currentStep = computed(() => props.recipe.steps?.[stepIndex.value] || '');
const isComplete = ref(false);
const ingredientChecklist = ref({});
const ingredientItems = computed(() => (
  Array.isArray(props.recipe.ingredients)
    ? props.recipe.ingredients.map(ingredient => String(ingredient || '').trim()).filter(Boolean)
    : []
));
const ingredientCount = computed(() => ingredientItems.value.length);
const checkedIngredientCount = computed(() => (
  ingredientItems.value.reduce((count, _, index) => count + (ingredientChecklist.value[index] ? 1 : 0), 0)
));
const ingredientResetKey = computed(() => [
  props.recipe.id || props.recipe.name || '',
  ...ingredientItems.value,
].join('\u0001'));

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
      triggerTimerAlert(message, undefined, snoozeStepTimer);
    }
  }, 1000);
}

function toggleTimer() {
  if (timerTotal.value <= 0) return;
  timerRunning.value = !timerRunning.value;
  if (timerRunning.value) ensureTimer();
}

function resetTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerRunning.value = false;
  timerRemaining.value = timerTotal.value;
}

function prevStep() {
  if (stepIndex.value === 0) return;
  isComplete.value = false;
  stepIndex.value -= 1;
  setupStepTimer();
  saveCookingProgress();
}

function nextStep() {
  if (stepIndex.value >= (props.recipe.steps?.length || 0) - 1) {
    isComplete.value = true;
    clearTimer();
    clearCookingProgress();
    return;
  }
  stepIndex.value += 1;
  isComplete.value = false;
  setupStepTimer();
  saveCookingProgress();
}

function exitMode() {
  clearTimer();
  clearCookingProgress();
  resetIngredientChecklist();
  releaseCookingWakeLock();
  emit('exit');
}

function resetIngredientChecklist() {
  ingredientChecklist.value = {};
}

async function acquireCookingWakeLock() {
  if (!keepScreenAwake.value) return;
  if (wakeLockSupported && wakeLockSupported.value === false) return;
  try {
    await requestWakeLock('screen');
  } catch (_) {
    // wake lock unavailable — best effort only
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
watch(ingredientResetKey, () => {
  resetIngredientChecklist();
}, { immediate: true });
loadCookingProgress();
setupStepTimer();
onBeforeUnmount(() => {
  clearTimer();
  resetIngredientChecklist();
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

    <div class="cooking-progress-bar" role="progressbar" aria-valuemin="1" :aria-valuenow="stepIndex + 1" :aria-valuemax="recipe.steps?.length || 0">
      <div class="cooking-progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <details class="cooking-ingredients">
      <summary>
        <span>{{ t('detail_ingredients') }}</span>
        <span class="cooking-ingredients-count">{{ checkedIngredientCount }}/{{ ingredientCount }}</span>
      </summary>
      <div class="cooking-ingredients-progress">{{ t('cooking_ingredients_ready', { checked: checkedIngredientCount, total: ingredientCount }) }}</div>
      <div class="cooking-ingredient-checklist">
        <label
          v-for="(ingredient, index) in ingredientItems"
          :key="`${index}-${ingredient}`"
          class="cooking-ingredient-check"
          :class="{ 'is-checked': ingredientChecklist[index] }"
        >
          <input
            v-model="ingredientChecklist[index]"
            type="checkbox"
            :aria-label="t('cooking_ingredient_toggle_label', { ingredient })"
          />
          <span>{{ ingredient }}</span>
        </label>
      </div>
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
      <template v-else>
        <div class="cooking-timer-face" :class="{ 'is-inactive': timerTotal <= 0 }">
          <div class="cooking-timer-display" id="cooking-timer-display">{{ timerTotal > 0 ? formatClock(timerRemaining) : '—' }}</div>
        </div>
        <div v-if="timerTotal > 0" class="cooking-timer-btns">
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
