<script setup>
import { computed, ref } from 'vue';
import { useTimers } from '../composables/useTimers';
import { useTimerAlerts } from '../composables/useTimerAlerts';
import { useCookingPreferences } from '../composables/useCookingPreferences';
import { t } from '../lib/i18n';

const name = ref('');
const minutes = ref(5);
const seconds = ref(0);

const { timers, addTimer, toggleTimer, resetTimer, deleteTimer } = useTimers();
const {
  timerSound,
  timerVolume,
  timerDuration,
  setTimerSound,
  setTimerVolume,
  setTimerDuration,
  previewTimerSound,
  timerSoundOptions,
  timerDurationOptions,
} = useTimerAlerts();
const { keepScreenAwake, setKeepScreenAwake } = useCookingPreferences();
const soundOptions = computed(() => {
  return timerSoundOptions
    .map(value => ({
      value,
      label: t(`timer_sound_${value}`),
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // Aggiunge l'ordinamento alfabetico
});
const durationOptions = computed(() => timerDurationOptions.map(value => ({
  value,
  label: t(`timer_duration_${value}`),
})));

function submitTimer() {
  const ok = addTimer(name.value, minutes.value, seconds.value);
  if (ok) {
    name.value = '';
    minutes.value = 5;
    seconds.value = 0;
  }
}
</script>

<template>
  <section class="panel active">
    <div class="card timer-settings-card">
      <div class="timer-settings-head">
        <div>
          <h2>{{ t('timer_sound_title') }}</h2>
          <p class="muted-label">{{ t('timer_sound_desc') }}</p>
        </div>
        <button class="btn-ghost" @click="previewTimerSound">{{ t('timer_sound_preview') }}</button>
      </div>
      <div class="timer-sound-controls">
        <div class="timer-settings-grid">
          <div class="timer-setting-field">
            <label for="timer-sound-select">{{ t('timer_sound_label') }}</label>
            <select id="timer-sound-select" :value="timerSound" @change="setTimerSound($event.target.value)">
              <option v-for="option in soundOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="timer-setting-field">
            <label for="timer-volume-range">{{ t('timer_volume_label') }} <span class="timer-setting-value">{{ timerVolume }}%</span></label>
            <input
              id="timer-volume-range"
              type="range"
              min="0"
              max="100"
              step="5"
              :value="timerVolume"
              @input="setTimerVolume($event.target.value)"
            />
          </div>
          <div class="timer-setting-field">
            <label for="timer-duration-select">{{ t('timer_duration_label') }}</label>
            <select id="timer-duration-select" :value="timerDuration" @change="setTimerDuration($event.target.value)">
              <option v-for="option in durationOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
        </div>
        <label class="timer-toggle-card" for="cooking-keep-awake-toggle">
          <input
            id="cooking-keep-awake-toggle"
            type="checkbox"
            :checked="keepScreenAwake"
            @change="setKeepScreenAwake($event.target.checked)"
          />
          <div class="timer-toggle-copy">
            <span class="timer-toggle-title">{{ t('cooking_keep_awake_label') }}</span>
            <span class="timer-toggle-desc">{{ t('cooking_keep_awake_desc') }}</span>
          </div>
        </label>
      </div>
    </div>
    <div class="lbl-row">
      <span>{{ t('timer_label_name') }}</span>
      <span>{{ t('timer_label_min') }}</span>
      <span>{{ t('timer_label_sec') }}</span>
      <span></span>
    </div>
    <div class="add-row">
      <input v-model="name" type="text" :placeholder="t('timer_name_placeholder')" :aria-label="t('timer_label_name')" />
      <div class="timer-num-group">
        <span class="timer-num-label" aria-hidden="true">{{ t('timer_label_min') }}</span>
        <input v-model="minutes" type="number" inputmode="numeric" pattern="[0-9]*" min="0" max="999" :aria-label="t('timer_label_min')" />
      </div>
      <div class="timer-num-group">
        <span class="timer-num-label" aria-hidden="true">{{ t('timer_label_sec') }}</span>
        <input v-model="seconds" type="number" inputmode="numeric" pattern="[0-9]*" min="0" max="59" :aria-label="t('timer_label_sec')" />
      </div>
      <button class="btn-primary" @click="submitTimer">{{ t('timer_add') }}</button>
    </div>
    <div style="margin-top:1rem">
      <div v-if="timers.length" class="timer-grid" id="timer-grid">
        <div v-for="timer in timers" :key="timer.id" class="timer-card">
          <div class="t-name">{{ timer.name }}</div>
          <div class="t-display" :class="timer.cls">{{ timer.display }}</div>
          <div class="t-btns">
            <button @click="toggleTimer(timer.id)">{{ timer.buttonLabel }}</button>
            <button @click="resetTimer(timer.id)">{{ t('timer_reset') }}</button>
            <button class="t-del" @click="deleteTimer(timer.id)">✕</button>
          </div>
        </div>
      </div>
      <p v-else class="empty" id="timer-empty">{{ t('timer_empty') }}</p>
    </div>
  </section>
</template>
