export const APPROVED_BIMBY_ACTION_KEYS = Object.freeze([
  'reverse',
  'knead',
  'scissors',
  'cup',
  'open',
  'lock',
] as const);

type BimbyActionKey = typeof APPROVED_BIMBY_ACTION_KEYS[number];

export const BIMBY_ICONS: Record<BimbyActionKey, string> = {
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

export const BIMBY_ACTION_PATTERNS: Record<BimbyActionKey, RegExp> = {
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

function assertExactApprovedKeys(recordName: string, record: object): void {
  const expected = [...APPROVED_BIMBY_ACTION_KEYS].sort();
  const actual = Object.keys(record).sort();
  const sameLength = expected.length === actual.length;
  const sameOrder = sameLength && expected.every((key, idx) => key === actual[idx]);
  if (!sameOrder) {
    throw new Error(`[bimbyIcons] ${recordName} keys must exactly match APPROVED_BIMBY_ACTION_KEYS. Expected: ${expected.join(', ')}. Actual: ${actual.join(', ')}`);
  }
}

// Fail fast if anyone adds/removes icon or detector keys without deliberate review.
assertExactApprovedKeys('BIMBY_ICONS', BIMBY_ICONS);
assertExactApprovedKeys('BIMBY_ACTION_PATTERNS', BIMBY_ACTION_PATTERNS);

export function detectBimbyAction(stepText: string): BimbyActionKey | null {
  if (!stepText) return null;
  for (const action of APPROVED_BIMBY_ACTION_KEYS) {
    const pattern = BIMBY_ACTION_PATTERNS[action];
    if (pattern.test(stepText)) return action;
  }
  return null;
}

export function renderBimbyActionIcon(action: string | null): string {
  if (!action || !(action in BIMBY_ICONS)) return '';
  return `<span class="bimby-action-icon" title="${action}">${BIMBY_ICONS[action as BimbyActionKey]}</span>`;
}

export function renderStepActionIcon(stepText: string): string {
  return renderBimbyActionIcon(detectBimbyAction(stepText));
}
