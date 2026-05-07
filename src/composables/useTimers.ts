import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { t } from '../lib/i18n';
import { formatClock } from '../lib/recipes';
import { TIMERS_KEY } from '../lib/storageKeys';
import { useToasts } from './useToasts';
import { useTimerAlerts } from './useTimerAlerts';

// Anchor-based persistent shape. A running timer cannot be persisted as
// `{ remaining: 1234 }` — that snapshot is stale the moment we reload.
// Instead we persist `startedAt` + `elapsedAtPauseMs` and recompute remaining
// from `Date.now()` on every read. Audit T-3.
export type TimerState = 'running' | 'paused' | 'ready' | 'stopped';

interface PersistedTimer {
  id: string;
  name: string;
  durationMs: number;
  state: TimerState;
  startedAt: number | null;     // ms epoch, only set while state === 'running'
  elapsedAtPauseMs: number;     // accumulated elapsed ms before the current run
}

const timers = ref<Record<string, PersistedTimer>>({});
// Bumped on every tick so the public `timers` computed re-derives `remaining`
// without us mutating the persisted records each second.
const tickKey = ref(0);
// Browser timer ids are numeric. Avoid ReturnType<typeof window.setInterval>
// because @types/node augments globals so the inferred type can resolve to
// NodeJS.Timeout under tsconfig.test.json, even though production runs in the
// browser where window.setInterval returns number.
let timerInterval: number | null = null;
let visibilityHandler: (() => void) | null = null;
let activeConsumers = 0;
let showToastRef: ((message: string, type?: string) => void) | null = null;
let triggerTimerAlertRef: ((message: string, title?: string, onSnooze?: (() => void) | null) => void) | null = null;
let hydrated = false;

function nowMs(): number {
  return Date.now();
}

export function remainingMs(timer: PersistedTimer, atMs: number = nowMs()): number {
  if (timer.state === 'running' && timer.startedAt !== null) {
    // Math.max guards against system-clock backward jumps (DST, manual change).
    const elapsed = Math.max(0, atMs - timer.startedAt) + timer.elapsedAtPauseMs;
    return Math.max(0, timer.durationMs - elapsed);
  }
  if (timer.state === 'paused') {
    return Math.max(0, timer.durationMs - timer.elapsedAtPauseMs);
  }
  if (timer.state === 'ready') return 0;
  // 'stopped' (fresh, after reset)
  return timer.durationMs;
}

function persistTimers(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TIMERS_KEY, JSON.stringify(Object.values(timers.value)));
  } catch (e) {
    // Quota exceeded or storage disabled. Don't break the in-memory state.
    console.warn('[timers] failed to persist', e);
  }
}

function isPersistedTimerShape(value: unknown): value is PersistedTimer {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string'
    && typeof v.name === 'string'
    && typeof v.durationMs === 'number' && Number.isFinite(v.durationMs) && v.durationMs > 0
    && (v.state === 'running' || v.state === 'paused' || v.state === 'ready' || v.state === 'stopped')
    && (v.startedAt === null || (typeof v.startedAt === 'number' && Number.isFinite(v.startedAt)))
    && typeof v.elapsedAtPauseMs === 'number' && Number.isFinite(v.elapsedAtPauseMs) && v.elapsedAtPauseMs >= 0
  );
}

function loadFromStorage(): PersistedTimer[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(TIMERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPersistedTimerShape);
  } catch {
    return [];
  }
}

// Reconcile any 'running' timer whose computed remaining is 0: transition to
// 'ready'. Used by hydration (silent — design says no intrusive alert at app
// open) and by visibilitychange-show (returns expired ids so the caller can
// fire the standard expiry alert).
function reconcileExpired(silent: boolean): string[] {
  const expiredIds: string[] = [];
  let changed = false;
  const now = nowMs();
  Object.keys(timers.value).forEach(id => {
    const timer = timers.value[id];
    if (!timer) return;
    if (timer.state === 'running' && timer.startedAt !== null) {
      if (remainingMs(timer, now) === 0) {
        timer.state = 'ready';
        timer.startedAt = null;
        changed = true;
        if (!silent) expiredIds.push(id);
      }
    }
  });
  if (changed) {
    timers.value = { ...timers.value };
    persistTimers();
  }
  return expiredIds;
}

function hydrate(): void {
  if (hydrated) return;
  const loaded = loadFromStorage();
  const next: Record<string, PersistedTimer> = {};
  for (const item of loaded) next[item.id] = { ...item };
  timers.value = next;
  // Silent reconcile — design says no intrusive alert at app open.
  reconcileExpired(true);
  hydrated = true;
}

function hasRunningTimers(): boolean {
  return Object.values(timers.value).some(timer =>
    timer.state === 'running' && remainingMs(timer) > 0,
  );
}

function clearTimerInterval(): void {
  if (!timerInterval || typeof window === 'undefined') return;
  window.clearInterval(timerInterval);
  timerInterval = null;
}

function fireExpiryAlert(id: string): void {
  const timer = timers.value[id];
  if (!timer) return;
  const message = t('toast_timer_done', { name: timer.name });
  const timerId = id;
  triggerTimerAlertRef?.(message, undefined, () => extendTimer(timerId, 120));
}

function tick(): void {
  // Bump tickKey so the public computed re-derives `display` and `remaining`.
  tickKey.value += 1;
  const expired = reconcileExpired(false);
  for (const id of expired) fireExpiryAlert(id);
  if (!hasRunningTimers()) clearTimerInterval();
}

function syncTimerInterval(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!hasRunningTimers() || document.hidden) {
    clearTimerInterval();
    return;
  }
  if (timerInterval) return;
  timerInterval = window.setInterval(tick, 1000);
}

