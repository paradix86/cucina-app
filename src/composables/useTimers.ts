import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { t } from '../lib/i18n';
import { formatClock } from '../lib/recipes';
import { useToasts } from './useToasts';
import { useTimerAlerts } from './useTimerAlerts';

interface Timer {
  name: string;
  total: number;
  remaining: number;
  running: boolean;
}

const timers = ref<Record<string, Timer>>({});
let timerInterval: ReturnType<typeof window.setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;
let activeConsumers = 0;
let hiddenAt = 0;
let showToastRef: ((message: string, type?: string) => void) | null = null;
let triggerTimerAlertRef: ((message: string, title?: string) => void) | null = null;

function hasRunningTimers(): boolean {
  return Object.values(timers.value).some(timer => timer.running && timer.remaining > 0);
}

function clearTimerInterval(): void {
  if (!timerInterval || typeof window === 'undefined') return;
  window.clearInterval(timerInterval);
  timerInterval = null;
}

function applyTimerTick(elapsedSeconds = 1): void {
  if (!elapsedSeconds || elapsedSeconds <= 0) return;
  let changed = false;
  Object.keys(timers.value).forEach(id => {
    const timer = timers.value[id];
    if (!timer?.running || timer.remaining <= 0) return;

    const nextRemaining = Math.max(0, timer.remaining - elapsedSeconds);
    if (nextRemaining !== timer.remaining) {
      timer.remaining = nextRemaining;
      changed = true;
    }
    if (timer.remaining === 0 && timer.running) {
      timer.running = false;
      changed = true;
      const message = t('toast_timer_done', { name: timer.name });
      showToastRef?.(message, 'success');
      triggerTimerAlertRef?.(message);
    }
  });

  if (changed) timers.value = { ...timers.value };
  if (!hasRunningTimers()) clearTimerInterval();
}

function syncTimerInterval(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!hasRunningTimers() || document.hidden) {
    clearTimerInterval();
    return;
  }
  if (timerInterval) return;
  timerInterval = window.setInterval(() => {
    applyTimerTick(1);
  }, 1000);
}

function attachVisibilityHandler(): void {
  if (visibilityHandler || typeof document === 'undefined') return;
  visibilityHandler = () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      clearTimerInterval();
      return;
    }

    const hiddenElapsed = hiddenAt ? Math.floor((Date.now() - hiddenAt) / 1000) : 0;
    hiddenAt = 0;
    if (hiddenElapsed > 0) applyTimerTick(hiddenElapsed);
    syncTimerInterval();
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}

function detachVisibilityHandler(): void {
  if (!visibilityHandler || typeof document === 'undefined') return;
  document.removeEventListener('visibilitychange', visibilityHandler);
  visibilityHandler = null;
}

export function cleanupTimersRuntime(options: { resetState?: boolean } = {}): void {
  const { resetState = false } = options;
  clearTimerInterval();
  detachVisibilityHandler();
  hiddenAt = 0;
  activeConsumers = 0;
  showToastRef = null;
  triggerTimerAlertRef = null;
  if (resetState) timers.value = {};
}

function registerTimersConsumer(
  showToast: (message: string, type?: string) => void,
  triggerTimerAlert: (message: string, title?: string) => void,
): void {
  showToastRef = showToast;
  triggerTimerAlertRef = triggerTimerAlert;
  activeConsumers += 1;
  attachVisibilityHandler();
  syncTimerInterval();
}

function releaseTimersConsumer(): void {
  activeConsumers = Math.max(0, activeConsumers - 1);
  if (activeConsumers === 0) {
    cleanupTimersRuntime();
  }
}

export function useTimers() {
  const { showToast } = useToasts();
  const { triggerTimerAlert } = useTimerAlerts();

  registerTimersConsumer(showToast, triggerTimerAlert);

  if (getCurrentScope()) {
    onScopeDispose(() => {
      releaseTimersConsumer();
    });
  }

  function addTimer(name: string, min: string | number, sec: string | number): boolean {
    const timerName = (name || '').trim() || 'Pietanza';
    const total = (parseInt(String(min), 10) || 0) * 60 + (parseInt(String(sec), 10) || 0);
    if (total <= 0) {
      showToast(t('timer_invalid'), 'error');
      return false;
    }
    const id = `t${Date.now()}`;
    timers.value = {
      ...timers.value,
      [id]: { name: timerName, total, remaining: total, running: true },
    };
    syncTimerInterval();
    return true;
  }

  function startRecipeTimer(name: string, seconds: number): boolean {
    const existing = Object.values(timers.value).find(timer => timer.name === name && timer.remaining > 0);
    if (existing) return false;
    timers.value = {
      ...timers.value,
      [`t${Date.now()}`]: { name, total: seconds, remaining: seconds, running: true },
    };
    syncTimerInterval();
    return true;
  }

  function toggleTimer(id: string): void {
    if (!timers.value[id]) return;
    timers.value[id].running = !timers.value[id].running;
    timers.value = { ...timers.value };
    syncTimerInterval();
  }

  function resetTimer(id: string): void {
    if (!timers.value[id]) return;
    timers.value[id].remaining = timers.value[id].total;
    timers.value[id].running = false;
    timers.value = { ...timers.value };
    syncTimerInterval();
  }

  function deleteTimer(id: string): void {
    if (!timers.value[id]) return;
    const next = { ...timers.value };
    delete next[id];
    timers.value = next;
    syncTimerInterval();
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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupTimersRuntime();
  });
}
