<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { t } from '../lib/i18n';
import { PLANNER_DAYS, PLANNER_MEAL_SLOTS } from '../lib/planner';
import { useToasts } from '../composables/useToasts';
import { useRecipeBookStore } from '../stores/recipeBook';
import { useShoppingListStore } from '../stores/shoppingList';
import { useWeeklyPlannerStore } from '../stores/weeklyPlanner';
import { useNutritionGoalsStore } from '../stores/nutritionGoalsStore';
import { buildGoalComparison } from '../lib/nutritionGoals';
import type { GoalComparisonItem } from '../lib/nutritionGoals';
import type { PlannerDayId, PlannerMealSlot, Recipe, NutritionPer100g } from '../types';

type PlannerSelection = {
  day: PlannerDayId;
  slot: PlannerMealSlot;
};

const router = useRouter();
const recipeBook = useRecipeBookStore();
const shoppingList = useShoppingListStore();
const plannerStore = useWeeklyPlannerStore();
const { showToast } = useToasts();

const { recipes } = storeToRefs(recipeBook);
const { plan, plannedMealsCount } = storeToRefs(plannerStore);

const goalsStore = useNutritionGoalsStore();
const { goals } = storeToRefs(goalsStore);

const searchQuery = ref('');
const activeSelection = ref<PlannerSelection | null>(null);

const totalSlots = PLANNER_DAYS.length * PLANNER_MEAL_SLOTS.length;
const today = new Date();
const todayPlannerDay = PLANNER_DAYS[(today.getDay() + 6) % 7];

const slotOccasionMap: Record<PlannerMealSlot, string> = {
  breakfast: 'Colazione',
  lunch: 'Pranzo',
  dinner: 'Cena',
};

const recipeMap = computed(() => {
  return new Map(recipes.value.map(recipe => [ recipe.id, recipe ]));
});

const selectedRecipeId = computed(() => {
  if (!activeSelection.value) return null;
  return plan.value[activeSelection.value.day][activeSelection.value.slot];
});

const selectedRecipe = computed(() => {
  return selectedRecipeId.value ? recipeMap.value.get(selectedRecipeId.value) || null : null;
});

type NutritionMacroKey = 'proteinG' | 'carbsG' | 'fatG' | 'fiberG';
const MACRO_KEYS: Array<{ key: NutritionMacroKey; unit: string; labelKey: string; cssVar: string }> = [
  { key: 'proteinG', unit: 'g', labelKey: 'nutrition_goals_protein_label', cssVar: '--nutrition-protein' },
  { key: 'carbsG',   unit: 'g', labelKey: 'nutrition_goals_carbs_label',   cssVar: '--nutrition-carbs' },
  { key: 'fatG',     unit: 'g', labelKey: 'nutrition_goals_fat_label',     cssVar: '--nutrition-fat' },
  { key: 'fiberG',   unit: 'g', labelKey: 'nutrition_goals_fiber_label',   cssVar: '--nutrition-fiber' },
];

const expandedDays = ref<Set<PlannerDayId>>(new Set());

function toggleDayNutrition(dayId: PlannerDayId) {
  const next = new Set(expandedDays.value);
  if (next.has(dayId)) next.delete(dayId);
  else next.add(dayId);
  expandedDays.value = next;
}

function sumDayNutrition(dayRecipes: Recipe[]): NutritionPer100g | undefined {
  type SumKey = 'kcal' | NutritionMacroKey;
  const keys: SumKey[] = ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG'];
  const totals: NutritionPer100g = {};
  let hasAny = false;
  for (const recipe of dayRecipes) {
    const n = recipe.nutrition?.perServing;
    if (!n) continue;
    for (const k of keys) {
      const v = n[k];
      if (v !== undefined) {
        totals[k] = (totals[k] ?? 0) + v;
        hasAny = true;
      }
    }
  }
  return hasAny ? totals : undefined;
}

function fmt(val: number | undefined): string | number {
  if (val === undefined) return '—';
  return Math.round(val * 10) / 10;
}

