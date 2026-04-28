import { ref } from 'vue';
import { defineStore } from 'pinia';
import { loadNutritionGoals, saveNutritionGoals } from '../lib/nutritionGoals';
import type { NutritionGoals } from '../types';

export const useNutritionGoalsStore = defineStore('nutritionGoals', () => {
  const goals = ref<NutritionGoals>(loadNutritionGoals());

  function update(newGoals: NutritionGoals): void {
    goals.value = { ...newGoals };
    saveNutritionGoals(goals.value);
  }

  return { goals, update };
});
