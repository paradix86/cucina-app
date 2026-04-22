import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { t } from '../lib/i18n.js';
import {
  addShoppingListItemsWithScale,
  clearShoppingList,
  loadShoppingList,
  removeShoppingListItemsByRecipe,
  removeShoppingListItem,
  saveShoppingList,
  StorageWriteError,
  toggleShoppingListItem,
} from '../lib/storage';
import { useToasts } from '../composables/useToasts.js';
import {
  assignSection,
  getSectionI18nKey,
  groupShoppingItems,
  parseIngredient,
  SHOPPING_SECTIONS,
} from '../lib/ingredientUtils';
import type { Recipe, ShoppingGroup, ShoppingItem, ShoppingSection } from '../types';

type SectionBucket = {
  grouped: ShoppingGroup[];
  ungrouped: ShoppingItem[];
};

export const useShoppingListStore = defineStore('shoppingList', () => {
  const items = ref<ShoppingItem[]>(loadShoppingList());
  const { showToast } = useToasts();

  function refresh(): void {
    items.value = loadShoppingList();
  }

  function onWriteError(e: unknown): void {
    if (e instanceof StorageWriteError) {
      showToast(t('toast_storage_write_error'), 'error');
    }
  }

  function addRecipeIngredients(recipe: Pick<Recipe, 'id' | 'name' | 'ingredients'>, options: { scaleFactor?: number } = {}): number {
    try {
      const added = addShoppingListItemsWithScale(recipe.ingredients || [], { id: recipe.id, name: recipe.name }, options);
      refresh();
      return added;
    } catch (e) {
      onWriteError(e);
      refresh();
      return 0;
    }
  }

  function removeRecipeIngredients(recipeId: string): number {
    try {
      const removed = removeShoppingListItemsByRecipe(recipeId);
      refresh();
      return removed;
    } catch (e) {
      onWriteError(e);
      refresh();
      return 0;
    }
  }

  function hasRecipeItems(recipeId: string): boolean {
    if (!recipeId) return false;
    return items.value.some(item => item.sourceRecipeId === recipeId);
  }

  function toggleItem(id: string): boolean {
    try {
      const ok = toggleShoppingListItem(id);
      refresh();
      return ok;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  function removeItem(id: string): boolean {
    try {
      const ok = removeShoppingListItem(id);
      refresh();
      return ok;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
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
    try {
      saveShoppingList(current);
      refresh();
      return true;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  function removeMany(ids: string[]): boolean {
    const idSet = new Set(ids);
    const current = loadShoppingList();
    const filtered = current.filter(item => !idSet.has(item.id));
    if (filtered.length === current.length) return false;
    try {
      saveShoppingList(filtered);
      refresh();
      return true;
    } catch (e) {
      onWriteError(e);
      refresh();
      return false;
    }
  }

  function clearAll(): void {
    try {
      clearShoppingList();
      refresh();
    } catch (e) {
      onWriteError(e);
      refresh();
    }
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
