import { describe, it, expect } from 'vitest';
import { DUEMME_VETTED_RECIPE_PACK } from '../../src/lib/duemmeVettedPack.js';

describe('duemme vetted subset pack', () => {
    it('loads the vetted Duemme recipe subset', () => {
        expect(Array.isArray(DUEMME_VETTED_RECIPE_PACK)).toBe(true);
        expect(DUEMME_VETTED_RECIPE_PACK.length).toBeGreaterThan(0);
    });

    it('preserves source identity for Duemme subset recipes', () => {
        expect(DUEMME_VETTED_RECIPE_PACK.every(recipe => recipe.sourceDomain === 'github.com')).toBe(true);
        expect(DUEMME_VETTED_RECIPE_PACK.every(recipe => recipe.source === 'web')).toBe(true);
    });

    it('contains recipes with complete required metadata', () => {
        DUEMME_VETTED_RECIPE_PACK.forEach(recipe => {
            expect(recipe.id).toBeTruthy();
            expect(recipe.id).toMatch(/^duemme-/);
            expect(recipe.name).toBeTruthy();
            expect(recipe.name.length).toBeGreaterThan(2);
            expect(Array.isArray(recipe.ingredients)).toBe(true);
            expect(recipe.ingredients.length).toBeGreaterThan(0);
            expect(Array.isArray(recipe.steps)).toBe(true);
            expect(recipe.steps.length).toBeGreaterThan(0);
        });
    });

    it('includes meal occasion metadata for filtering/display', () => {
        DUEMME_VETTED_RECIPE_PACK.forEach(recipe => {
            expect(Array.isArray(recipe.mealOccasion)).toBe(true);
            if (recipe.mealOccasion && recipe.mealOccasion.length > 0) {
                const valid = [ 'Colazione', 'Pranzo', 'Cena', 'Spuntino' ];
                recipe.mealOccasion.forEach(occasion => {
                    expect(valid).toContain(occasion);
                });
            }
        });
    });

    it('marks preparation type and bimby flag consistently', () => {
        DUEMME_VETTED_RECIPE_PACK.forEach(recipe => {
            expect([ 'classic', 'bimby', 'airfryer' ]).toContain(recipe.preparationType);
            expect(typeof recipe.bimby).toBe('boolean');
            if (recipe.preparationType === 'bimby') {
                expect(recipe.bimby).toBe(true);
            } else {
                expect(recipe.bimby).toBe(false);
            }
        });
    });

    it('includes cooking metadata for display and timer', () => {
        DUEMME_VETTED_RECIPE_PACK.forEach(recipe => {
            if (recipe.timerMinutes) {
                expect(typeof recipe.timerMinutes).toBe('number');
                expect(recipe.timerMinutes).toBeGreaterThan(0);
            }
            if (recipe.time) {
                expect(typeof recipe.time).toBe('string');
            }
            if (recipe.servings) {
                expect(typeof recipe.servings).toBe('string');
            }
        });
    });

    it('includes tags for content organization', () => {
        DUEMME_VETTED_RECIPE_PACK.forEach(recipe => {
            expect(Array.isArray(recipe.tags)).toBe(true);
            expect(recipe.tags.length).toBeGreaterThan(0);
            expect(recipe.tags).toContain('Piano Alimentare');
            expect(recipe.tags).toContain('duemme/piano_alimentare');
        });
    });

    it('provides unique recipe IDs across the subset', () => {
        const ids = DUEMME_VETTED_RECIPE_PACK.map(r => r.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('maintains emoji and category for UI display', () => {
        DUEMME_VETTED_RECIPE_PACK.forEach(recipe => {
            expect(recipe.emoji).toBeTruthy();
            expect(recipe.category).toBeTruthy();
        });
    });
});
