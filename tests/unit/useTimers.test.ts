import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted() runs before any static imports, so these spy instances exist
// when the vi.mock() factories below are evaluated.
const { toastSpy, alertSpy } = vi.hoisted(() => ({
  toastSpy: vi.fn(),
  alertSpy: vi.fn(),
}));

vi.mock('../../src/composables/useToasts.js', () => ({
  useToasts: () => ({
    showToast: toastSpy,
  }),
}));

vi.mock('../../src/composables/useTimerAlerts.js', () => ({
  useTimerAlerts: () => ({
    triggerTimerAlert: alertSpy,
  }),
}));

// Static import is safe because vi.hoisted() already initialised the spies
// that the mock factories above reference.  No vi.resetModules() is needed:
// cleanupTimersRuntime({ resetState: true }) resets all module-level state
// (timers, timerInterval, visibilityHandler, activeConsumers, hiddenAt,
// showToastRef, triggerTimerAlertRef), and document/window are re-stubbed in
// beforeEach, so each test gets a clean slate without blowing away the entire
// module cache.
import { useTimers, cleanupTimersRuntime } from '../../src/composables/useTimers.js';

function createFakeDocument() {
  const target = new EventTarget();
  let hidden = false;
  const createNode = () => ({
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    insertBefore: vi.fn(),
    removeChild: vi.fn(),
    cloneNode: vi.fn(() => createNode()),
    firstChild: null,
    lastChild: null,
    previousSibling: null,
    nextSibling: null,
    parentNode: null,
    textContent: '',
    nodeValue: '',
    innerHTML: '',
    content: {
      firstChild: null,
      appendChild: vi.fn(),
    },
  });
  return {
    get hidden() {
      return hidden;
    },
    set hidden(value: boolean) {
      hidden = value;
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    createElement: vi.fn(() => createNode()),
    createElementNS: vi.fn(() => createNode()),
    createTextNode: vi.fn(text => ({ nodeValue: text })),
    createComment: vi.fn(text => ({ nodeValue: text })),
    querySelector: vi.fn(() => null),
  };
}

function createFakeLocalStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
    _raw: () => store,
  };
}

