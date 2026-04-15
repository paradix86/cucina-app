/**
 * Thin wrapper — delegates to the Pinia store.
 * Uses storeToRefs so consumers receive reactive refs, matching the
 * previous composable API (recipes is a ref, not an unwrapped array).
 */
import { storeToRefs } from 'pinia';
import { useRecipeBookStore } from '../stores/recipeBook.js';

export function useRecipeBook() {
  const store = useRecipeBookStore();
  const { recipes, sourceDomains } = storeToRefs(store);

  return {
    // reactive refs — safe to destructure and use as .value in script
    recipes,
    sourceDomains,
    // actions — plain functions, no need for storeToRefs
    refresh: store.refresh,
    add: store.add,
    remove: store.remove,
    toggleFavorite: store.toggleFavorite,
    saveNotes: store.saveNotes,
    viewed: store.viewed,
    importBackup: store.importBackup,
    exportBackup: store.exportBackup,
  };
}
