import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const toastSpy = vi.fn();
const alertSpy = vi.fn();

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
    vi.useFakeTimers();
    toastSpy.mockReset();
    alertSpy.mockReset();
    vi.resetModules();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('document', createFakeDocument());
  });

  afterEach(async () => {
    const timersModule = await import('../../src/composables/useTimers.js');
    timersModule.cleanupTimersRuntime({ resetState: true });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stops the global interval when all timers are paused or removed', async () => {
    const { useTimers, cleanupTimersRuntime } = await import('../../src/composables/useTimers.js');
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
  });

  it('clears ticking while hidden and catches timers up when visible again', async () => {
    const { useTimers } = await import('../../src/composables/useTimers.js');
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
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
