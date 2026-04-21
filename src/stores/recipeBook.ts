import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { t } from '../lib/i18n.js';
import {
  addRecipe,
  deleteRecipe,
  exportRecipeBook,
  importRecipeBook,
  loadRecipeBook,
  markRecipeViewed,
  toggleRecipeFavorite,
  updateRecipe,
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

  function duplicate(id: string): Recipe | null {
    const original = recipes.value.find(recipe => recipe.id === id);
    if (!original) return null;

    const existingNames = new Set(recipes.value.map(recipe => (recipe.name || '').trim().toLowerCase()));
    const baseName = (original.name || '').trim();
    let nextName = `${baseName} ${t('recipe_duplicate_suffix')}`;
    let suffix = 2;
    while (existingNames.has(nextName.toLowerCase())) {
      nextName = `${baseName} ${t('recipe_duplicate_suffix')} ${suffix}`;
      suffix += 1;
    }

    const duplicated: Recipe = {
      ...original,
      id: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: nextName,
      favorite: false,
      lastViewedAt: undefined,
      notes: '',
      ingredients: [ ...(original.ingredients || []) ],
      steps: [ ...(original.steps || []) ],
      tags: [ ...(original.tags || []) ],
    };

    const ok = addRecipe(duplicated);
    refresh();
    return ok ? duplicated : null;
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

  function update(id: string, updates: Partial<Recipe>): boolean {
    const ok = updateRecipe(id, updates);
    refresh();
    return ok;
  }

  function viewed(id: string): void {
    markRecipeViewed(id);
    refresh();
  }

  async function importBackup(file: File): Promise<{ total: number; added: number }> {
    const result = await importRecipeBook(file);
    refresh();
    return result;
  }

  function exportBackup(): number {
    return exportRecipeBook();
  }

  const sourceDomains = computed<string[]>(() =>
    [ ...new Set(recipes.value.map(recipe => recipe.sourceDomain).filter((value): value is string => Boolean(value))) ],
  );

  return {
    recipes,
    refresh,
    add,
    duplicate,
    update,
    remove,
    toggleFavorite,
    saveNotes,
    viewed,
    importBackup,
    exportBackup,
    sourceDomains,
  };
});
