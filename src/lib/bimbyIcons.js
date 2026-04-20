/**
 * bimbyIcons.js
 * Original lightweight Bimby/Thermomix action icons — strict approved set only.
 *
 * Approved actions: reverse, knead, scissors, cup, open, lock
 * Anything outside this set is intentionally not supported.
 *
 * Policy freeze:
 * - This action set is intentionally CLOSED.
 * - False positives are worse than missing icons.
 * - Do not add/remove action keys without explicit product review + tests update.
 */

export const APPROVED_BIMBY_ACTION_KEYS = Object.freeze([
  'reverse',
  'knead',
  'scissors',
  'cup',
  'open',
  'lock',
]);

/* ============================================================
   ICON SET — minimal original SVGs for approved Bimby actions
   ============================================================ */

export const BIMBY_ICONS = {
  // Counterclockwise / reverse-blade rotation
  reverse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><path d="M3 8l4 4H3V8M21 16l-4-4h4v4M9 6a8 8 0 018 8m0 8a8 8 0 01-8-8"/></svg>`,

  // Knead / impasto / spiga mode
  knead: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><ellipse cx="12" cy="12" rx="8" ry="10"/><path d="M12 8v8M8 12h8"/><path d="M6 6l12 12M18 6L6 18"/></svg>`,

  // Scissors / forbici / pulse chop
  scissors: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,

  // Measuring cup (misurino) — present, removed, or managed
  cup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><path d="M7 4h10l-2 16H9L7 4z"/><line x1="7.5" y1="9" x2="16.5" y2="9"/><line x1="8.5" y1="14" x2="15.5" y2="14"/></svg>`,

  // Lid open / coperchio aperto — upward arrow from bowl
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><rect x="4" y="15" width="16" height="5" rx="1"/><path d="M4 15a8 4 0 0116 0"/><path d="M12 10V5M9.5 7.5L12 5l2.5 2.5"/></svg>`,

  // Lid lock / coperchio chiuso / locked
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="20" r="1"/></svg>`,
};

/* ============================================================
   DETECTOR — strict allowlist mapping only
   ============================================================
   Rules:
   - Each pattern must be high-confidence and Bimby-specific.
   - Generic cooking words (open, close, reverse) must NOT match
     unless they are combined with Bimby-specific context terms
     (e.g. "coperchio", "misurino", "antiorario").
   - False positives are worse than missing icons.
   ============================================================ */

export const BIMBY_ACTION_PATTERNS = {
  // Counterclockwise blade rotation — Bimby-specific Italian term
  reverse: /antiorario|senso\s+antiorario|contro[-\s]?orario|counterclockwise|reverse\s+blade|blade\s+reverse/i,

  // Kneading dough — "impast*" covers impastare/impasto; spiga = Bimby kneading symbol
  knead: /\bimpast|\bknead|\bspiga\b/i,

  // Scissors / forbici — Bimby pulse-chop function
  scissors: /\bforbici\b|\bscissor/i,

  // Measuring cup (misurino) — explicit reference to the cup
  cup: /\bmisurino\b|measuring[-\s]?cup/i,

  // Lid open — requires "coperchio" (lid) for Italian; "lid" for English
  open: /apri(?:re)?\s+(?:il\s+)?coperchio|coperchio\s+aperto|rimuov\w+\s+(?:il\s+)?coperchio|toglie(?:re)?\s+(?:il\s+)?coperchio|open\s+(?:the\s+)?lid|remove\s+(?:the\s+)?lid|lift\s+(?:the\s+)?lid/i,

  // Lid lock / closed — requires "coperchio" for Italian; "lid" for English
  lock: /chiud\w*\s+(?:il\s+)?coperchio|blocca\s+(?:il\s+)?coperchio|coperchio\s+chiuso|lock\s+(?:the\s+)?lid|close\s+(?:the\s+)?lid/i,
};

function toSortedKeys(record) {
  return Object.keys(record).sort();
}

function assertClosedActionSet(mapName, record) {
  const expected = [ ...APPROVED_BIMBY_ACTION_KEYS ].sort();
  const actual = toSortedKeys(record);
  if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
    throw new Error(`[bimbyIcons] ${mapName} keys must exactly match APPROVED_BIMBY_ACTION_KEYS. Expected ${expected.join(', ')}; got ${actual.join(', ')}`);
  }
}

assertClosedActionSet('BIMBY_ICONS', BIMBY_ICONS);
assertClosedActionSet('BIMBY_ACTION_PATTERNS', BIMBY_ACTION_PATTERNS);

/**
 * Detect which approved Bimby action (if any) the step implies.
 * Returns null for any step that does not clearly match an approved action.
 *
 * @param {string} stepText - full step text (may include tag prefix)
 * @returns {string|null} approved action key or null
 */
export function detectBimbyAction(stepText) {
  if (!stepText) return null;
  for (const action of APPROVED_BIMBY_ACTION_KEYS) {
    const pattern = BIMBY_ACTION_PATTERNS[action];
    if (pattern.test(stepText)) return action;
  }
  return null;
}

/**
 * Render icon HTML for an approved action.
 *
 * @param {string|null} action - action key from detectBimbyAction
 * @returns {string} SVG HTML string or empty string
 */
export function renderBimbyActionIcon(action) {
  if (!action || !(action in BIMBY_ICONS)) return '';
  return `<span class="bimby-action-icon" title="${action}">${BIMBY_ICONS[action]}</span>`;
}

/**
 * Combined convenience: detect and render for a step.
 *
 * @param {string} stepText
 * @returns {string} rendered HTML or empty string
 */
export function renderStepActionIcon(stepText) {
  return renderBimbyActionIcon(detectBimbyAction(stepText));
}
