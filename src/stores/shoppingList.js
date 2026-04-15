import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  addShoppingListItems,
  assignSection,
  clearShoppingList,
  formatQuantity,
  getSectionI18nKey,
  groupShoppingItems,
  loadShoppingList,
  parseIngredient,
  removeShoppingListItem,
  saveShoppingList,
  SHOPPING_SECTIONS,
  toggleShoppingListItem,
} from '../lib/storage.js';

export const useShoppingListStore = defineStore('shoppingList', () => {
  const items = ref(loadShoppingList());

  function refresh() {
    items.value = loadShoppingList();
  }

  function addRecipeIngredients(recipe) {
    const added = addShoppingListItems(recipe.ingredients || [], { id: recipe.id, name: recipe.name });
    refresh();
    return added;
  }

  function toggleItem(id) {
    const ok = toggleShoppingListItem(id);
    refresh();
    return ok;
  }

  function removeItem(id) {
    const ok = removeShoppingListItem(id);
    refresh();
    return ok;
  }

  function toggleGroup(ids, checked) {
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

  function removeMany(ids) {
    const idSet = new Set(ids);
    const current = loadShoppingList();
    const filtered = current.filter(item => !idSet.has(item.id));
    if (filtered.length === current.length) return false;
    saveShoppingList(filtered);
    refresh();
    return true;
  }

  function clearAll() {
    clearShoppingList();
    refresh();
  }

  const groupedSections = computed(() => {
    const grouped = groupShoppingItems(items.value);
    const sectionMap = {};
    SHOPPING_SECTIONS.forEach(section => {
      sectionMap[section] = { grouped: [], ungrouped: [] };
    });

    grouped.grouped.forEach(group => {
      sectionMap[assignSection(group.baseName)].grouped.push(group);
    });

    grouped.ungrouped.forEach(item => {
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
    toggleItem,
    removeItem,
    toggleGroup,
    removeMany,
    clearAll,
    groupedSections,
    parseIngredient,
    formatQuantity,
  };
});
