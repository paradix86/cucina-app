<script setup>
import { ref } from 'vue';
import { useTimers } from '../composables/useTimers.js';
import { t } from '../lib/i18n.js';

const name = ref('');
const minutes = ref(5);
const seconds = ref(0);

const { timers, addTimer, toggleTimer, resetTimer, deleteTimer } = useTimers();

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
    <div class="lbl-row">
      <span>{{ t('timer_label_name') }}</span>
      <span>{{ t('timer_label_min') }}</span>
      <span>{{ t('timer_label_sec') }}</span>
      <span></span>
    </div>
    <div class="add-row">
      <input v-model="name" type="text" :placeholder="t('timer_name_placeholder')" :aria-label="t('timer_label_name')" />
      <input v-model="minutes" type="number" min="0" max="999" :aria-label="t('timer_label_min')" />
      <input v-model="seconds" type="number" min="0" max="59" :aria-label="t('timer_label_sec')" />
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
