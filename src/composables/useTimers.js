import { computed, ref } from 'vue';
import { t } from '../lib/i18n.js';
import { formatClock } from '../lib/recipes.js';
import { useToasts } from './useToasts.js';

const timers = ref({});
let timerInterval = null;

function ensureTimerInterval(showToast) {
  if (timerInterval) return;
  timerInterval = window.setInterval(() => {
    let changed = false;
    Object.keys(timers.value).forEach(id => {
      const timer = timers.value[id];
      if (timer.running && timer.remaining > 0) {
        timer.remaining -= 1;
        changed = true;
      }
      if (timer.remaining === 0 && timer.running) {
        timer.running = false;
        changed = true;
        showToast(t('toast_timer_done', { name: timer.name }), 'success');
      }
    });
    if (changed) {
      timers.value = { ...timers.value };
    }
  }, 1000);
}

export function useTimers() {
  const { showToast } = useToasts();

  function addTimer(name, min, sec) {
    const timerName = (name || '').trim() || 'Pietanza';
    const total = (parseInt(min, 10) || 0) * 60 + (parseInt(sec, 10) || 0);
    if (total <= 0) {
      showToast(t('timer_invalid'), 'error');
      return false;
    }
    const id = `t${Date.now()}`;
    timers.value = {
      ...timers.value,
      [id]: { name: timerName, total, remaining: total, running: true },
    };
    ensureTimerInterval(showToast);
    return true;
  }

  function startRecipeTimer(name, minutes) {
    const existing = Object.values(timers.value).find(timer => timer.name === name && timer.remaining > 0);
    if (existing) return false;
    const total = minutes * 60;
    timers.value = {
      ...timers.value,
      [`t${Date.now()}`]: { name, total, remaining: total, running: true },
    };
    ensureTimerInterval(showToast);
    return true;
  }

  function toggleTimer(id) {
    if (!timers.value[id]) return;
    timers.value[id].running = !timers.value[id].running;
    timers.value = { ...timers.value };
  }

  function resetTimer(id) {
    if (!timers.value[id]) return;
    timers.value[id].remaining = timers.value[id].total;
    timers.value[id].running = false;
    timers.value = { ...timers.value };
  }

  function deleteTimer(id) {
    if (!timers.value[id]) return;
    const next = { ...timers.value };
    delete next[id];
    timers.value = next;
  }

  return {
    timers: computed(() => Object.entries(timers.value).map(([id, timer]) => ({
      id,
      ...timer,
      display: timer.remaining <= 0 ? t('timer_ready') : formatClock(timer.remaining),
      buttonLabel: (timer.running && timer.remaining > 0) ? t('timer_pause') : t('timer_start'),
      cls: timer.remaining <= 0 ? 'done' : timer.running ? 'running' : '',
    }))),
    addTimer,
    startRecipeTimer,
    toggleTimer,
    resetTimer,
    deleteTimer,
  };
}
