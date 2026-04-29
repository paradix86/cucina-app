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
