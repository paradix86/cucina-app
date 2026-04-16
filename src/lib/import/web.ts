import type { ImportFailureStage } from '../../types';

async function fetchReadableImportPage(url: string): Promise<string> {
  const resp = await fetch(`https://r.jina.ai/${url}`);
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
  if (/(?:_NOT_FOUND|_PARSE|_INCOMPLETE|_UNSUPPORTED)/.test(message)) return 'parse-content';
  return 'parse-content';
}

export { fetchReadableImportPage, extractPageHeadingsHint, inferImportFailureStage };
