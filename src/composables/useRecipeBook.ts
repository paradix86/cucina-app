/**
 * Returns the Recipe Book Pinia store.
 * Callers that need reactive refs should use storeToRefs() at their call site.
 */
import { useRecipeBookStore } from '../stores/recipeBook';

export function useRecipeBook() {
  return useRecipeBookStore();
}
