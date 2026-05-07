// Central registry of all localStorage keys used by the app.
// Add new keys here — never hardcode them at call sites.

export const STORAGE_KEY = 'cucina_recipebook_v3';
export const STORAGE_KEY_V2 = 'cucina_ricettario_v2';
export const SHOPPING_LIST_KEY = 'cucina_shopping_list_v1';
export const WEEKLY_PLANNER_KEY = 'cucina_weekly_planner_v1';
export const MEAL_COMPOSER_DRAFT_KEY = 'cucina_meal_composer_draft_v1';
export const MEAL_COMPOSER_LEGACY_DRAFT_KEY = 'cucina_meal_composer_draft';
export const NUTRITION_GOALS_KEY = 'cucina_nutrition_goals_v1';
export const LANG_KEY = 'cucina_lang';
export const GUIDE_CHECKS_KEY = 'cucina_guide_checks_v1';
export const TIMERS_KEY = 'cucina_timers_v1';

export function getCookingProgressKey(recipe: { id?: string; name?: string }): string {
  return `cucina_cooking_${recipe.id || recipe.name || 'default'}`;
}
