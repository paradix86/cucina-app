/**
 * Returns the Shopping List Pinia store.
 * Callers that need reactive refs should use storeToRefs() at their call site.
 */
import { useShoppingListStore } from '../stores/shoppingList';

export function useShoppingList() {
  return useShoppingListStore();
}
