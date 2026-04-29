import { describe, it, expect } from 'vitest';
import {
  createEmptyWeeklyPlanner,
  normalizeWeeklyPlanner,
  countPlannedMeals,
} from '../../src/lib/planner';

describe('createEmptyWeeklyPlanner', () => {
  it('returns a structure with 7 days × 3 meal slots, all null', () => {
    const plan = createEmptyWeeklyPlanner();
    expect(plan).toBeDefined();
    expect(Object.keys(plan)).toHaveLength(7);
    const dayKeys = [ 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ];
    dayKeys.forEach(day => {
      expect(plan[ day as any ]).toBeDefined();
      expect(Object.keys(plan[ day as any ])).toEqual([ 'breakfast', 'lunch', 'dinner' ]);
      expect(plan[ day as any ].breakfast).toBe(null);
      expect(plan[ day as any ].lunch).toBe(null);
      expect(plan[ day as any ].dinner).toBe(null);
    });
  });
});

describe('normalizeWeeklyPlanner', () => {
  it('normalizes valid input with recipe IDs', () => {
    const input = {
      monday: { breakfast: 'recipe-1', lunch: 'recipe-2', dinner: null },
      tuesday: { breakfast: null, lunch: null, dinner: 'recipe-3' },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: null },
    };

    const result = normalizeWeeklyPlanner(input);
    expect(result.monday.breakfast).toBe('recipe-1');
    expect(result.monday.lunch).toBe('recipe-2');
    expect(result.monday.dinner).toBeNull();
    expect(result.tuesday.dinner).toBe('recipe-3');
  });

  it('trims whitespace from recipe IDs', () => {
    const input = {
      monday: { breakfast: '  recipe-1  ', lunch: null, dinner: null },
      tuesday: { breakfast: null, lunch: null, dinner: null },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: null },
    };

    const result = normalizeWeeklyPlanner(input);
    expect(result.monday.breakfast).toBe('recipe-1');
  });

  it('converts empty strings to null', () => {
    const input = {
      monday: { breakfast: '', lunch: '  ', dinner: null },
      tuesday: { breakfast: null, lunch: null, dinner: null },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: null },
    };

    const result = normalizeWeeklyPlanner(input);
    expect(result.monday.breakfast).toBeNull();
    expect(result.monday.lunch).toBeNull();
  });

  it('normalizes malformed input (null/undefined) to empty planner', () => {
    expect(normalizeWeeklyPlanner(null)).toEqual(createEmptyWeeklyPlanner());
    expect(normalizeWeeklyPlanner(undefined)).toEqual(createEmptyWeeklyPlanner());
    expect(normalizeWeeklyPlanner({})).toEqual(createEmptyWeeklyPlanner());
  });

  it('ignores unknown day or slot keys', () => {
    const input = {
      monday: { breakfast: 'recipe-1', lunch: null, dinner: null, unknown: 'should-be-ignored' },
      tuesday: { breakfast: null, lunch: null, dinner: null },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: null },
      unknownDay: { breakfast: 'recipe-2' },
    };

    const result = normalizeWeeklyPlanner(input);
    expect(result.monday.breakfast).toBe('recipe-1');
    expect(Object.keys(result)).toEqual([ 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' ]);
    expect('unknownDay' in result).toBe(false);
  });

  it('preserves non-string values by treating them as null', () => {
    const input = {
      monday: { breakfast: 123 as any, lunch: true as any, dinner: null },
      tuesday: { breakfast: null, lunch: null, dinner: null },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: null },
    };

    const result = normalizeWeeklyPlanner(input);
    expect(result.monday.breakfast).toBeNull();
    expect(result.monday.lunch).toBeNull();
  });

  it('is idempotent: normalizing twice produces same result', () => {
    const input = {
      monday: { breakfast: '  recipe-1  ', lunch: null, dinner: '' },
      tuesday: { breakfast: null, lunch: null, dinner: null },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: null },
    };

    const first = normalizeWeeklyPlanner(input);
    const second = normalizeWeeklyPlanner(first);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('countPlannedMeals', () => {
  it('counts non-null slots across all days', () => {
    const plan = {
      monday: { breakfast: 'recipe-1', lunch: 'recipe-2', dinner: null },
      tuesday: { breakfast: null, lunch: 'recipe-3', dinner: null },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: 'recipe-4' },
    };

    expect(countPlannedMeals(plan)).toBe(4);
  });

  it('returns 0 for empty planner', () => {
    const plan = createEmptyWeeklyPlanner();
    expect(countPlannedMeals(plan)).toBe(0);
  });

  it('returns 21 for fully packed planner', () => {
    const plan = {
      monday: { breakfast: 'r1', lunch: 'r2', dinner: 'r3' },
      tuesday: { breakfast: 'r4', lunch: 'r5', dinner: 'r6' },
      wednesday: { breakfast: 'r7', lunch: 'r8', dinner: 'r9' },
      thursday: { breakfast: 'r10', lunch: 'r11', dinner: 'r12' },
      friday: { breakfast: 'r13', lunch: 'r14', dinner: 'r15' },
      saturday: { breakfast: 'r16', lunch: 'r17', dinner: 'r18' },
      sunday: { breakfast: 'r19', lunch: 'r20', dinner: 'r21' },
    };

    expect(countPlannedMeals(plan)).toBe(21);
  });

  it('counts only non-null values', () => {
    const plan = {
      monday: { breakfast: 'recipe-1', lunch: null, dinner: 'recipe-2' },
      tuesday: { breakfast: null, lunch: null, dinner: null },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: null },
    };

    expect(countPlannedMeals(plan)).toBe(2);
  });

  it('ignores empty string values (treats them as null)', () => {
    const plan = {
      monday: { breakfast: '', lunch: 'recipe-1', dinner: null },
      tuesday: { breakfast: null, lunch: null, dinner: null },
      wednesday: { breakfast: null, lunch: null, dinner: null },
      thursday: { breakfast: null, lunch: null, dinner: null },
      friday: { breakfast: null, lunch: null, dinner: null },
      saturday: { breakfast: null, lunch: null, dinner: null },
      sunday: { breakfast: null, lunch: null, dinner: null },
    };

    // Empty strings are falsy, so only 'recipe-1' counts
    expect(countPlannedMeals(plan)).toBe(1);
  });
});
