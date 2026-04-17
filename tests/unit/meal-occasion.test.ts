import { describe, it, expect } from 'vitest';
import { suggestMealOccasions, getMealOccasionLabel, MEAL_OCCASION_OPTIONS } from '../../src/lib/recipes.js';

// ─── controlled value set ─────────────────────────────────────────────────────

describe('MEAL_OCCASION_OPTIONS', () => {
  it('contains exactly the four allowed values', () => {
    expect(MEAL_OCCASION_OPTIONS).toEqual([ 'Colazione', 'Pranzo', 'Cena', 'Spuntino' ]);
  });
});

// ─── getMealOccasionLabel ─────────────────────────────────────────────────────

describe('getMealOccasionLabel', () => {
  it('returns a non-empty string for each of the four canonical keys', () => {
    for (const key of MEAL_OCCASION_OPTIONS) {
      const label = getMealOccasionLabel(key);
      expect(label.length, `label for ${key} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('is case-insensitive on the key lookup', () => {
    // Both casings should resolve to the same translation
    expect(getMealOccasionLabel('colazione')).toBe(getMealOccasionLabel('Colazione'));
    expect(getMealOccasionLabel('PRANZO')).toBe(getMealOccasionLabel('Pranzo'));
  });

  it('returns the raw key for unknown values', () => {
    expect(getMealOccasionLabel('Brunch')).toBe('Brunch');
    expect(getMealOccasionLabel('anything')).toBe('anything');
  });
});

// ─── suggestMealOccasions heuristics ─────────────────────────────────────────

describe('suggestMealOccasions', () => {
  it('returns empty array for a recipe with no recognizable keywords', () => {
    const result = suggestMealOccasions({ name: 'Torta di zucca', category: 'Dolci' });
    expect(result).toEqual([]);
  });

  it('suggests Colazione for breakfast keywords in name', () => {
    const result = suggestMealOccasions({ name: 'Pancakes al cioccolato', category: '' });
    expect(result).toContain('Colazione');
  });

  it('suggests Colazione for omelette', () => {
    const result = suggestMealOccasions({ name: 'Omelette alle erbe', category: '' });
    expect(result).toContain('Colazione');
  });

  it('suggests Colazione for yogurt bowl', () => {
    const result = suggestMealOccasions({ name: 'Yogurt bowl con frutti', category: '' });
    expect(result).toContain('Colazione');
  });

  it('suggests Colazione for toast', () => {
    const result = suggestMealOccasions({ name: 'Toast avocado', category: '' });
    expect(result).toContain('Colazione');
  });

  it('suggests Spuntino for snack keyword', () => {
    const result = suggestMealOccasions({ name: 'Energy ball al cocco', category: '' });
    expect(result).toContain('Spuntino');
  });

  it('suggests Spuntino for hummus', () => {
    const result = suggestMealOccasions({ name: 'Hummus di ceci', category: '' });
    expect(result).toContain('Spuntino');
  });

  it('suggests Pranzo for pasta dishes', () => {
    const result = suggestMealOccasions({ name: 'Pasta alla norma', category: 'Primi' });
    expect(result).toContain('Pranzo');
  });

  it('suggests Pranzo for risotto', () => {
    const result = suggestMealOccasions({ name: 'Risotto ai funghi', category: '' });
    expect(result).toContain('Pranzo');
  });

  it('suggests Pranzo for insalata', () => {
    const result = suggestMealOccasions({ name: 'Insalata di pollo', category: '' });
    expect(result).toContain('Pranzo');
  });

  it('suggests Cena for chicken dish', () => {
    const result = suggestMealOccasions({ name: 'Pollo arrosto', category: 'Secondi' });
    expect(result).toContain('Cena');
  });

  it('suggests Cena for salmon', () => {
    const result = suggestMealOccasions({ name: 'Salmone al forno', category: '' });
    expect(result).toContain('Cena');
  });

  it('can suggest multiple occasions for the same recipe', () => {
    // "insalata di pollo" matches both Pranzo (insalata) and Cena (pollo)
    const result = suggestMealOccasions({ name: 'Insalata di pollo', category: '' });
    expect(result).toContain('Pranzo');
    expect(result).toContain('Cena');
  });

  it('suggests via category when name has no keywords', () => {
    const result = suggestMealOccasions({ name: 'Ricetta speciale', category: 'pasta' });
    expect(result).toContain('Pranzo');
  });

  it('returns only valid MEAL_OCCASION_OPTIONS values', () => {
    const result = suggestMealOccasions({ name: 'Pancakes pollo pasta risotto energy', category: '' });
    result.forEach(v => expect(MEAL_OCCASION_OPTIONS).toContain(v));
  });

  it('never duplicates suggestions', () => {
    const result = suggestMealOccasions({ name: 'pasta pasta pasta', category: 'pasta' });
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('handles missing name and category gracefully', () => {
    expect(() => suggestMealOccasions({})).not.toThrow();
    expect(suggestMealOccasions({})).toEqual([]);
  });

  it('handles null/undefined fields gracefully', () => {
    expect(() => suggestMealOccasions({ name: null, category: undefined })).not.toThrow();
  });
});

// ─── filtering logic ─────────────────────────────────────────────────────────

describe('meal occasion filtering logic', () => {
  const recipes = [
    { id: '1', name: 'Pancakes', mealOccasion: [ 'Colazione' ] },
    { id: '2', name: 'Pasta carbonara', mealOccasion: [ 'Pranzo', 'Cena' ] },
    { id: '3', name: 'Bistecca', mealOccasion: [ 'Cena' ] },
    { id: '4', name: 'Tiramisù', mealOccasion: undefined },
  ];

  function filterByMeal(filter: string) {
    return recipes.filter(r =>
      filter === 'all' || (r.mealOccasion || []).includes(filter),
    );
  }

  it('"all" returns every recipe', () => {
    expect(filterByMeal('all')).toHaveLength(4);
  });

  it('Colazione returns only breakfast recipes', () => {
    const result = filterByMeal('Colazione');
    expect(result.map(r => r.id)).toEqual([ '1' ]);
  });

  it('Cena returns recipes tagged for dinner', () => {
    const result = filterByMeal('Cena');
    expect(result.map(r => r.id)).toContain('2');
    expect(result.map(r => r.id)).toContain('3');
  });

  it('recipes without mealOccasion are excluded from specific filters', () => {
    const result = filterByMeal('Pranzo');
    expect(result.map(r => r.id)).not.toContain('4');
  });

  it('Spuntino returns empty when no snack recipes exist', () => {
    expect(filterByMeal('Spuntino')).toHaveLength(0);
  });
});
