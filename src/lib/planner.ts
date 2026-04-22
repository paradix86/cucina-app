import type { PlannerDayId, PlannerMealSlot, WeeklyPlanner } from '../types';

export const PLANNER_DAYS: PlannerDayId[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const PLANNER_MEAL_SLOTS: PlannerMealSlot[] = [
  'breakfast',
  'lunch',
  'dinner',
];

export function createEmptyWeeklyPlanner(): WeeklyPlanner {
  return PLANNER_DAYS.reduce((days, day) => {
    days[day] = PLANNER_MEAL_SLOTS.reduce((slots, slot) => {
      slots[slot] = null;
      return slots;
    }, {} as WeeklyPlanner[PlannerDayId]);
    return days;
  }, {} as WeeklyPlanner);
}

export function normalizeWeeklyPlanner(value: unknown): WeeklyPlanner {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const normalized = createEmptyWeeklyPlanner();

  PLANNER_DAYS.forEach(day => {
    const dayValue = source[day];
    const dayRecord = dayValue && typeof dayValue === 'object' ? dayValue as Record<string, unknown> : {};

    PLANNER_MEAL_SLOTS.forEach(slot => {
      const slotValue = dayRecord[slot];
      normalized[day][slot] = typeof slotValue === 'string' && slotValue.trim()
        ? slotValue.trim()
        : null;
    });
  });

  return normalized;
}

export function countPlannedMeals(plan: WeeklyPlanner): number {
  return PLANNER_DAYS.reduce((count, day) => {
    return count + PLANNER_MEAL_SLOTS.filter(slot => Boolean(plan[day]?.[slot])).length;
  }, 0);
}
