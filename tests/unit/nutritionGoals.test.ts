import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal localStorage stub for the node test environment
function makeLocalStorageStub() {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}
const localStorageStub = makeLocalStorageStub();
vi.stubGlobal('localStorage', localStorageStub);
import {
  parseGoalInput,
  calcGoalPct,
  buildGoalComparison,
  loadNutritionGoals,
  saveNutritionGoals,
  NUTRITION_GOALS_KEY,
} from '../../src/lib/nutritionGoals';

describe('parseGoalInput', () => {
  it('parses a plain integer string', () => {
    expect(parseGoalInput('2000')).toBe(2000);
  });

  it('parses a decimal with dot', () => {
    expect(parseGoalInput('55.5')).toBe(55.5);
  });

  it('parses a decimal with comma', () => {
    expect(parseGoalInput('55,5')).toBe(55.5);
  });

  it('returns undefined for empty string', () => {
    expect(parseGoalInput('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(parseGoalInput('   ')).toBeUndefined();
  });

  it('returns undefined for zero', () => {
    expect(parseGoalInput('0')).toBeUndefined();
  });

  it('returns undefined for negative', () => {
    expect(parseGoalInput('-10')).toBeUndefined();
  });

  it('returns undefined for non-numeric text', () => {
    expect(parseGoalInput('abc')).toBeUndefined();
  });

  it('trims whitespace before parsing', () => {
    expect(parseGoalInput('  150  ')).toBe(150);
  });
});

describe('calcGoalPct', () => {
  it('returns null when value is undefined', () => {
    expect(calcGoalPct(undefined, 2000)).toBeNull();
  });

  it('returns null when goal is undefined', () => {
    expect(calcGoalPct(500, undefined)).toBeNull();
  });

  it('returns null when goal is zero', () => {
    expect(calcGoalPct(500, 0)).toBeNull();
  });

  it('calculates 50% correctly', () => {
    expect(calcGoalPct(1000, 2000)).toBe(50);
  });

  it('calculates 100% exactly', () => {
    expect(calcGoalPct(2000, 2000)).toBe(100);
  });

  it('calculates over 100% when value exceeds goal', () => {
    expect(calcGoalPct(2500, 2000)).toBe(125);
  });

  it('rounds fractional percentages', () => {
    expect(calcGoalPct(1, 3)).toBe(33);
  });
});

describe('buildGoalComparison', () => {
  it('returns empty array when nutrition is undefined', () => {
    expect(buildGoalComparison(undefined, { kcal: 2000 })).toEqual([]);
  });

  it('returns empty array when no matching goal keys', () => {
    expect(buildGoalComparison({ kcal: 500 }, {})).toEqual([]);
  });

  it('returns only macros that have both a value and a goal', () => {
    const result = buildGoalComparison(
      { kcal: 600, proteinG: 30 },
      { kcal: 2000, proteinG: 150 },
    );
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('kcal');
    expect(result[0].pct).toBe(30);
    expect(result[1].key).toBe('proteinG');
    expect(result[1].pct).toBe(20);
  });

  it('skips macros where nutrition value is missing', () => {
    const result = buildGoalComparison(
      { kcal: 600 },
      { kcal: 2000, proteinG: 150 },
    );
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('kcal');
  });

  it('reports over-100% pct without capping', () => {
    const result = buildGoalComparison(
      { kcal: 2500 },
      { kcal: 2000 },
    );
    expect(result[0].pct).toBe(125);
  });
});

describe('loadNutritionGoals / saveNutritionGoals', () => {
  beforeEach(() => {
    localStorageStub.clear();
  });

  it('returns empty object when nothing stored', () => {
    expect(loadNutritionGoals()).toEqual({});
  });

  it('round-trips goals through localStorage', () => {
    const goals = { kcal: 2000, proteinG: 150 };
    saveNutritionGoals(goals);
    expect(loadNutritionGoals()).toEqual(goals);
  });

  it('returns empty object when stored value is invalid JSON', () => {
    localStorage.setItem(NUTRITION_GOALS_KEY, 'not-json');
    expect(loadNutritionGoals()).toEqual({});
  });

  it('returns empty object when stored value is not an object', () => {
    localStorage.setItem(NUTRITION_GOALS_KEY, '"a string"');
    expect(loadNutritionGoals()).toEqual({});
  });
});
