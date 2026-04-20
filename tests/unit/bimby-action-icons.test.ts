import { describe, it, expect } from 'vitest';
import {
  detectBimbyAction,
  renderBimbyActionIcon,
  BIMBY_ICONS,
  APPROVED_BIMBY_ACTION_KEYS,
  BIMBY_ACTION_PATTERNS,
} from '../../src/lib/bimbyIcons.js';
import { buildStepsHtml } from '../../src/lib/recipes.js';

const APPROVED_ACTIONS = ['reverse', 'knead', 'scissors', 'cup', 'open', 'lock'] as const;

// ─── Approved action set ─────────────────────────────────────────────────────

describe('detectBimbyAction — approved set', () => {
  it('reverse: matches antiorario and senso antiorario', () => {
    expect(detectBimbyAction('Temp. 100° · Vel. 1 · 5 min — Cuoci in senso antiorario')).toBe('reverse');
    expect(detectBimbyAction('Vel. 1 · 15 min — Cuocere antiorario')).toBe('reverse');
    expect(detectBimbyAction('counterclockwise at speed 1')).toBe('reverse');
  });

  it('knead: matches impast* and spiga', () => {
    expect(detectBimbyAction('Vel. 4 · 20 sec — Impastare bene il composto')).toBe('knead');
    expect(detectBimbyAction('Vel. 4 · 40 sec — Impasto pane')).toBe('knead');
    expect(detectBimbyAction('Knead for 2 minutes')).toBe('knead');
    expect(detectBimbyAction('Funzione spiga per 3 min')).toBe('knead');
  });

  it('scissors: matches forbici and scissor', () => {
    expect(detectBimbyAction('Tritare con funzione forbici')).toBe('scissors');
    expect(detectBimbyAction('Use scissors function 3 times')).toBe('scissors');
  });

  it('cup: matches misurino explicitly', () => {
    expect(detectBimbyAction('Cuocere senza misurino')).toBe('cup');
    expect(detectBimbyAction('Inserire il misurino prima di avviare')).toBe('cup');
    expect(detectBimbyAction('Cook with measuring cup in place')).toBe('cup');
  });

  it('open: matches coperchio-specific phrases only', () => {
    expect(detectBimbyAction('Aprire il coperchio e assaggiare')).toBe('open');
    expect(detectBimbyAction('Rimuovere il coperchio')).toBe('open');
    expect(detectBimbyAction('Togliere il coperchio con attenzione')).toBe('open');
    expect(detectBimbyAction('Open the lid carefully')).toBe('open');
  });

  it('lock: matches coperchio-close phrases only', () => {
    expect(detectBimbyAction('Chiudi il coperchio e avvia')).toBe('lock');
    expect(detectBimbyAction('Coperchio chiuso per la cottura')).toBe('lock');
    expect(detectBimbyAction('Close the lid before starting')).toBe('lock');
  });
});

// ─── Strict rejection — no false positives ───────────────────────────────────

describe('detectBimbyAction — strict rejection', () => {
  it('returns null for generic cooking instructions without action markers', () => {
    expect(detectBimbyAction('Temp. 100° · Vel. 1 · 5 min — Aggiungi cipolla e cuoci')).toBeNull();
    expect(detectBimbyAction('Servire su riso con yogurt')).toBeNull();
    expect(detectBimbyAction('Assaggiare e aggiustare di sale')).toBeNull();
  });

  it('does not trigger open for generic "aprire" without coperchio', () => {
    expect(detectBimbyAction('Aprire il boccale velocemente')).toBeNull();
    expect(detectBimbyAction('Open the jar')).toBeNull();
  });

  it('does not trigger lock for generic "chiudere" without coperchio', () => {
    expect(detectBimbyAction('Chiudere bene il sacchetto')).toBeNull();
    expect(detectBimbyAction('Close the container')).toBeNull();
  });

  it('does not trigger reverse for generic "inverse" or "backward"', () => {
    expect(detectBimbyAction('Inverse the mixture slowly')).toBeNull();
    expect(detectBimbyAction('Backward motion applied')).toBeNull();
  });

  it('returns null for formerly-supported but now-removed actions (simmer, tare)', () => {
    expect(detectBimbyAction('Sobbollire a fuoco lento')).toBeNull();
    expect(detectBimbyAction('Azzera il peso prima di aggiungere')).toBeNull();
    expect(detectBimbyAction('Reset the bilancia')).toBeNull();
  });
});

