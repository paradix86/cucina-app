// URL normalization for duplicate detection (audit finding I-3).
// Two URLs that point to the same recipe page should compare equal:
//   https://Site.com/Recipe-Name/        ───┐
//   https://site.com/Recipe-Name         ───┼── all the same recipe
//   https://site.com/Recipe-Name?utm_source=newsletter  ───┘
//   https://site.com/Recipe-Name#instructions
//
// Path-meaningful query params (e.g. an `?id=42` that's the actual recipe id)
// must NOT be stripped, so we only drop a fixed allowlist of tracking params
// rather than dropping the entire query string.
const TRACKING_PARAM_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_name',
  'utm_brand',
  'utm_social',
  'fbclid',
  'gclid',
  'gclsrc',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  '_ga',
  'ref',
  'ref_src',
]);

export function normalizeUrl(input: string): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Not a parseable URL (e.g. relative path, malformed). Fall back to a
    // defensive lowercase-trim so two equally malformed strings can still
    // match against each other; we don't try harder than that.
    return trimmed.toLowerCase().replace(/\s+/g, '');
  }

  parsed.hash = '';
  parsed.host = parsed.host.toLowerCase();
  parsed.protocol = parsed.protocol.toLowerCase();

  for (const key of Array.from(parsed.searchParams.keys())) {
    if (TRACKING_PARAM_KEYS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }

  // Sort the surviving params so order doesn't change the equality.
  const remaining = Array.from(parsed.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b));
  for (const key of Array.from(parsed.searchParams.keys())) {
    parsed.searchParams.delete(key);
  }
  for (const [k, v] of remaining) parsed.searchParams.append(k, v);

  // Drop a single trailing slash, but keep "/" for the root path.
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }

  return parsed.toString();
}
