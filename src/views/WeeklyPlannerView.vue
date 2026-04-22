<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { t } from '../lib/i18n.js';
import { PLANNER_DAYS, PLANNER_MEAL_SLOTS } from '../lib/planner';
import { useToasts } from '../composables/useToasts.js';
import { useRecipeBookStore } from '../stores/recipeBook';
import { useWeeklyPlannerStore } from '../stores/weeklyPlanner';
import type { PlannerDayId, PlannerMealSlot, Recipe } from '../types';

type PlannerSelection = {
  day: PlannerDayId;
  slot: PlannerMealSlot;
};

const router = useRouter();
const recipeBook = useRecipeBookStore();
const plannerStore = useWeeklyPlannerStore();
const { showToast } = useToasts();

const { recipes } = storeToRefs(recipeBook);
const { plan, plannedMealsCount } = storeToRefs(plannerStore);

const searchQuery = ref('');
const activeSelection = ref<PlannerSelection | null>(null);

const totalSlots = PLANNER_DAYS.length * PLANNER_MEAL_SLOTS.length;

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

    return {
      id: day,
      label: t(`planner_day_${day}`),
      filledCount: slots.filter(slot => slot.recipeId).length,
      slots,
    };
  });
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

function openRecipe(recipeId: string) {
  router.push(`/recipe-book/${recipeId}`).catch(() => {});
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
        <button
          v-if="plannedMealsCount > 0"
          class="btn-ghost planner-clear-week"
          @click="clearWeek"
        >
          {{ t('planner_clear_week') }}
        </button>
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
                  {{ t('planner_recipe_suggested') }}
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
        <article v-for="day in weekDays" :key="day.id" class="card planner-day-card">
          <div class="planner-day-head">
            <div>
              <h2>{{ day.label }}</h2>
              <p class="muted-label">{{ t('planner_day_progress', { filled: day.filledCount, total: 3 }) }}</p>
            </div>
            <button
              v-if="day.filledCount > 0"
              class="btn-ghost planner-day-clear"
              @click="clearDay(day.id)"
            >
              {{ t('planner_clear_day') }}
            </button>
          </div>

          <div class="planner-slot-list">
            <section
              v-for="slot in day.slots"
              :key="slot.id"
              class="planner-slot-card"
              :class="{
                'is-filled': slot.recipe,
                'is-missing': slot.missing,
                'is-active': activeSelection?.day === day.id && activeSelection?.slot === slot.id,
              }"
            >
              <button class="planner-slot-main" @click="openPicker(day.id, slot.id)">
                <span class="planner-slot-label">{{ slot.label }}</span>
                <span v-if="slot.recipe" class="planner-slot-name">{{ slot.recipe.name }}</span>
                <span v-else-if="slot.missing" class="planner-slot-name">{{ t('planner_missing_recipe') }}</span>
                <span v-else class="planner-slot-empty">{{ t('planner_empty_slot') }}</span>
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
        </article>
      </div>
    </template>
  </section>
</template>
