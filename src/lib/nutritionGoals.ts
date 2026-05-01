import type { NutritionGoals, NutritionPer100g } from '../types';
import { NUTRITION_GOALS_KEY } from './storageKeys';

export { NUTRITION_GOALS_KEY };

export function loadNutritionGoals(): NutritionGoals {
  try {
    const raw = localStorage.getItem(NUTRITION_GOALS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as NutritionGoals;
  } catch {
    return {};
  }
}

export function saveNutritionGoals(goals: NutritionGoals): void {
  try {
    localStorage.setItem(NUTRITION_GOALS_KEY, JSON.stringify(goals));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function parseGoalInput(input: string): number | undefined {
  const normalized = input.trim().replace(',', '.');
  if (!normalized) return undefined;
  const val = parseFloat(normalized);
  if (!isFinite(val) || val <= 0) return undefined;
  return val;
}

export function calcGoalPct(value: number | undefined, goal: number | undefined): number | null {
  if (value === undefined || goal === undefined || goal <= 0) return null;
  return Math.round((value / goal) * 100);
}

export type GoalComparisonItem = {
  key: string;
  labelKey: string;
  value: number;
  unit: string;
  pct: number;
};

export function buildGoalComparison(
  nutrition: NutritionPer100g | undefined,
  goals: NutritionGoals,
): GoalComparisonItem[] {
  if (!nutrition) return [];

  const candidates: Array<{
    key: keyof NutritionGoals;
    nutritionKey: keyof NutritionPer100g;
    labelKey: string;
    unit: string;
  }> = [
    { key: 'kcal', nutritionKey: 'kcal', labelKey: 'nutrition_goals_kcal_label', unit: 'kcal' },
    { key: 'proteinG', nutritionKey: 'proteinG', labelKey: 'nutrition_goals_protein_label', unit: 'g' },
    { key: 'carbsG', nutritionKey: 'carbsG', labelKey: 'nutrition_goals_carbs_label', unit: 'g' },
    { key: 'fatG', nutritionKey: 'fatG', labelKey: 'nutrition_goals_fat_label', unit: 'g' },
    { key: 'fiberG', nutritionKey: 'fiberG', labelKey: 'nutrition_goals_fiber_label', unit: 'g' },
  ];

  const result: GoalComparisonItem[] = [];

  for (const c of candidates) {
    const goal = goals[c.key];
    const value = nutrition[c.nutritionKey] as number | undefined;
    if (goal === undefined || value === undefined) continue;
    const pct = calcGoalPct(value, goal);
    if (pct === null) continue;
    result.push({ key: c.key, labelKey: c.labelKey, value, unit: c.unit, pct });
  }

  return result;
}
