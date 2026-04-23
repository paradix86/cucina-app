import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { t } from '../lib/i18n.js';
import {
  loadWeeklyPlannerAsync,
  saveWeeklyPlannerAsync,
  StorageWriteError,
} from '../lib/storage';
import { countPlannedMeals, createEmptyWeeklyPlanner } from '../lib/planner';
import { useToasts } from '../composables/useToasts.js';
import type { PlannerDayId, PlannerMealSlot } from '../types';

export const useWeeklyPlannerStore = defineStore('weeklyPlanner', () => {
  const plan = ref(createEmptyWeeklyPlanner());
  const isHydrated = ref(false);
  const { showToast } = useToasts();
  let hydratePromise: Promise<void> | null = null;
  let persistQueue: Promise<void> = Promise.resolve();

  async function hydrate(force = false): Promise<void> {
    if (isHydrated.value && !force) return;
    if (hydratePromise && !force) return hydratePromise;

    hydratePromise = (async () => {
      plan.value = createEmptyWeeklyPlanner();
      Object.assign(plan.value, await loadWeeklyPlannerAsync());
      isHydrated.value = true;
    })().finally(() => {
      hydratePromise = null;
    });

    return hydratePromise;
  }

  function refresh(): Promise<void> {
    return hydrate(true);
  }

  function onWriteError(e: unknown): void {
    if (e instanceof StorageWriteError) {
      showToast(t('toast_storage_write_error'), 'error');
    }
  }

  function persist(nextPlan = plan.value): void {
    const snapshot = {
      ...createEmptyWeeklyPlanner(),
      ...nextPlan,
    };
    persistQueue = persistQueue
      .then(async () => {
        await saveWeeklyPlannerAsync(snapshot);
      })
      .catch(async e => {
        onWriteError(e);
        await hydrate(true);
      });
  }

  function setSlot(day: PlannerDayId, slot: PlannerMealSlot, recipeId: string): boolean {
    plan.value = {
      ...plan.value,
      [day]: {
        ...plan.value[day],
        [slot]: recipeId && recipeId.trim() ? recipeId.trim() : null,
      },
    };
    persist();
    return true;
  }

  function clearSlot(day: PlannerDayId, slot: PlannerMealSlot): boolean {
    plan.value = {
      ...plan.value,
      [day]: {
        ...plan.value[day],
        [slot]: null,
      },
    };
    persist();
    return true;
  }

  function clearDay(day: PlannerDayId): boolean {
    const next = {
      ...plan.value,
      [day]: {
        breakfast: null,
        lunch: null,
        dinner: null,
      },
    };
    plan.value = next;
    persist(next);
    return true;
  }

  function clearAll(): boolean {
    plan.value = createEmptyWeeklyPlanner();
    persist(plan.value);
    return true;
  }

  const plannedMealsCount = computed(() => countPlannedMeals(plan.value));

  return {
    plan,
    isHydrated,
    hydrate,
    refresh,
    setSlot,
    clearSlot,
    clearDay,
    clearAll,
    plannedMealsCount,
  };
});
