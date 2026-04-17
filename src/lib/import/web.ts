import type { ImportFailureStage } from '../../types';

async function fetchReadableImportPage(url: string): Promise<string> {
  const resp = await fetch(`https://r.jina.ai/${url}`);
  if (!resp.ok) throw new Error(`WEB_FETCH_${resp.status}`);
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
  const resp = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'x-return-format': 'html' },
  });
  if (!resp.ok) throw new Error(`WEB_FETCH_${resp.status}`);
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

function inferImportFailureStage(message: string): ImportFailureStage {
  if (!message) return 'parse-content';
  if (message.startsWith('WEB_FETCH_') || message.startsWith('HTTP ')) return 'fetch-readable-page';
  if (message === 'UNSUPPORTED_WEB_IMPORT') return 'select-adapter';
  if (/(?:_NOT_FOUND|_PARSE|_INCOMPLETE|_UNSUPPORTED|^JSONLD_)/.test(message)) return 'parse-content';
  return 'parse-content';
}

export { fetchReadableImportPage, fetchHtmlForJsonLd, extractPageHeadingsHint, inferImportFailureStage };
