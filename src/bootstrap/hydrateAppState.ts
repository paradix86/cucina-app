import type { Pinia } from 'pinia';
import { useRecipeBookStore } from '../stores/recipeBook';
import { useShoppingListStore } from '../stores/shoppingList';
import { useWeeklyPlannerStore } from '../stores/weeklyPlanner';

export async function hydrateAppState(pinia: Pinia): Promise<void> {
  const recipeBook = useRecipeBookStore(pinia);
  const shoppingList = useShoppingListStore(pinia);
  const weeklyPlanner = useWeeklyPlannerStore(pinia);

  await Promise.all([
    recipeBook.hydrate(),
    shoppingList.hydrate(),
    weeklyPlanner.hydrate(),
  ]);
}
