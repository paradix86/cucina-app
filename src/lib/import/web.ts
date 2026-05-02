import type { ImportFailureStage } from '../../types';
import { OfflineError } from '../errors';

export class ImportTimeoutError extends Error {
  name = 'ImportTimeoutError';
}

export class ImportFetchError extends Error {
  name = 'ImportFetchError';
  constructor(public status: number, statusText?: string) {
    super(`HTTP ${status}${statusText ? ' ' + statusText : ''}`);
  }
}

const IMPORT_FETCH_TIMEOUT_MS = 12000;

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  // Fire only when navigator explicitly reports offline. In Node and other
  // non-browser environments navigator.onLine is undefined, which we treat
  // as "unknown" and let the request proceed.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OfflineError();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMPORT_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if ((error as Error)?.name === 'AbortError') {
      throw new ImportTimeoutError('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchReadableImportPage(url: string): Promise<string> {
  const resp = await fetchWithTimeout(`https://r.jina.ai/${url}`);
  if (!resp.ok) throw new ImportFetchError(resp.status, resp.statusText);
  return resp.text();
}

/**
 * Fetch the raw HTML of a page via the Jina Reader proxy.
 * Used as a last-resort path to extract JSON-LD structured data when
 * the markdown-based adapters and generic fallback both fail.
 *
 * Jina proxies the request and returns cleaned HTML that preserves
 * <script type="application/ld+json"> blocks embedded in the page body.
 * Head-only script blocks may be omitted depending on the site.
 */
async function fetchHtmlForJsonLd(url: string): Promise<string> {
  const resp = await fetchWithTimeout(`https://r.jina.ai/${url}`, {
    headers: { 'x-return-format': 'html' },
  });
  if (!resp.ok) throw new ImportFetchError(resp.status, resp.statusText);
  return resp.text();
}

function extractPageHeadingsHint(markdown: string | null | undefined): string | null {
  const headings = (markdown || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^#{1,3} /.test(line))
    .slice(0, 8);
  return headings.length ? headings.join(' · ') : null;
}

function inferImportFailureStage(message: string | Error): ImportFailureStage {
  let msg = '';
  
  if (message instanceof ImportTimeoutError) {
    return 'fetch-readable-page';
  }
  if (message instanceof ImportFetchError) {
    return 'fetch-readable-page';
  }
  
  if (message instanceof Error) {
    msg = message.message;
  } else {
    msg = String(message);
  }
  
  if (!msg) return 'parse-content';
  if (msg === 'WEB_TIMEOUT' || msg.startsWith('WEB_FETCH_') || msg.startsWith('HTTP ')) return 'fetch-readable-page';
  if (msg === 'UNSUPPORTED_WEB_IMPORT') return 'select-adapter';
  if (/(?:_NOT_FOUND|_PARSE|_INCOMPLETE|_UNSUPPORTED|^JSONLD_)/.test(msg)) return 'parse-content';
  return 'parse-content';
}

export { fetchReadableImportPage, fetchHtmlForJsonLd, extractPageHeadingsHint, inferImportFailureStage };
