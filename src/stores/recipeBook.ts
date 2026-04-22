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
  StorageWriteError,
  toggleRecipeFavorite,
  updateRecipe,
  updateRecipeNotes,
} from '../lib/storage';
import { useToasts } from '../composables/useToasts.js';
import type { Recipe } from '../types';

export const useRecipeBookStore = defineStore('recipeBook', () => {
  const recipes = ref<Recipe[]>(loadRecipeBook());
  const { showToast } = useToasts();

  function refresh(): void {
    recipes.value = loadRecipeBook();
  }

  function onWriteError(e: unknown): void {
    if (e instanceof StorageWriteError) {
      showToast(t('toast_storage_write_error'), 'error');
    }
  }

  function add(recipe: Recipe): boolean {
    try {
      const ok = addRecipe(recipe);
      refresh();
      return ok;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
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

    try {
      const ok = addRecipe(duplicated);
      refresh();
      return ok ? duplicated : null;
    } catch (e) {
      onWriteError(e);
      refresh();
      return null;
    }
  }

  function remove(id: string): void {
    try {
      deleteRecipe(id);
    } catch (e) {
      onWriteError(e);
    } finally {
      refresh();
    }
  }

  function toggleFavorite(id: string): boolean {
    try {
      const ok = toggleRecipeFavorite(id);
      refresh();
      return ok;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  function saveNotes(id: string, notes: string): boolean {
    try {
      const ok = updateRecipeNotes(id, notes);
      refresh();
      return ok;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  function update(id: string, updates: Partial<Recipe>): boolean {
    try {
      const ok = updateRecipe(id, updates);
      refresh();
      return ok;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  function viewed(id: string): void {
    try {
      markRecipeViewed(id);
      refresh();
    } catch {
      // background housekeeping — swallow silently, no toast
    }
  }

  async function importBackup(file: File): Promise<{ total: number; added: number }> {
    try {
      const result = await importRecipeBook(file);
      refresh();
      return result;
    } catch (e) {
      if (e instanceof StorageWriteError) {
        showToast(t('toast_storage_write_error'), 'error');
      }
      throw e;
    }
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