function attachVisibilityHandler(): void {
  if (visibilityHandler || typeof document === 'undefined') return;
  visibilityHandler = () => {
    if (document.hidden) {
      clearTimerInterval();
      return;
    }
    // Coming back into view — reconcile any timers that expired during the
    // hidden period (alerts surface so the user knows what completed) and
    // restart the tick.
    tickKey.value += 1;
    const expired = reconcileExpired(false);
    for (const id of expired) fireExpiryAlert(id);
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
  activeConsumers = 0;
  showToastRef = null;
  triggerTimerAlertRef = null;
  if (resetState) {
    timers.value = {};
    tickKey.value = 0;
    hydrated = false;
  }
}

function registerTimersConsumer(
  showToast: (message: string, type?: string) => void,
  triggerTimerAlert: (message: string, title?: string) => void,
): void {
  showToastRef = showToast;
  triggerTimerAlertRef = triggerTimerAlert;
  activeConsumers += 1;
  hydrate();
  attachVisibilityHandler();
  syncTimerInterval();
}

function releaseTimersConsumer(): void {
  activeConsumers = Math.max(0, activeConsumers - 1);
  if (activeConsumers === 0) {
    cleanupTimersRuntime();
  }
}

function extendTimer(id: string, seconds: number): void {
  const timer = timers.value[id];
  if (!timer) return;
  const next: PersistedTimer = {
    ...timer,
    durationMs: timer.durationMs + seconds * 1000,
    state: 'running',
    startedAt: nowMs(),
    elapsedAtPauseMs: timer.state === 'paused' ? timer.elapsedAtPauseMs : 0,
  };
  timers.value = { ...timers.value, [id]: next };
  persistTimers();
  syncTimerInterval();
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
    const totalSec = (parseInt(String(min), 10) || 0) * 60 + (parseInt(String(sec), 10) || 0);
    if (totalSec <= 0) {
      showToast(t('timer_invalid'), 'error');
      return false;
    }
    const id = `t${nowMs()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: PersistedTimer = {
      id,
      name: timerName,
      durationMs: totalSec * 1000,
      state: 'running',
      startedAt: nowMs(),
      elapsedAtPauseMs: 0,
    };
    timers.value = { ...timers.value, [id]: next };
    persistTimers();
    syncTimerInterval();
    return true;
  }

  function startRecipeTimer(name: string, seconds: number): boolean {
    const existing = Object.values(timers.value).find(timer =>
      timer.name === name && remainingMs(timer) > 0,
    );
    if (existing) return false;
    const id = `t${nowMs()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: PersistedTimer = {
      id,
      name,
      durationMs: seconds * 1000,
      state: 'running',
      startedAt: nowMs(),
      elapsedAtPauseMs: 0,
    };
    timers.value = { ...timers.value, [id]: next };
    persistTimers();
    syncTimerInterval();
    return true;
  }

  function toggleTimer(id: string): void {
    const timer = timers.value[id];
    if (!timer) return;
    let next: PersistedTimer;
    if (timer.state === 'running' && timer.startedAt !== null) {
      // Pause
      const elapsed = Math.max(0, nowMs() - timer.startedAt) + timer.elapsedAtPauseMs;
      next = {
        ...timer,
        state: 'paused',
        startedAt: null,
        elapsedAtPauseMs: Math.min(elapsed, timer.durationMs),
      };
    } else if (timer.state === 'paused') {
      // Resume
      next = { ...timer, state: 'running', startedAt: nowMs() };
    } else if (timer.state === 'stopped') {
      // Start fresh
      next = { ...timer, state: 'running', startedAt: nowMs(), elapsedAtPauseMs: 0 };
    } else {
      // 'ready' — toggle is a no-op (matches legacy behavior where flipping
      // running on a remaining===0 timer was skipped by the tick).
      return;
    }
    timers.value = { ...timers.value, [id]: next };
    persistTimers();
    syncTimerInterval();
  }

  function resetTimer(id: string): void {
    const timer = timers.value[id];
    if (!timer) return;
    const next: PersistedTimer = {
      ...timer,
      state: 'stopped',
      startedAt: null,
      elapsedAtPauseMs: 0,
    };
    timers.value = { ...timers.value, [id]: next };
    persistTimers();
    syncTimerInterval();
  }

  function deleteTimer(id: string): void {
    if (!timers.value[id]) return;
    const next = { ...timers.value };
    delete next[id];
    timers.value = next;
    persistTimers();
    syncTimerInterval();
  }

  return {
    timers: computed(() => {
      // Read tickKey so this computed invalidates each second; remainingMs is
      // re-derived from Date.now() without mutating the persisted records.
      void tickKey.value;
      const now = nowMs();
      return Object.values(timers.value).map(timer => {
        const remMs = remainingMs(timer, now);
        const remainingSec = Math.ceil(remMs / 1000);
        const totalSec = Math.round(timer.durationMs / 1000);
        const isRunning = timer.state === 'running' && remMs > 0;
        const isReady = timer.state === 'ready' || remMs === 0;
        return {
          id: timer.id,
          name: timer.name,
          total: totalSec,
          remaining: remainingSec,
          running: isRunning,
          state: timer.state,
          display: isReady ? t('timer_ready') : formatClock(remainingSec),
          buttonLabel: isRunning ? t('timer_pause') : t('timer_start'),
          cls: isReady ? 'done' : isRunning ? 'running' : '',
        };
      });
    }),
    addTimer,
    startRecipeTimer,
    toggleTimer,
    resetTimer,
    deleteTimer,
    extendTimer,
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupTimersRuntime();
  });
}
