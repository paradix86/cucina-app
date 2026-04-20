/**
 * bimbyIcons.js
 * Original lightweight Bimby/Thermomix action icons and detection
 */

/* ============================================================
   ICON SET — Minimal, original SVG icons for Bimby actions
   ============================================================ */

export const BIMBY_ICONS = {
    reverse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><path d="M3 8l4 4H3V8M21 16l-4-4h4v4M9 6a8 8 0 018 8m0 8a8 8 0 01-8-8"/></svg>`,

    simmer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><path d="M4 8h16M4 12h16M4 16h8"/><circle cx="6" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="18" cy="5" r="1.5"/></svg>`,

    knead: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><ellipse cx="12" cy="12" rx="8" ry="10"/><path d="M12 8v8M8 12h8"/><path d="M6 6l12 12M18 6L6 18"/></svg>`,

    lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="20" r="1"/></svg>`,

    open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/><path d="M3 7h18"/></svg>`,

    tare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bimby-icon"><path d="M4 7h16M7 7v8a5 5 0 0010 0V7M7 7h10M8 7l-1 10a2 2 0 002 2h6a2 2 0 002-2l-1-10"/><line x1="12" y1="13" x2="12" y2="17"/></svg>`,
};

/* ============================================================
   DETECTOR — Identify action from step text + tags
   ============================================================ */

const ACTION_KEYWORDS = {
    reverse: [
        /antiorario|reverse|inverse|inverso|back.*ward|senso.*inverso|contro.*orario|anti.*orario|anti-orario/i,
    ],
    simmer: [
        /mijotag|simmer|sobbollir|lento.*bollir|fuoco.*lento|basso.*fuoco|slow.*cook|lentement|a.*fuego.*lento|baja.*temperatura/i,
    ],
    knead: [
        /impast|knead|impastat|working.*dough|lavoro.*impasto|petrin|pétr|pâte|amasij|amass|dough|pasta.*mode/i,
    ],
    lock: [
        /verrouill|lock|bloccag|chiud.*coperchi|lock.*bowl|close.*lid|chiud|fermer|bloquea|asegur/i,
    ],
    open: [
        /apertur|open|aprire|aprir|ausbau|ouvre|open.*lid|remove.*lid|leva|sollevare|saca|destap/i,
    ],
    tare: [
        /tara|zero|azzer|reset.*weight|reset.*scale|peso|bilancia|azerar|poner.*cero|put.*zero/i,
    ],
};

/**
 * Detect which action (if any) the step implies
 * @param {string} stepText - full step text with tags and description
 * @returns {string|null} action name or null if none detected
 */
export function detectBimbyAction(stepText) {
    if (!stepText) return null;

    const text = stepText.toLowerCase();

    for (const [action, patterns] of Object.entries(ACTION_KEYWORDS)) {
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                return action;
            }
        }
    }

    return null;
}

/**
 * Render icon HTML for the detected action
 * @param {string|null} action - action name from detectBimbyAction
 * @returns {string} SVG HTML string or empty string
 */
export function renderBimbyActionIcon(action) {
    if (!action || !(action in BIMBY_ICONS)) return '';
    return `<span class="bimby-action-icon" title="${action}">
    ${BIMBY_ICONS[action]}
  </span>`;
}

/**
 * Combined: detect action and render icon for a step
 * @param {string} stepText - step text to analyze
 * @returns {string} rendered HTML or empty string
 */
export function renderStepActionIcon(stepText) {
    const action = detectBimbyAction(stepText);
    return renderBimbyActionIcon(action);
}
