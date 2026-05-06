import type { ImportSource } from '../../types';

const ANTHROPIC_API_KEY = String(import.meta.env.VITE_ANTHROPIC_API_KEY || '').trim();
const SOCIAL_IMPORT_ENABLED = ANTHROPIC_API_KEY.length > 0;

// Anthropic Messages API typically responds in 1–10s for the small payloads we
// send (max_tokens: 1000), with a long tail up to ~20s for slow completions.
// 30s is comfortably above the p99 while still bounding indefinite hangs from
// network-edge stalls — a stuck request would otherwise leave the import flow
// spinner up forever with no escape for the user.
const ANTHROPIC_FETCH_TIMEOUT_MS = 30000;

function normalizeSourceDomain(url: string): string {
  try {
    let hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'youtu.be' || hostname.endsWith('.youtube.com')) hostname = 'youtube.com';
    if (hostname.endsWith('.instagram.com')) hostname = 'instagram.com';
    if (hostname.endsWith('.tiktok.com')) hostname = 'tiktok.com';
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length >= 3) {
      const tail = parts.slice(-2).join('.');
      if (tail === 'co.uk' || tail === 'com.br' || tail === 'com.au') {
        return parts.slice(-3).join('.');
      }
      return tail;
    }
    return hostname;
  } catch {
    return '';
  }
}

function detectSource(url: string): ImportSource {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'web';
}

export { ANTHROPIC_API_KEY, ANTHROPIC_FETCH_TIMEOUT_MS, normalizeSourceDomain, detectSource };
export { SOCIAL_IMPORT_ENABLED };
