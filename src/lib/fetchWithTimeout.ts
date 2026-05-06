import { OfflineError } from './errors';

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs: number;
}

// Wraps fetch with an AbortController-based timeout. The underlying fetch
// rejects with an AbortError on expiry; callers translate that into the
// appropriate domain response (silent fallback, typed error, user message).
//
// If the caller passes its own AbortSignal in `init.signal`, the resulting
// fetch is aborted when EITHER the timeout fires OR the caller's signal
// aborts. AbortSignal.any() is not used because Vite's default 'modules'
// target includes Safari 14, which predates that API; manual forwarding
// keeps support honest.
//
// Pre-check: throws OfflineError without issuing the request when navigator
// reports offline. In Node and other non-browser environments navigator is
// undefined or .onLine is undefined; both pass through.
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions,
): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OfflineError();
  }

  const { timeoutMs, signal: callerSignal, ...init } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let onCallerAbort: (() => void) | undefined;
  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      onCallerAbort = () => controller.abort();
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (callerSignal && onCallerAbort) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  }
}
