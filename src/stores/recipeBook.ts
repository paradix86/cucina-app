import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { t } from '../lib/i18n';
import {
  exportRecipeBook,
  importRecipeBook,
  loadRecipeBookAsync,
  saveRecipeBookAsync,
  StorageWriteError,
} from '../lib/storage';
import { useToasts } from '../composables/useToasts';
import type { Recipe } from '../types';

export const useRecipeBookStore = defineStore('recipeBook', () => {
  const recipes = ref<Recipe[]>([]);
  const isHydrated = ref(false);
  const { showToast } = useToasts();
  let hydratePromise: Promise<void> | null = null;
  let persistQueue: Promise<void> = Promise.resolve();

  function cloneRecipe(recipe: Recipe): Recipe {
    return {
      ...recipe,
      ingredients: [ ...(recipe.ingredients || []) ],
      steps: [ ...(recipe.steps || []) ],
      tags: recipe.tags ? [ ...recipe.tags ] : undefined,
      mealOccasion: recipe.mealOccasion ? [ ...recipe.mealOccasion ] : undefined,
      nutrition: recipe.nutrition
        ? {
            ...recipe.nutrition,
            perRecipe:  recipe.nutrition.perRecipe  ? { ...recipe.nutrition.perRecipe  } : undefined,
            perServing: recipe.nutrition.perServing ? { ...recipe.nutrition.perServing } : undefined,
            sources: recipe.nutrition.sources ? recipe.nutrition.sources.map(s => ({ ...s })) : undefined,
          }
        : undefined,
      ingredientNutrition: recipe.ingredientNutrition
        ? recipe.ingredientNutrition.map(ing => ({
            ...ing,
            nutritionPer100g: ing.nutritionPer100g ? { ...ing.nutritionPer100g } : undefined,
            source: ing.source ? { ...ing.source } : undefined,
          }))
        : undefined,
    };
  }

  function cloneRecipes(list: Recipe[]): Recipe[] {
    return list.map(cloneRecipe);
  }

  async function hydrate(force = false): Promise<void> {
    if (isHydrated.value && !force) return;
    if (hydratePromise && !force) return hydratePromise;

    hydratePromise = (async () => {
      recipes.value = cloneRecipes(await loadRecipeBookAsync());
      isHydrated.value = true;
    })().finally(() => {
      hydratePromise = null;
    });

    return hydratePromise;
  }

  function refresh(): Promise<void> {
    return persistQueue.then(() => hydrate(true));
  }

  function onWriteError(e: unknown): void {
    if (e instanceof StorageWriteError) {
      showToast(t('toast_storage_write_error'), 'error');
    }
  }

  function persist(nextRecipes: Recipe[]): void {
    const snapshot = cloneRecipes(nextRecipes);
    persistQueue = persistQueue
      .then(async () => {
        await saveRecipeBookAsync(snapshot);
      })
      .catch(async e => {
        onWriteError(e);
        await hydrate(true);
      });
  }

  function add(recipe: Recipe): boolean {
    if (recipes.value.find(item => item.id === recipe.id)) return false;
    recipes.value = [ cloneRecipe(recipe), ...recipes.value ];
    persist(recipes.value);
    return true;
  }

  function duplicate(id: string): Recipe | null {
    const original = recipes.value.find(recipe => recipe.id === id);
    if (!original) return null;

    const existingNames = new Set(recipes.value.map(recipe => (recipe.name || '').trim().toLowerCase()));
    const baseName = (original.name || '').trim();
    let nextName = `${baseName} ${t('recipe_duplicate_suffix')}`;
    let suffix = 2;
    while (existingNames.has(nextName.toLowerCase())) {
      nextName = `${baseName} ${t('recipe_duplicate_suffix')} ${suffix}`;
      suffix += 1;
    }

    const duplicated: Recipe = {
      ...original,
      id: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: nextName,
      favorite: false,
      lastViewedAt: undefined,
      notes: '',
      ingredients: [ ...(original.ingredients || []) ],
      steps: [ ...(original.steps || []) ],
      tags: [ ...(original.tags || []) ],
    };

    recipes.value = [ duplicated, ...recipes.value ];
    persist(recipes.value);
    return duplicated;
  }

  function remove(id: string): void {
    recipes.value = recipes.value.filter(recipe => recipe.id !== id);
    persist(recipes.value);
  }

  function toggleFavorite(id: string): boolean {
    const index = recipes.value.findIndex(recipe => recipe.id === id);
    if (index === -1) return false;
    const next = cloneRecipes(recipes.value);
    next[index] = { ...next[index], favorite: !next[index].favorite };
    recipes.value = next;
    persist(next);
    return true;
  }

  function saveNotes(id: string, notes: string): boolean {
    const index = recipes.value.findIndex(recipe => recipe.id === id);
    if (index === -1) return false;
    const next = cloneRecipes(recipes.value);
    next[index] = { ...next[index], notes: notes || '' };
    recipes.value = next;
    persist(next);
    return true;
  }

  function update(id: string, updates: Partial<Recipe>): boolean {
    const index = recipes.value.findIndex(recipe => recipe.id === id);
    if (index === -1) return false;
    const next = cloneRecipes(recipes.value);
    next[index] = cloneRecipe({ ...next[index], ...updates, id: next[index].id });
    recipes.value = next;
    persist(next);
    return true;
  }

  function viewed(id: string): void {
    const index = recipes.value.findIndex(recipe => recipe.id === id);
    if (index === -1) return;
    const next = cloneRecipes(recipes.value);
    next[index] = { ...next[index], lastViewedAt: Date.now() };
    recipes.value = next;
    persistQueue = persistQueue.then(() => saveRecipeBookAsync(cloneRecipes(next))).catch(() => {});
  }

  async function importBackup(file: File): Promise<{ total: number; added: number }> {
    try {
      const result = await importRecipeBook(file);
      await hydrate(true);
      return result;
    } catch (e) {
      if (e instanceof StorageWriteError) {
        showToast(t('toast_storage_write_error'), 'error');
      }
      throw e;
    }
  }

  function exportBackup(): number {
    return exportRecipeBook();
  }

  const sourceDomains = computed<string[]>(() =>
    [ ...new Set(recipes.value.map(recipe => recipe.sourceDomain).filter((value): value is string => Boolean(value))) ],
  );

  return {
    recipes,
    isHydrated,
    hydrate,
    refresh,
    add,
    duplicate,
    update,
    remove,
    toggleFavorite,
    saveNotes,
    viewed,
    importBackup,
    exportBackup,
    sourceDomains,
  };
});
