import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '../../src/lib/fetchWithTimeout';
import { isOfflineError } from '../../src/lib/errors';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves with the fetch response when fetch settles before the timeout', async () => {
    vi.useFakeTimers();
    const expected = { ok: true } as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(expected));

    const promise = fetchWithTimeout('https://example.com', { timeoutMs: 5000 });

    const resp = await promise;
    expect(resp).toBe(expected);
  });

  it('clears the timeout setTimeout on the success path', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));

    await fetchWithTimeout('https://example.com', { timeoutMs: 5000 });

    expect(clearSpy).toHaveBeenCalled();
    // No pending timers should remain — runAllTimers would otherwise abort
    // a stale controller (no-op since fetch already resolved, but still proves
    // the cleanup path ran).
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with AbortError when the timeout fires before fetch resolves', async () => {
    vi.useFakeTimers();
    let abortedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      abortedSignal = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithTimeout('https://example.com', { timeoutMs: 1000 });
    const settled = promise.catch((err: Error) => err);

    // Advance timers past the timeout to trigger controller.abort()
    await vi.advanceTimersByTimeAsync(1500);

    const err = await settled;
    expect((err as Error).name).toBe('AbortError');
    expect(abortedSignal?.aborted).toBe(true);
  });

  it("rejects with AbortError when the caller's signal aborts before the timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const callerController = new AbortController();
    const promise = fetchWithTimeout('https://example.com', {
      timeoutMs: 60000,
      signal: callerController.signal,
    });
    const settled = promise.catch((err: Error) => err);

    // Caller aborts at t=10ms — well before the 60s timeout would fire.
    await vi.advanceTimersByTimeAsync(10);
    callerController.abort();

    const err = await settled;
    expect((err as Error).name).toBe('AbortError');
  });

  it("aborts immediately when the caller's signal was already aborted", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      // If init.signal is already aborted, real fetch rejects synchronously
      // with AbortError. Match that behavior in the mock.
      if (init.signal?.aborted) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      }
      return Promise.resolve({ ok: true } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    const callerController = new AbortController();
    callerController.abort();

    const err = await fetchWithTimeout('https://example.com', {
      timeoutMs: 60000,
      signal: callerController.signal,
    }).catch((e: Error) => e);

    expect((err as Error).name).toBe('AbortError');
    // The pre-aborted path should also clear its timeout to avoid leaking.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('forwards the request body, method, and headers verbatim to fetch', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithTimeout('https://api.example.com/v1/x', {
      method: 'POST',
      headers: { 'X-Test': 'yes' },
      body: '{"hello":"world"}',
      timeoutMs: 1000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/v1/x');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toEqual({ 'X-Test': 'yes' });
    expect((init as RequestInit).body).toBe('{"hello":"world"}');
    // The init must have a signal (the timeout controller's), not undefined.
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  describe('offline precheck', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('throws OfflineError when navigator.onLine is false (no fetch issued)', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('navigator', { onLine: false });
      vi.stubGlobal('fetch', fetchMock);

      const err = await fetchWithTimeout('https://example.com', { timeoutMs: 1000 })
        .catch((e: Error) => e);

      expect(isOfflineError(err)).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('proceeds when navigator.onLine is true', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));

      const resp = await fetchWithTimeout('https://example.com', { timeoutMs: 1000 });
      expect(resp.ok).toBe(true);
    });

    it('proceeds when navigator is undefined (Node / non-browser environment)', async () => {
      vi.stubGlobal('navigator', undefined);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));

      const resp = await fetchWithTimeout('https://example.com', { timeoutMs: 1000 });
      expect(resp.ok).toBe(true);
    });
  });
});
