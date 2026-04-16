import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  addShoppingListItemsWithScale,
  assignSection,
  clearShoppingList,
  getSectionI18nKey,
  groupShoppingItems,
  loadShoppingList,
  parseIngredient,
  removeShoppingListItemsByRecipe,
  removeShoppingListItem,
  saveShoppingList,
  SHOPPING_SECTIONS,
  toggleShoppingListItem,
} from '../lib/storage';
import type { Recipe, ShoppingGroup, ShoppingItem, ShoppingSection } from '../types';

type SectionBucket = {
  grouped: ShoppingGroup[];
  ungrouped: ShoppingItem[];
};

export const useShoppingListStore = defineStore('shoppingList', () => {
  const items = ref<ShoppingItem[]>(loadShoppingList());

  function refresh(): void {
    items.value = loadShoppingList();
  }

  function addRecipeIngredients(recipe: Pick<Recipe, 'id' | 'name' | 'ingredients'>, options: { scaleFactor?: number } = {}): number {
    const added = addShoppingListItemsWithScale(recipe.ingredients || [], { id: recipe.id, name: recipe.name }, options);
    refresh();
    return added;
  }

  function removeRecipeIngredients(recipeId: string): number {
    const removed = removeShoppingListItemsByRecipe(recipeId);
    refresh();
    return removed;
  }

  function hasRecipeItems(recipeId: string): boolean {
    if (!recipeId) return false;
    return items.value.some(item => item.sourceRecipeId === recipeId);
  }

  function toggleItem(id: string): boolean {
    const ok = toggleShoppingListItem(id);
    refresh();
    return ok;
  }

  function removeItem(id: string): boolean {
    const ok = removeShoppingListItem(id);
    refresh();
    return ok;
  }

  function toggleGroup(ids: string[], checked: boolean): boolean {
    const idSet = new Set(ids);
    const current = loadShoppingList();
    let changed = false;
    current.forEach(item => {
      if (!idSet.has(item.id)) return;
      item.checked = checked;
      changed = true;
    });
    if (!changed) return false;
    saveShoppingList(current);
    refresh();
    return true;
  }

  function removeMany(ids: string[]): boolean {
    const idSet = new Set(ids);
    const current = loadShoppingList();
    const filtered = current.filter(item => !idSet.has(item.id));
    if (filtered.length === current.length) return false;
    saveShoppingList(filtered);
    refresh();
    return true;
  }

  function clearAll(): void {
    clearShoppingList();
    refresh();
  }

  const groupedSections = computed<ShoppingSection[]>(() => {
    const groupedResult = groupShoppingItems(items.value);
    const sectionMap: Record<string, SectionBucket> = {};
    SHOPPING_SECTIONS.forEach(section => {
      sectionMap[section] = { grouped: [], ungrouped: [] };
    });

    groupedResult.grouped.forEach(group => {
      sectionMap[assignSection(group.baseName)].grouped.push(group);
    });

    groupedResult.ungrouped.forEach(item => {
      const parsed = parseIngredient(item.text);
      sectionMap[assignSection(parsed.parsedName || item.text)].ungrouped.push(item);
    });

    return SHOPPING_SECTIONS.map(sectionId => ({
      id: sectionId,
      labelKey: getSectionI18nKey(sectionId),
      grouped: sectionMap[sectionId].grouped,
      ungrouped: sectionMap[sectionId].ungrouped,
    })).filter(section => section.grouped.length || section.ungrouped.length);
  });

  return {
    items,
    refresh,
    addRecipeIngredients,
    removeRecipeIngredients,
    hasRecipeItems,
    toggleItem,
    removeItem,
    toggleGroup,
    removeMany,
    clearAll,
    groupedSections,
  };
});
