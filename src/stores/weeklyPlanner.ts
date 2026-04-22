import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { t } from '../lib/i18n.js';
import {
  clearWeeklyPlanner,
  loadWeeklyPlanner,
  saveWeeklyPlanner,
  StorageWriteError,
  updateWeeklyPlannerSlot,
} from '../lib/storage';
import { countPlannedMeals, createEmptyWeeklyPlanner } from '../lib/planner';
import { useToasts } from '../composables/useToasts.js';
import type { PlannerDayId, PlannerMealSlot } from '../types';

export const useWeeklyPlannerStore = defineStore('weeklyPlanner', () => {
  const plan = ref(loadWeeklyPlanner());
  const { showToast } = useToasts();

  function refresh(): void {
    plan.value = loadWeeklyPlanner();
  }

  function onWriteError(e: unknown): void {
    if (e instanceof StorageWriteError) {
      showToast(t('toast_storage_write_error'), 'error');
    }
  }

  function setSlot(day: PlannerDayId, slot: PlannerMealSlot, recipeId: string): boolean {
    try {
      plan.value = updateWeeklyPlannerSlot(day, slot, recipeId);
      return true;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  function clearSlot(day: PlannerDayId, slot: PlannerMealSlot): boolean {
    try {
      plan.value = updateWeeklyPlannerSlot(day, slot, null);
      return true;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  function clearDay(day: PlannerDayId): boolean {
    try {
      const next = {
        ...plan.value,
        [day]: {
          breakfast: null,
          lunch: null,
          dinner: null,
        },
      };
      saveWeeklyPlanner(next);
      plan.value = next;
      return true;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  function clearAll(): boolean {
    try {
      clearWeeklyPlanner();
      plan.value = createEmptyWeeklyPlanner();
      return true;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  const plannedMealsCount = computed(() => countPlannedMeals(plan.value));

  return {
    plan,
    refresh,
    setSlot,
    clearSlot,
    clearDay,
    clearAll,
    plannedMealsCount,
  };
});
