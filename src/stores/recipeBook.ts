import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  addRecipe,
  deleteRecipe,
  exportRecipeBook,
  importRecipeBook,
  loadRecipeBook,
  markRecipeViewed,
  toggleRecipeFavorite,
  updateRecipeNotes,
} from '../lib/storage';
import type { Recipe } from '../types';

export const useRecipeBookStore = defineStore('recipeBook', () => {
  const recipes = ref<Recipe[]>(loadRecipeBook());

  function refresh(): void {
    recipes.value = loadRecipeBook();
  }

  function add(recipe: Recipe): boolean {
    const ok = addRecipe(recipe);
    refresh();
    return ok;
  }

  function remove(id: string): void {
    deleteRecipe(id);
    refresh();
  }

  function toggleFavorite(id: string): boolean {
    const ok = toggleRecipeFavorite(id);
    refresh();
    return ok;
  }

  function saveNotes(id: string, notes: string): boolean {
    const ok = updateRecipeNotes(id, notes);
    refresh();
    return ok;
  }

  function viewed(id: string): void {
    markRecipeViewed(id);
    refresh();
  }

  async function importBackup(file: File): Promise<number> {
    const total = await importRecipeBook(file);
    refresh();
    return total;
  }

  function exportBackup(): number {
    return exportRecipeBook();
  }

  const sourceDomains = computed<string[]>(() =>
    [...new Set(recipes.value.map(recipe => recipe.sourceDomain).filter((value): value is string => Boolean(value)))],
  );

  return {
    recipes,
    refresh,
    add,
    remove,
    toggleFavorite,
    saveNotes,
    viewed,
    importBackup,
    exportBackup,
    sourceDomains,
  };
});
