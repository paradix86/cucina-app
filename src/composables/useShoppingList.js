/**
 * Thin wrapper — delegates to the Pinia store.
 * Uses storeToRefs so consumers receive reactive refs, matching the
 * previous composable API (items is a ref, not an unwrapped array).
 */
import { storeToRefs } from 'pinia';
import { useShoppingListStore } from '../stores/shoppingList.js';

export function useShoppingList() {
  const store = useShoppingListStore();
  const { items, groupedSections } = storeToRefs(store);

  return {
    // reactive refs — safe to destructure and use as .value in script
    items,
    groupedSections,
    // actions
    refresh: store.refresh,
    addRecipeIngredients: store.addRecipeIngredients,
    toggleItem: store.toggleItem,
    removeItem: store.removeItem,
    toggleGroup: store.toggleGroup,
    removeMany: store.removeMany,
    clearAll: store.clearAll,
    parseIngredient: store.parseIngredient,
    formatQuantity: store.formatQuantity,
  };
}