describe('useTimers lifecycle', () => {
  beforeEach(() => {
    // Reset module state before each test (safety guard — afterEach also calls
    // this, but a beforeEach guard covers the first test and any future test
    // that runs without a prior afterEach).
    cleanupTimersRuntime({ resetState: true });
    vi.useFakeTimers();
    toastSpy.mockReset();
    alertSpy.mockReset();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('document', createFakeDocument());
    vi.stubGlobal('localStorage', createFakeLocalStorage());
  });

  afterEach(() => {
    cleanupTimersRuntime({ resetState: true });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stops the global interval when all timers are paused or removed', () => {
    const api = useTimers();

    expect(vi.getTimerCount()).toBe(0);
    expect(api.addTimer('Pasta', '0', '5')).toBe(true);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    const timerId = api.timers.value[0].id;
    api.toggleTimer(timerId);
    expect(vi.getTimerCount()).toBe(0);

    api.toggleTimer(timerId);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    api.deleteTimer(timerId);
    expect(vi.getTimerCount()).toBe(0);

    cleanupTimersRuntime({ resetState: true });
    expect(vi.getTimerCount()).toBe(0);
  }, 10_000);

  it('clears ticking while hidden and catches timers up when visible again', () => {
    const api = useTimers();
    const doc = document as unknown as ReturnType<typeof createFakeDocument>;

    api.addTimer('Pane', '0', '3');
    const timerId = api.timers.value[0].id;

    vi.advanceTimersByTime(1000);
    expect(api.timers.value.find(timer => timer.id === timerId)?.remaining).toBe(2);

    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(api.timers.value.find(timer => timer.id === timerId)?.remaining).toBe(2);

    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));

    const timer = api.timers.value.find(entry => entry.id === timerId);
    expect(timer?.remaining).toBe(0);
    expect(timer?.cls).toBe('done');
    // timer completion fires the alert modal only — toast was intentionally removed
    expect(toastSpy).toHaveBeenCalledTimes(0);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

// T-3: anchor-based persistence so a running timer survives a page reload.
// Reload is simulated by cleanupTimersRuntime({ resetState: true }) followed by
// a fresh useTimers() call; localStorage is preserved across the reset to
// mimic a real browser refresh.
describe('useTimers persistence (T-3)', () => {
  beforeEach(() => {
    cleanupTimersRuntime({ resetState: true });
    vi.useFakeTimers();
    toastSpy.mockReset();
    alertSpy.mockReset();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('document', createFakeDocument());
    vi.stubGlobal('localStorage', createFakeLocalStorage());
  });

  afterEach(() => {
    cleanupTimersRuntime({ resetState: true });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function reloadApp() {
    // Simulate a full page reload: in-memory state cleared, but localStorage
    // (the source of truth) is preserved so the next useTimers() call hydrates.
    cleanupTimersRuntime({ resetState: true });
    // useTimers() pulls a fresh fake document on each invocation only if we
    // re-stub; the existing stub keeps event listeners cleared by cleanup.
    vi.stubGlobal('document', createFakeDocument());
    return useTimers();
  }

  it('running timer persists and reloads with correct remaining', () => {
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'));
    const api = useTimers();
    api.addTimer('Pasta', '25', '0'); // 25 minutes
    const idBefore = api.timers.value[0].id;

    // Advance fake clock by 5 minutes — Date.now() advances with fake timers.
    vi.advanceTimersByTime(5 * 60_000);
    expect(api.timers.value[0].remaining).toBe(20 * 60);

    // Simulate reload: same wall-clock, but in-memory state cleared.
    const api2 = reloadApp();
    const after = api2.timers.value[0];
    expect(after.id).toBe(idBefore);
    expect(after.running).toBe(true);
    expect(after.state).toBe('running');
    expect(after.remaining).toBe(20 * 60);
  });

  it('running timer that expired during standby reconciles to ready (no alert at app open)', () => {
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'));
    const api = useTimers();
    api.addTimer('Pasta', '25', '0');

    // Advance fake clock by 30 minutes — past the 25-minute duration.
    vi.advanceTimersByTime(30 * 60_000);

    // Simulate reload after expiry-during-standby. Hydrated state should be
    // 'ready' with no alert fired (design: no intrusive modal at app open).
    alertSpy.mockReset();
    const api2 = reloadApp();
    const after = api2.timers.value[0];
    expect(after.state).toBe('ready');
    expect(after.remaining).toBe(0);
    expect(after.cls).toBe('done');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('paused timer round-trips state and elapsed, then resumes correctly', () => {
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'));
    const api = useTimers();
    api.addTimer('Pane', '25', '0');
    const id = api.timers.value[0].id;

    vi.advanceTimersByTime(5 * 60_000);
    api.toggleTimer(id); // pause at 5 min elapsed → 20 min remaining
    expect(api.timers.value[0].state).toBe('paused');
    expect(api.timers.value[0].remaining).toBe(20 * 60);

    // Skip 1 hour while paused — paused timers must NOT decrement.
    vi.advanceTimersByTime(60 * 60_000);

    const api2 = reloadApp();
    expect(api2.timers.value[0].state).toBe('paused');
    expect(api2.timers.value[0].remaining).toBe(20 * 60);

    // Resume and advance 10 minutes.
    api2.toggleTimer(id);
    expect(api2.timers.value[0].state).toBe('running');
    vi.advanceTimersByTime(10 * 60_000);
    expect(api2.timers.value[0].remaining).toBe(10 * 60);
  });

  it('stopped (reset) timer round-trips with full duration', () => {
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'));
    const api = useTimers();
    api.addTimer('Pizza', '10', '0');
    const id = api.timers.value[0].id;

    vi.advanceTimersByTime(60_000);
    api.resetTimer(id);
    expect(api.timers.value[0].state).toBe('stopped');
    expect(api.timers.value[0].remaining).toBe(10 * 60);

    const api2 = reloadApp();
    expect(api2.timers.value[0].state).toBe('stopped');
    expect(api2.timers.value[0].remaining).toBe(10 * 60);
    expect(api2.timers.value[0].running).toBe(false);
  });

  it('system clock backward jump caps remaining at duration (no overflow)', () => {
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'));
    const api = useTimers();
    api.addTimer('Soup', '10', '0');

    // Jump system clock 5 minutes backward.
    vi.setSystemTime(new Date('2026-05-07T09:55:00Z'));

    // Remaining must NOT exceed duration; elapsed is clamped to 0.
    const after = api.timers.value[0];
    expect(after.remaining).toBeLessThanOrEqual(10 * 60);
    expect(after.remaining).toBe(10 * 60);
  });

  it('corrupted localStorage value hydrates to empty timers without crashing', () => {
    localStorage.setItem('cucina_timers_v1', '{not valid json');
    const api = useTimers();
    expect(api.timers.value).toEqual([]);
  });

  it('localStorage value that is valid JSON but wrong shape is filtered out', () => {
    localStorage.setItem(
      'cucina_timers_v1',
      JSON.stringify([
        { id: 'good', name: 'Ok', durationMs: 60000, state: 'stopped', startedAt: null, elapsedAtPauseMs: 0 },
        { wrong: 'shape' },
        null,
        { id: 'no-duration', name: 'X', state: 'stopped', startedAt: null, elapsedAtPauseMs: 0 },
      ]),
    );
    const api = useTimers();
    expect(api.timers.value).toHaveLength(1);
    expect(api.timers.value[0].id).toBe('good');
  });

  it('multiple timers each maintain independent state across reload', () => {
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'));
    const api = useTimers();
    api.addTimer('A', '10', '0');
    api.addTimer('B', '5', '0');
    api.addTimer('C', '2', '0');
    const ids = api.timers.value.map(t => t.id);

    // Pause B at 1 minute.
    vi.advanceTimersByTime(60_000);
    api.toggleTimer(ids[1]);
    // Reset C entirely.
    api.resetTimer(ids[2]);

    const api2 = reloadApp();
    const map: Record<string, ReturnType<typeof api2.timers.value[0] extends infer T ? () => T : never> | typeof api2.timers.value[0]> = {};
    for (const t of api2.timers.value) (map as Record<string, typeof t>)[t.name] = t;

    const a = api2.timers.value.find(t => t.name === 'A')!;
    const b = api2.timers.value.find(t => t.name === 'B')!;
    const c = api2.timers.value.find(t => t.name === 'C')!;

    expect(a.state).toBe('running');
    expect(a.remaining).toBe(9 * 60);     // 10:00 - 1:00 elapsed
    expect(b.state).toBe('paused');
    expect(b.remaining).toBe(4 * 60);     // 5:00 - 1:00 paused at
    expect(c.state).toBe('stopped');
    expect(c.remaining).toBe(2 * 60);     // reset to full
  });

  it('storage is written on every state transition (and not on every tick)', () => {
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'));
    const ls = localStorage as unknown as ReturnType<typeof createFakeLocalStorage>;
    const setItemSpy = vi.spyOn(ls, 'setItem');
    const api = useTimers();

    setItemSpy.mockClear();
    api.addTimer('A', '0', '5');
    expect(setItemSpy).toHaveBeenCalledTimes(1); // create

    setItemSpy.mockClear();
    vi.advanceTimersByTime(2000); // 2 seconds of ticks → must NOT persist
    expect(setItemSpy).not.toHaveBeenCalled();

    const id = api.timers.value[0].id;
    api.toggleTimer(id); // pause
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    setItemSpy.mockClear();
    api.toggleTimer(id); // resume
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    setItemSpy.mockClear();
    api.deleteTimer(id);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
  });
});
