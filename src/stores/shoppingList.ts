import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { t } from '../lib/i18n';
import {
  loadShoppingListAsync,
  saveShoppingListAsync,
  StorageWriteError,
} from '../lib/storage';
import { useToasts } from '../composables/useToasts';
import {
  assignSection,
  getSectionI18nKey,
  groupShoppingItems,
  parseIngredient,
  SHOPPING_SECTIONS,
  scaleShoppingIngredientText,
} from '../lib/ingredientUtils';
import type { Recipe, ShoppingGroup, ShoppingItem, ShoppingSection } from '../types';

type SectionBucket = {
  grouped: ShoppingGroup[];
  ungrouped: ShoppingItem[];
};

export const useShoppingListStore = defineStore('shoppingList', () => {
  const items = ref<ShoppingItem[]>([]);
  const isHydrated = ref(false);
  const { showToast } = useToasts();
  let hydratePromise: Promise<void> | null = null;
  let persistQueue: Promise<void> = Promise.resolve();

  function cloneItems(list: ShoppingItem[]): ShoppingItem[] {
    return list.map(item => ({ ...item }));
  }

  async function hydrate(force = false): Promise<void> {
    if (isHydrated.value && !force) return;
    if (hydratePromise && !force) return hydratePromise;

    hydratePromise = (async () => {
      items.value = cloneItems(await loadShoppingListAsync());
      isHydrated.value = true;
    })().finally(() => {
      hydratePromise = null;
    });

    return hydratePromise;
  }

  function refresh(): Promise<void> {
    return hydrate(true);
  }

  function onWriteError(e: unknown): void {
    if (e instanceof StorageWriteError) {
      showToast(t('toast_storage_write_error'), 'error');
    }
  }

  function persist(nextItems: ShoppingItem[]): void {
    const snapshot = cloneItems(nextItems);
    persistQueue = persistQueue
      .then(async () => {
        await saveShoppingListAsync(snapshot);
      })
      .catch(async e => {
        onWriteError(e);
        await hydrate(true);
      });
  }

  function addRecipeIngredients(recipe: Pick<Recipe, 'id' | 'name' | 'ingredients'>, options: { scaleFactor?: number } = {}): number {
    const timestamp = Date.now();
    const factor = Number.isFinite(options.scaleFactor) && (options.scaleFactor || 0) > 0 ? Number(options.scaleFactor) : 1;
    const additions = (recipe.ingredients || [])
      .map((text, index) => ({
        id: `shop-${timestamp}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        text: scaleShoppingIngredientText(String(text), factor),
        checked: false,
        sourceRecipeId: recipe.id || undefined,
        sourceRecipeName: recipe.name || undefined,
        createdAt: timestamp,
      }))
      .filter(item => item.text) as ShoppingItem[];

    if (additions.length === 0) return 0;
    items.value = [ ...items.value, ...additions ];
    persist(items.value);
    return additions.length;
  }

  function removeRecipeIngredients(recipeId: string): number {
    if (!recipeId) return 0;
    const next = items.value.filter(item => item.sourceRecipeId !== recipeId);
    const removed = items.value.length - next.length;
    if (removed === 0) return 0;
    items.value = next;
    persist(next);
    return removed;
  }

  function hasRecipeItems(recipeId: string): boolean {
    if (!recipeId) return false;
    return items.value.some(item => item.sourceRecipeId === recipeId);
  }

  function toggleItem(id: string): boolean {
    const index = items.value.findIndex(item => item.id === id);
    if (index === -1) return false;
    const next = cloneItems(items.value);
    next[index] = { ...next[index], checked: !next[index].checked };
    items.value = next;
    persist(next);
    return true;
  }

  function removeItem(id: string): boolean {
    const next = items.value.filter(item => item.id !== id);
    if (next.length === items.value.length) return false;
    items.value = next;
    persist(next);
    return true;
  }

  function toggleGroup(ids: string[], checked: boolean): boolean {
    const idSet = new Set(ids);
    const current = cloneItems(items.value);
    let changed = false;
    current.forEach(item => {
      if (!idSet.has(item.id)) return;
      item.checked = checked;
      changed = true;
    });
    if (!changed) return false;
    items.value = current;
    persist(current);
    return true;
  }

  function removeMany(ids: string[]): boolean {
    const idSet = new Set(ids);
    const filtered = items.value.filter(item => !idSet.has(item.id));
    if (filtered.length === items.value.length) return false;
    items.value = filtered;
    persist(filtered);
    return true;
  }

  function clearAll(): void {
    items.value = [];
    persist([]);
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
    isHydrated,
    hydrate,
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
