import { computed, ref } from 'vue';
import {
  addRecipe,
  deleteRecipe,
  exportRecipeBook,
  importRecipeBook,
  loadRecipeBook,
  markRecipeViewed,
  toggleRecipeFavorite,
  updateRecipeNotes,
} from '../lib/storage.js';

const recipes = ref(loadRecipeBook());

export function useRecipeBook() {
  function refresh() {
    recipes.value = loadRecipeBook();
  }

  function add(recipe) {
    const ok = addRecipe(recipe);
    refresh();
    return ok;
  }

  function remove(id) {
    deleteRecipe(id);
    refresh();
  }

  function toggleFavorite(id) {
    const ok = toggleRecipeFavorite(id);
    refresh();
    return ok;
  }

  function saveNotes(id, notes) {
    const ok = updateRecipeNotes(id, notes);
    refresh();
    return ok;
  }

  function viewed(id) {
    markRecipeViewed(id);
    refresh();
  }

  async function importBackup(file) {
    const total = await importRecipeBook(file);
    refresh();
    return total;
  }

  function exportBackup() {
    return exportRecipeBook();
  }

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
    sourceDomains: computed(() => [...new Set(recipes.value.map(recipe => recipe.sourceDomain).filter(Boolean))]),
  };
}
