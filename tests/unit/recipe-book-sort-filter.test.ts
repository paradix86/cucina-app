import { describe, expect, it } from 'vitest';
import { parseRecipeTime } from '../../src/lib/recipes';
import type { Recipe } from '../../src/types';

type MinRecipe = Pick<Recipe, 'id' | 'name'> & { time?: string; tags?: string[]; lastViewedAt?: number };

function sortRecipes(list: MinRecipe[], sortBy: string): MinRecipe[] {
  const copy = [...list];
  if (sortBy === 'alpha') {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'time') {
    copy.sort((a, b) => parseRecipeTime(a.time) - parseRecipeTime(b.time));
  } else if (sortBy === 'recent') {
    copy.sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0));
  }
  return copy;
}

function filterByTags(list: MinRecipe[], selectedTags: string[]): MinRecipe[] {
  if (selectedTags.length === 0) return list;
  return list.filter(r => selectedTags.some(tag => (r.tags || []).includes(tag)));
}

const RECIPES: MinRecipe[] = [
  { id: 'r1', name: 'Zuppa di cipolle', time: '1h 15min', tags: ['zuppe', 'vegetariano'], lastViewedAt: 1000 },
  { id: 'r2', name: 'Amatriciana',       time: '30min',    tags: ['pasta'],                lastViewedAt: 3000 },
  { id: 'r3', name: 'Melanzane al forno', time: '45min',   tags: ['vegetariano'],          lastViewedAt: 2000 },
  { id: 'r4', name: 'Bistecca',           time: '10min',   tags: ['carne'],                lastViewedAt: 4000 },
];

describe('parseRecipeTime', () => {
  it('parses hours and minutes', () => {
    expect(parseRecipeTime('1h 15min')).toBe(75);
  });

  it('parses minutes only', () => {
    expect(parseRecipeTime('30min')).toBe(30);
  });

  it('parses hours only', () => {
    expect(parseRecipeTime('2h')).toBe(120);
  });

  it('returns 0 for empty or null', () => {
    expect(parseRecipeTime(null)).toBe(0);
    expect(parseRecipeTime('')).toBe(0);
    expect(parseRecipeTime(undefined)).toBe(0);
  });
});

describe('recipe book — sorting', () => {
  it('sorts alphabetically', () => {
    const sorted = sortRecipes(RECIPES, 'alpha');
    expect(sorted.map(r => r.name)).toEqual([
      'Amatriciana',
      'Bistecca',
      'Melanzane al forno',
      'Zuppa di cipolle',
    ]);
  });

  it('sorts by cooking time ascending', () => {
    const sorted = sortRecipes(RECIPES, 'time');
    expect(sorted.map(r => r.id)).toEqual(['r4', 'r2', 'r3', 'r1']);
  });

  it('sorts by recently viewed descending', () => {
    const sorted = sortRecipes(RECIPES, 'recent');
    expect(sorted.map(r => r.id)).toEqual(['r4', 'r2', 'r3', 'r1']);
  });

  it('preserves original order when sortBy is none', () => {
    const sorted = sortRecipes(RECIPES, 'none');
    expect(sorted.map(r => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
  });
});

describe('recipe book — tag filter', () => {
  it('returns all recipes when no tags selected', () => {
    expect(filterByTags(RECIPES, [])).toHaveLength(4);
  });

  it('filters by a single tag', () => {
    const result = filterByTags(RECIPES, ['pasta']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r2');
  });

  it('uses OR logic across multiple tags', () => {
    const result = filterByTags(RECIPES, ['pasta', 'carne']);
    expect(result.map(r => r.id).sort()).toEqual(['r2', 'r4']);
  });

  it('matches recipes that share a tag', () => {
    const result = filterByTags(RECIPES, ['vegetariano']);
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r3']);
  });

  it('excludes recipes without any selected tag', () => {
    const result = filterByTags(RECIPES, ['zuppe']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });
});