// ─── Icon rendering ───────────────────────────────────────────────────────────

describe('renderBimbyActionIcon', () => {
  it('renders SVG wrapper for each approved action', () => {
    for (const action of APPROVED_ACTIONS) {
      const html = renderBimbyActionIcon(action);
      expect(html, `expected icon for ${action}`).toContain('bimby-action-icon');
      expect(html, `expected SVG for ${action}`).toContain('<svg');
    }
  });

  it('renders nothing for removed actions (simmer, tare)', () => {
    expect(renderBimbyActionIcon('simmer')).toBe('');
    expect(renderBimbyActionIcon('tare')).toBe('');
  });

  it('renders nothing for null or unknown actions', () => {
    expect(renderBimbyActionIcon(null)).toBe('');
    expect(renderBimbyActionIcon('unknown')).toBe('');
    expect(renderBimbyActionIcon('')).toBe('');
  });
});

// ─── BIMBY_ICONS export — closed set ─────────────────────────────────────────

describe('BIMBY_ICONS closed set', () => {
  it('approved action source-of-truth is frozen and exact', () => {
    expect([ ...APPROVED_BIMBY_ACTION_KEYS ].sort()).toEqual([ ...APPROVED_ACTIONS ].sort());
    expect(Object.isFrozen(APPROVED_BIMBY_ACTION_KEYS)).toBe(true);
  });

  it('contains only the six approved action keys', () => {
    const keys = Object.keys(BIMBY_ICONS).sort();
    expect(keys).toEqual([ ...APPROVED_ACTIONS ].sort());
  });

  it('pattern map contains only the six approved action keys', () => {
    const keys = Object.keys(BIMBY_ACTION_PATTERNS).sort();
    expect(keys).toEqual([ ...APPROVED_ACTIONS ].sort());
  });

  it('does not contain removed actions', () => {
    expect('simmer' in BIMBY_ICONS).toBe(false);
    expect('tare' in BIMBY_ICONS).toBe(false);
  });
});

// ─── buildStepsHtml — detail view consistency ─────────────────────────────────

describe('buildStepsHtml — icon consistency', () => {
  it('includes action icon HTML in Bimby steps that have an approved action', () => {
    const html = buildStepsHtml(
      ['Temp. 100° · Vel. 1 · 5 min — Cuoci in senso antiorario'],
      'bimby',
    );
    expect(html).toContain('bimby-action-icon');
    expect(html).toContain('Cuoci in senso antiorario');
  });

  it('does not include an icon for Bimby steps with no approved action', () => {
    const html = buildStepsHtml(
      ['Vel. 5 · 3 sec — Inserire cipolla e aglio'],
      'bimby',
    );
    expect(html).not.toContain('bimby-action-icon');
    expect(html).toContain('Inserire cipolla e aglio');
  });

  it('includes knead icon for impasto steps', () => {
    const html = buildStepsHtml(
      ['Vel. 4 · 30 sec — Impastare fino a ottenere composto omogeneo'],
      'bimby',
    );
    expect(html).toContain('bimby-action-icon');
  });

  it('does not show icons for formerly-supported simmer or tare steps', () => {
    const htmlSimmer = buildStepsHtml(['Vel. 1 · 10 min — Sobbollire lentamente'], 'bimby');
    const htmlTare = buildStepsHtml(['Azzera il peso della bilancia'], 'bimby');
    expect(htmlSimmer).not.toContain('bimby-action-icon');
    expect(htmlTare).not.toContain('bimby-action-icon');
  });

  it('never emits a non-approved action key', () => {
    const detected = [
      detectBimbyAction('Cuoci in senso antiorario'),
      detectBimbyAction('Impastare per 2 min'),
      detectBimbyAction('Tritare con funzione forbici'),
      detectBimbyAction('Inserire il misurino'),
      detectBimbyAction('Aprire il coperchio'),
      detectBimbyAction('Chiudi il coperchio'),
      detectBimbyAction('Sobbollire lentamente'),
      detectBimbyAction('Azzera il peso'),
      detectBimbyAction('Istruzione generica senza marker'),
    ].filter(Boolean) as string[];

    expect(detected.every(action => APPROVED_BIMBY_ACTION_KEYS.includes(action))).toBe(true);
  });
});
