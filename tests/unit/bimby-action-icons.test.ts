import { describe, it, expect } from 'vitest';
import { detectBimbyAction, renderBimbyActionIcon } from '../../src/lib/bimbyIcons.js';
import { buildStepsHtml } from '../../src/lib/recipes.js';

describe('Bimby action detection', () => {
    it('should detect reverse actions from Bimby step text', () => {
        expect(detectBimbyAction('Temp. 100° · Vel. 1 · 5 min — Cuoci in senso antiorario')).toBe('reverse');
        expect(detectBimbyAction('Vel. 1 · 10 min — Mescola in senso inverse')).toBe('reverse');
    });

    it('should detect knead-related instructions conservatively', () => {
        expect(detectBimbyAction('Vel. 4 · 20 sec — Impastare bene il composto')).toBe('knead');
        expect(detectBimbyAction('Vel. 4 · 20 sec — Impastare delicatamente')).toBe('knead');
    });

    it('should detect tare actions from weight-related steps', () => {
        expect(detectBimbyAction('Vel. 1 · 5 sec — Azzera il peso prima di aggiungere gli ingredienti')).toBe('tare');
        expect(detectBimbyAction('Vel. 1 · 5 sec — Metti nel boccale e azzera la bilancia')).toBe('tare');
    });

    it('should return null for non-action text', () => {
        expect(detectBimbyAction('Temp. 100° · Vel. 1 · 5 min — Aggiungi cipolla e cuoci.')).toBeNull();
    });
});

describe('Bimby action icon rendering', () => {
    it('should render an icon wrapper for a detected action', () => {
        const html = renderBimbyActionIcon('simmer');
        expect(html).toContain('bimby-action-icon');
        expect(html).toContain('<svg');
    });

    it('should not render an icon for unknown actions', () => {
        expect(renderBimbyActionIcon(null)).toBe('');
        expect(renderBimbyActionIcon('unknown')).toBe('');
    });

    it('should include action icon HTML in built Bimby steps', () => {
        const html = buildStepsHtml([
            'Temp. 100° · Vel. 1 · 5 min — Cuoci in senso antiorario',
        ], 'bimby');
        expect(html).toContain('bimby-action-icon');
        expect(html).toContain('Cuoci in senso antiorario');
    });
});
