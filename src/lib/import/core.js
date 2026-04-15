const ANTHROPIC_API_KEY = '';

function normalizeSourceDomain(url) {
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

function detectSource(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'web';
}

export { ANTHROPIC_API_KEY, normalizeSourceDomain, detectSource };