const pickerRecipes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const desiredOccasion = activeSelection.value ? slotOccasionMap[activeSelection.value.slot] : '';

  return [ ...recipes.value ]
    .filter(recipe => {
      if (!query) return true;
      const haystack = [
        recipe.name,
        recipe.category,
        ...(recipe.tags || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      const score = (recipe: Recipe) => {
        let total = 0;
        if (desiredOccasion && (recipe.mealOccasion || []).includes(desiredOccasion)) total += 3;
        if (recipe.favorite) total += 2;
        if (recipe.lastViewedAt) total += 1;
        return total;
      };

      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
});

const weekDays = computed(() => {
  return PLANNER_DAYS.map(day => {
    const plannedRecipes = PLANNER_MEAL_SLOTS
      .map(slot => {
        const recipeId = plan.value[day][slot];
        return recipeId ? recipeMap.value.get(recipeId) || null : null;
      })
      .filter((recipe): recipe is Recipe => Boolean(recipe));

    const slots = PLANNER_MEAL_SLOTS.map(slot => {
      const recipeId = plan.value[day][slot];
      const recipe = recipeId ? recipeMap.value.get(recipeId) || null : null;
      return {
        id: slot,
        label: t(`planner_slot_${slot}`),
        recipeId,
        recipe,
        missing: Boolean(recipeId && !recipe),
      };
    });

    const dayNutrition = sumDayNutrition(plannedRecipes);
    const dayGoalItems = dayNutrition ? buildGoalComparison(dayNutrition, goals.value) : [];
    const dayGoalsByKey: Record<string, GoalComparisonItem> = Object.fromEntries(
      dayGoalItems.map(item => [item.key, item])
    );
    const kcalGoal = goals.value.kcal;
    const kcalPct = dayNutrition?.kcal !== undefined && kcalGoal && kcalGoal > 0
      ? Math.round((dayNutrition.kcal / kcalGoal) * 100)
      : null;

    return {
      id: day,
      label: t(`planner_day_${day}`),
      filledCount: slots.filter(slot => slot.recipeId).length,
      isToday: day === todayPlannerDay,
      plannedRecipes,
      slots,
      dayNutrition,
      dayGoalsByKey,
      kcalPct,
    };
  });
});

const plannedWeekRecipes = computed(() => {
  return weekDays.value.flatMap(day => day.plannedRecipes);
});

function openPicker(day: PlannerDayId, slot: PlannerMealSlot) {
  activeSelection.value = { day, slot };
  searchQuery.value = '';
}

function closePicker() {
  activeSelection.value = null;
  searchQuery.value = '';
}

function assignRecipe(recipeId: string) {
  if (!activeSelection.value) return;
  const recipe = recipeMap.value.get(recipeId);
  const ok = plannerStore.setSlot(activeSelection.value.day, activeSelection.value.slot, recipeId);
  if (ok && recipe) {
    showToast(t('planner_slot_saved_toast', { recipe: recipe.name }), 'success');
  }
  closePicker();
}

function clearSlot(day: PlannerDayId, slot: PlannerMealSlot) {
  const ok = plannerStore.clearSlot(day, slot);
  if (ok) {
    showToast(t('planner_slot_cleared_toast'), 'info');
    if (activeSelection.value?.day === day && activeSelection.value?.slot === slot) {
      closePicker();
    }
  }
}

function clearDay(day: PlannerDayId) {
  const ok = plannerStore.clearDay(day);
  if (ok) {
    showToast(t('planner_day_cleared_toast'), 'info');
    if (activeSelection.value?.day === day) closePicker();
  }
}

function clearWeek() {
  const ok = plannerStore.clearAll();
  if (ok) {
    showToast(t('planner_week_cleared_toast'), 'info');
    closePicker();
  }
}

function addRecipesToShoppingList(recipesToAdd: Recipe[]) {
  let totalIngredients = 0;
  recipesToAdd.forEach(recipe => {
    if (recipe.id && shoppingList.hasRecipeItems(recipe.id)) return;
    totalIngredients += shoppingList.addRecipeIngredients(recipe);
  });
  if (totalIngredients > 0) {
    showToast(t('planner_added_to_shopping_toast', { n: totalIngredients }), 'success');
  } else {
    showToast(t('planner_already_in_shopping_toast'), 'info');
  }
}

function addDayToShopping(day: PlannerDayId) {
  const dayPlan = weekDays.value.find(entry => entry.id === day);
  if (!dayPlan?.plannedRecipes.length) return;
  addRecipesToShoppingList(dayPlan.plannedRecipes);
}

function addWeekToShopping() {
  if (!plannedWeekRecipes.value.length) return;
  addRecipesToShoppingList(plannedWeekRecipes.value);
}

function openRecipe(recipeId: string) {
  router.push({
    name: 'recipe-book-detail',
    params: { id: recipeId },
    query: { returnTo: 'planner' },
  }).catch(() => {});
}

function goToImport() {
  router.push('/import').catch(() => {});
}

function goToRecipeBook() {
  router.push('/recipe-book').catch(() => {});
}

function isSuggested(recipe: Recipe) {
  if (!activeSelection.value) return false;
  return (recipe.mealOccasion || []).includes(slotOccasionMap[activeSelection.value.slot]);
}

function suggestedLabel() {
  if (!activeSelection.value) return t('planner_recipe_suggested', { slot: '' });
  return t('planner_recipe_suggested', {
    slot: t(`planner_slot_${activeSelection.value.slot}`).toLowerCase(),
  });
}
</script>

<template>
  <section class="panel active planner-view">
    <div class="card planner-summary-card">
      <div class="planner-summary-copy">
        <p class="planner-kicker">{{ t('planner_kicker') }}</p>
        <h1>{{ t('planner_title') }}</h1>
        <p class="muted-label planner-summary-desc">{{ t('planner_desc') }}</p>
      </div>
      <div class="planner-summary-side">
        <div class="planner-summary-stat">
          <span class="planner-summary-value">{{ plannedMealsCount }}/{{ totalSlots }}</span>
          <span class="planner-summary-label">{{ t('planner_summary_label') }}</span>
        </div>
        <div class="planner-week-dots" :aria-label="t('planner_summary_label')">
          <span
            v-for="day in weekDays"
            :key="day.id"
            class="planner-week-dot"
            :class="`fill-${day.filledCount}`"
            :title="day.label"
          />
        </div>
        <div v-if="plannedMealsCount > 0" class="planner-summary-actions">
          <button
            v-if="plannedWeekRecipes.length"
            class="btn-secondary planner-week-shopping"
            @click="addWeekToShopping"
          >
            {{ t('planner_add_week_to_shopping') }}
          </button>
          <button
            class="btn-ghost planner-clear-week"
            @click="clearWeek"
          >
            {{ t('planner_clear_week') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="!recipes.length" class="card empty-state-shell planner-empty-state">
      <span class="empty-kicker">{{ t('planner_empty_kicker') }}</span>
      <p class="empty">{{ t('planner_empty') }}</p>
      <p class="empty-next">{{ t('planner_empty_hint') }}</p>
      <div class="empty-state-actions">
        <button class="btn-primary" @click="goToImport">{{ t('empty_cta_import') }}</button>
        <button class="btn-secondary" @click="goToRecipeBook">{{ t('shopping_empty_cta') }}</button>
      </div>
    </div>

    <template v-else>
      <div v-if="activeSelection" class="card planner-picker-card">
        <div class="planner-picker-head">
          <div>
            <p class="planner-kicker">{{ t('planner_picker_kicker') }}</p>
            <h2>
              {{ t(`planner_day_${activeSelection.day}`) }} · {{ t(`planner_slot_${activeSelection.slot}`) }}
            </h2>
            <p class="muted-label">
              {{
                selectedRecipe
                  ? t('planner_picker_replace_current', { recipe: selectedRecipe.name })
                  : t('planner_picker_empty_current')
              }}
            </p>
          </div>
          <button class="btn-ghost" @click="closePicker">{{ t('planner_picker_close') }}</button>
        </div>

        <div class="planner-picker-controls">
          <input
            v-model="searchQuery"
            type="search"
            class="planner-picker-search"
            :placeholder="t('planner_picker_search')"
          />
          <p class="muted-label">{{ t('planner_picker_hint') }}</p>
        </div>

        <div v-if="pickerRecipes.length" class="planner-picker-list">
          <button
            v-for="recipe in pickerRecipes"
            :key="recipe.id"
            class="planner-picker-item"
            :class="{ active: selectedRecipeId === recipe.id }"
            @click="assignRecipe(recipe.id)"
          >
            <span class="planner-picker-item-main">
              <span class="planner-picker-item-title">{{ recipe.name }}</span>
              <span class="planner-picker-item-meta">
                <span v-if="recipe.favorite" class="planner-picker-pill">{{ t('planner_recipe_favorite') }}</span>
                <span v-if="isSuggested(recipe)" class="planner-picker-pill planner-picker-pill--suggested">
                  {{ suggestedLabel() }}
                </span>
                <span v-if="recipe.time">{{ recipe.time }}</span>
              </span>
            </span>
            <span class="planner-picker-action">
              {{ selectedRecipeId === recipe.id ? t('planner_picker_selected') : t('planner_picker_choose') }}
            </span>
          </button>
        </div>
        <p v-else class="empty planner-picker-empty">{{ t('planner_picker_empty') }}</p>
      </div>

      <div class="planner-week-grid">
        <article
          v-for="day in weekDays"
          :key="day.id"
          class="card planner-day-card"
          :class="{
            'planner-day-card--planned': day.filledCount > 0,
            'planner-day-card--complete': day.filledCount === day.slots.length,
            'is-today': day.isToday,
          }"
        >
          <div class="planner-day-head">
            <div class="planner-day-heading">
              <div class="planner-day-title-row">
                <div class="planner-day-title-copy">
                  <h2>{{ day.label }}</h2>
                  <span v-if="day.isToday" class="planner-today-badge">{{ t('planner_today') }}</span>
                </div>
                <span class="planner-day-count">{{ day.filledCount }}/{{ day.slots.length }}</span>
              </div>
              <p class="muted-label">{{ t('planner_day_progress', { filled: day.filledCount, total: 3 }) }}</p>
              <div class="planner-day-progress" aria-hidden="true">
                <span
                  v-for="slot in day.slots"
                  :key="`${day.id}-${slot.id}-progress`"
                  class="planner-day-progress-segment"
                  :class="{ 'is-filled': Boolean(slot.recipe), 'is-missing': slot.missing }"
                />
              </div>
            </div>
            <div v-if="day.filledCount > 0" class="planner-day-actions">
              <button
                v-if="day.plannedRecipes.length"
                class="btn-secondary planner-day-shopping"
                @click="addDayToShopping(day.id)"
              >
                {{ t('planner_add_day_to_shopping') }}
              </button>
              <button
                class="btn-ghost planner-day-clear"
                @click="clearDay(day.id)"
              >
                {{ t('planner_clear_day') }}
              </button>
            </div>
          </div>

          <div class="planner-slot-list">
            <section
              v-for="slot in day.slots"
              :key="slot.id"
              class="planner-slot-card"
              :data-slot="slot.id"
              :class="{
                'is-filled': slot.recipe,
                'is-missing': slot.missing,
                'is-active': activeSelection?.day === day.id && activeSelection?.slot === slot.id,
              }"
            >
              <button class="planner-slot-main" @click="openPicker(day.id, slot.id)">
                <template v-if="slot.recipe">
                  <span class="planner-slot-topline">
                    <span class="planner-slot-label">{{ slot.label }}</span>
                    <span class="planner-slot-hint">{{ t('planner_open_recipe') }}</span>
                  </span>
                  <span class="planner-slot-name">{{ slot.recipe.name }}</span>
                </template>
                <template v-else-if="slot.missing">
                  <span class="planner-slot-empty-copy">
                    <span class="planner-slot-empty-head">
                      <span class="planner-slot-add-icon" aria-hidden="true">!</span>
                      <span class="planner-slot-label">{{ slot.label }}</span>
                    </span>
                    <span class="planner-slot-name">{{ t('planner_missing_recipe') }}</span>
                  </span>
                </template>
                <template v-else>
                  <span class="planner-slot-empty-copy">
                    <span class="planner-slot-empty-head">
                      <span class="planner-slot-add-icon" aria-hidden="true">+</span>
                      <span class="planner-slot-label">{{ slot.label }}</span>
                    </span>
                    <span class="planner-slot-empty">{{ t('planner_empty_slot') }}</span>
                  </span>
                </template>
                <span v-if="slot.recipe?.time" class="planner-slot-meta">{{ slot.recipe.time }}</span>
                <span
                  v-else-if="slot.recipe?.mealOccasion?.length"
                  class="planner-slot-meta"
                >
                  {{ slot.recipe.mealOccasion.map(m => t(`meal_occasion_${m.toLowerCase()}`)).join(' · ') }}
                </span>
              </button>

              <div v-if="slot.recipe || slot.missing" class="planner-slot-actions">
                <button
                  v-if="slot.recipe"
                  class="btn-ghost planner-slot-action"
                  @click="openRecipe(slot.recipe.id)"
                >
                  {{ t('planner_open_recipe') }}
                </button>
                <button
                  class="btn-ghost planner-slot-action"
                  @click="openPicker(day.id, slot.id)"
                >
                  {{ t('planner_replace_slot') }}
                </button>
                <button
                  class="btn-ghost planner-slot-action planner-slot-action--danger"
                  @click="clearSlot(day.id, slot.id)"
                >
                  {{ t('planner_clear_slot') }}
                </button>
              </div>
            </section>
          </div>

          <div v-if="day.dayNutrition" class="planner-day-nutrition">
            <button
              class="planner-day-nutrition-toggle"
              :class="{ 'is-expanded': expandedDays.has(day.id) }"
              :aria-expanded="expandedDays.has(day.id) ? 'true' : 'false'"
              @click="toggleDayNutrition(day.id)"
            >
              <span class="planner-day-nutrition-kcal">
                {{ Math.round(day.dayNutrition.kcal ?? 0) }}
                <span class="planner-day-nutrition-unit">kcal</span>
                <span v-if="day.kcalPct !== null" class="planner-day-nutrition-goal-pct">({{ day.kcalPct }}%)</span>
              </span>
              <span class="planner-day-nutrition-label">{{ t('planner_day_nutrition_toggle') }}</span>
              <span class="planner-day-nutrition-chevron" aria-hidden="true" />
            </button>
            <div v-if="expandedDays.has(day.id)" class="planner-day-nutrition-detail">
              <div
                v-for="macro in MACRO_KEYS"
                :key="macro.key"
                class="planner-day-nutrition-row"
              >
                <span
                  class="planner-day-nutrition-dot"
                  :style="{ background: `var(${macro.cssVar})` }"
                  aria-hidden="true"
                />
                <span class="planner-day-nutrition-row-label">{{ t(macro.labelKey) }}</span>
                <span class="planner-day-nutrition-row-value">
                  {{ fmt(day.dayNutrition[macro.key]) }}<span class="planner-day-nutrition-row-unit"> {{ macro.unit }}</span>
                </span>
                <template v-if="day.dayGoalsByKey[macro.key]">
                  <div class="planner-day-nutrition-bar-track" aria-hidden="true">
                    <div
                      class="planner-day-nutrition-bar-fill"
                      :style="{
                        width: `${Math.min(day.dayGoalsByKey[macro.key].pct, 100)}%`,
                        background: `var(${macro.cssVar})`
                      }"
                    />
                  </div>
                  <span
                    class="planner-day-nutrition-row-pct"
                    :class="{ 'pct-over': day.dayGoalsByKey[macro.key].pct > 100 }"
                  >{{ day.dayGoalsByKey[macro.key].pct }}%</span>
                </template>
              </div>
            </div>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
