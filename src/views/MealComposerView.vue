<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '../lib/i18n';
import { useRecipeBookStore } from '../stores/recipeBook';
import { useNutritionGoalsStore } from '../stores/nutritionGoalsStore';
import { useWeeklyPlannerStore } from '../stores/weeklyPlanner';
import { useToasts } from '../composables/useToasts';
import { buildGoalComparison } from '../lib/nutritionGoals';

const recipeBookStore = useRecipeBookStore();
const goalsStore = useNutritionGoalsStore();
const { recipes } = storeToRefs(recipeBookStore);
const { goals } = storeToRefs(goalsStore);

const search = ref('');
const selectedIds = ref(new Set());

const recipesWithNutrition = computed(() =>
  recipes.value.filter(r => r.nutrition?.perServing),
);

const filteredRecipes = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return recipesWithNutrition.value;
  return recipesWithNutrition.value.filter(r => r.name.toLowerCase().includes(q));
});

const selectedRecipes = computed(() =>
  recipesWithNutrition.value.filter(r => selectedIds.value.has(r.id)),
);

function toggleRecipe(recipe) {
  const next = new Set(selectedIds.value);
  if (next.has(recipe.id)) {
    next.delete(recipe.id);
  } else {
    next.add(recipe.id);
  }
  selectedIds.value = next;
}

function clearSelection() {
  selectedIds.value = new Set();
}

const MACRO_KEYS = [
  { key: 'proteinG', unit: 'g', labelKey: 'nutrition_goals_protein_label', cssVar: '--nutrition-protein' },
  { key: 'carbsG',   unit: 'g', labelKey: 'nutrition_goals_carbs_label',   cssVar: '--nutrition-carbs' },
  { key: 'fatG',     unit: 'g', labelKey: 'nutrition_goals_fat_label',     cssVar: '--nutrition-fat' },
  { key: 'fiberG',   unit: 'g', labelKey: 'nutrition_goals_fiber_label',   cssVar: '--nutrition-fiber' },
];

const mealTotals = computed(() => {
  const totals = {};
  for (const recipe of selectedRecipes.value) {
    const n = recipe.nutrition.perServing;
    const allKeys = [{ key: 'kcal' }, ...MACRO_KEYS];
    for (const { key } of allKeys) {
      if (n[key] !== undefined) {
        totals[key] = (totals[key] ?? 0) + n[key];
      }
    }
  }
  return totals;
});

const goalItems = computed(() =>
  buildGoalComparison(mealTotals.value, goals.value),
);

const goalItemsByKey = computed(() => {
  const map = {};
  for (const item of goalItems.value) map[item.key] = item;
  return map;
});

const hasGoals = computed(() => Object.keys(goals.value).length > 0);

function barPct(key) {
  const item = goalItemsByKey.value[key];
  return item ? Math.min(item.pct, 100) : 0;
}

function fmt(val) {
  if (val === undefined) return '—';
  return Math.round(val * 10) / 10;
}

function fmtMacro(recipe, key) {
  const v = recipe.nutrition?.perServing?.[key];
  return v != null ? Math.round(v) : null;
}

// kcal count-up animation
const displayKcal = ref(0);
let animFrame = null;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function animateKcal(from, to) {
  if (animFrame) cancelAnimationFrame(animFrame);
  if (prefersReducedMotion() || from === to) {
    displayKcal.value = Math.round(to);
    return;
  }
  const start = performance.now();
  const duration = 350;
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    displayKcal.value = Math.round(from + (to - from) * (1 - (1 - p) ** 3));
    if (p < 1) animFrame = requestAnimationFrame(step);
  }
  animFrame = requestAnimationFrame(step);
}

watch(() => mealTotals.value.kcal ?? 0, (n, o) => animateKcal(o ?? 0, n ?? 0), { immediate: true });
onUnmounted(() => { if (animFrame) cancelAnimationFrame(animFrame); });

// Planner integration
const plannerStore = useWeeklyPlannerStore();
const { showToast } = useToasts();
const showAddToPlanner = ref(false);
const selectedDay = ref(null);

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SLOTS = ['breakfast', 'lunch', 'dinner'];

const slotAssignments = computed(() =>
  selectedRecipes.value.slice(0, 3).map((recipe, i) => ({
    recipe,
    slot: SLOTS[i],
  }))
);

function openPlannerPanel() {
  selectedDay.value = null;
  showAddToPlanner.value = true;
}

function closePlannerPanel() {
  showAddToPlanner.value = false;
  selectedDay.value = null;
}

function confirmAddToPlan() {
  if (!selectedDay.value) return;
  for (const { recipe, slot } of slotAssignments.value) {
    plannerStore.setSlot(selectedDay.value, slot, recipe.id);
  }
  const dayLabel = t('planner_day_' + selectedDay.value);
  showToast(t('meal_composer_plan_added', { day: dayLabel }), 'success');
  closePlannerPanel();
}

// insights
const insights = computed(() => {
  if (!selectedRecipes.value.length) return [];
  const tot = mealTotals.value;
  const list = [];
  if ((tot.kcal ?? 0) >= 700) list.push('nutrition_goals_insight_calorie_dense');
  if ((tot.kcal ?? 0) > 0 && (tot.kcal ?? 0) < 300) list.push('nutrition_goals_insight_light_meal');
  if ((tot.proteinG ?? 0) >= 35) list.push('nutrition_goals_insight_high_protein');
  if ((tot.carbsG ?? 0) >= 100) list.push('nutrition_goals_insight_carb_heavy');
  return list.slice(0, 2);
});
</script>

<template>
  <div class="meal-composer">
    <div class="mc-layout">
      <!-- Left: recipe picker -->
      <section class="mc-picker">
        <div class="mc-picker-header">
          <h2 class="mc-title">{{ t('meal_composer_title') }}</h2>
          <p class="mc-desc">{{ t('meal_composer_desc') }}</p>
        </div>

        <input
          v-model="search"
          class="mc-search"
          type="search"
          :placeholder="t('meal_composer_search')"
        />

        <div v-if="recipesWithNutrition.length === 0" class="mc-empty-state">
          <span class="mc-empty-icon" aria-hidden="true">🥗</span>
          <p class="mc-empty-title">{{ t('meal_composer_no_nutrition_title') }}</p>
          <p class="mc-empty-body">{{ t('meal_composer_no_nutrition_body') }}</p>
        </div>

        <ul v-else class="mc-recipe-list">
          <li
            v-for="recipe in filteredRecipes"
            :key="recipe.id"
            class="mc-recipe-item"
          >
            <button
              class="mc-recipe-card"
              :class="{ selected: selectedIds.has(recipe.id) }"
              :aria-pressed="selectedIds.has(recipe.id)"
              @click="toggleRecipe(recipe)"
            >
              <span
                class="mc-card-check"
                :class="{ visible: selectedIds.has(recipe.id) }"
                aria-hidden="true"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="mc-card-body">
                <span class="mc-card-name">{{ recipe.name }}</span>
                <div class="mc-card-tags">
                  <span
                    v-if="recipe.nutrition?.perServing?.kcal != null"
                    class="mc-card-kcal"
                  >{{ Math.round(recipe.nutrition.perServing.kcal) }} kcal</span>
                  <span
                    v-if="fmtMacro(recipe, 'proteinG') != null"
                    class="mc-card-tag tag-protein"
                  >P {{ fmtMacro(recipe, 'proteinG') }}g</span>
                  <span
                    v-if="fmtMacro(recipe, 'carbsG') != null"
                    class="mc-card-tag tag-carbs"
                  >C {{ fmtMacro(recipe, 'carbsG') }}g</span>
                </div>
              </div>
            </button>
          </li>
        </ul>
      </section>

      <!-- Right: meal dashboard -->
      <section class="mc-dashboard" :class="{ 'has-selection': selectedRecipes.length > 0 }">
        <!-- Empty state -->
        <div v-if="selectedRecipes.length === 0" class="mc-dash-empty">
          <span class="mc-dash-empty-icon" aria-hidden="true">🍽️</span>
          <p class="mc-dash-empty-title">{{ t('meal_composer_empty_title') }}</p>
          <p class="mc-dash-empty-body">{{ t('meal_composer_empty_body') }}</p>
        </div>

        <template v-else>
          <!-- kcal hero -->
          <div class="mc-kcal-hero">
            <span class="mc-kcal-number" aria-live="polite">{{ displayKcal }}</span>
            <span class="mc-kcal-label">kcal</span>
          </div>

          <!-- Insights -->
          <div v-if="insights.length" class="mc-insights" aria-label="Meal insights">
            <span v-for="key in insights" :key="key" class="mc-insight-badge">
              {{ t(key) }}
            </span>
          </div>

          <!-- Selected recipe chips -->
          <div class="mc-chips-row">
            <div class="mc-chips" role="list" :aria-label="t('meal_composer_total')">
              <button
                v-for="recipe in selectedRecipes"
                :key="recipe.id"
                class="mc-chip"
                role="listitem"
                :aria-label="t('meal_composer_remove') + ' ' + recipe.name"
                @click="toggleRecipe(recipe)"
              >
                {{ recipe.name }}
                <span class="mc-chip-x" aria-hidden="true">×</span>
              </button>
            </div>
            <button class="mc-clear-btn" @click="clearSelection">
              {{ t('meal_composer_clear') }}
            </button>
          </div>

          <!-- Macro rows -->
          <ul class="mc-macro-list">
            <li v-for="macro in MACRO_KEYS" :key="macro.key" class="mc-macro-row">
              <span
                class="mc-macro-dot"
                :style="{ background: `var(${macro.cssVar})` }"
                aria-hidden="true"
              ></span>
              <span class="mc-macro-label">{{ t(macro.labelKey) }}</span>
              <div class="mc-macro-right">
                <span class="mc-macro-value">
                  {{ fmt(mealTotals[macro.key]) }}<span class="mc-macro-unit"> {{ macro.unit }}</span>
                </span>
                <span
                  v-if="goalItemsByKey[macro.key]"
                  class="mc-macro-pct"
                  :class="{
                    'pct-over': goalItemsByKey[macro.key].pct > 100,
                    'pct-high': goalItemsByKey[macro.key].pct >= 70 && goalItemsByKey[macro.key].pct <= 100,
                  }"
                >
                  {{ goalItemsByKey[macro.key].pct }}%
                </span>
              </div>
              <div
                v-if="goalItemsByKey[macro.key]"
                class="mc-bar-track"
                role="progressbar"
                :aria-valuenow="goalItemsByKey[macro.key].pct"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="t(macro.labelKey)"
              >
                <div
                  class="mc-bar-fill"
                  :style="{
                    width: barPct(macro.key) + '%',
                    background: `var(${macro.cssVar})`
                  }"
                ></div>
              </div>
            </li>
          </ul>

          <!-- No goals note -->
          <p v-if="!hasGoals" class="mc-goals-note">
            {{ t('meal_composer_goals_missing_note') }}
          </p>

          <!-- Add to Planner -->
          <div class="mc-plan-area">
            <button
              v-if="!showAddToPlanner"
              class="mc-add-plan-btn"
              @click="openPlannerPanel"
            >
              {{ t('meal_composer_add_to_plan') }}
            </button>

            <div v-else class="mc-plan-panel">
              <p class="mc-plan-title">{{ t('meal_composer_plan_title') }}</p>
              <p class="mc-plan-choose">{{ t('meal_composer_plan_choose_day') }}</p>
              <div class="mc-day-picker" role="radiogroup">
                <button
                  v-for="day in DAYS"
                  :key="day"
                  class="mc-day-btn"
                  :class="{ selected: selectedDay === day }"
                  :aria-pressed="selectedDay === day"
                  @click="selectedDay = day"
                >
                  {{ t('planner_day_' + day) }}
                </button>
              </div>
              <ul v-if="selectedDay" class="mc-slot-assignments">
                <li
                  v-for="{ recipe, slot } in slotAssignments"
                  :key="recipe.id"
                  class="mc-slot-row"
                >
                  <span class="mc-slot-label">{{ t('planner_slot_' + slot) }}</span>
                  <span class="mc-slot-name">{{ recipe.name }}</span>
                </li>
                <li v-if="selectedRecipes.length > 3" class="mc-slot-overflow">
                  +{{ selectedRecipes.length - 3 }} {{ t('meal_composer_plan_over_slots') }}
                </li>
              </ul>
              <div class="mc-plan-actions">
                <button
                  class="mc-plan-confirm-btn"
                  :disabled="!selectedDay"
                  @click="confirmAddToPlan"
                >
                  {{ t('confirm_confirm') }}
                </button>
                <button class="mc-plan-cancel-btn" @click="closePlannerPanel">
                  {{ t('confirm_cancel') }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.meal-composer {
  max-width: 980px;
  margin: 0 auto;
  padding: 0 1rem 2.5rem;
}

/* ── Layout ─────────────────────────────────────────────── */
.mc-layout {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 640px) {
  .mc-layout {
    grid-template-columns: 1fr;
  }

  .mc-dashboard {
    order: -1;
  }
}

/* ── Picker ─────────────────────────────────────────────── */
.mc-picker-header {
  margin-bottom: 1rem;
}

.mc-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0 0 0.2rem;
  color: var(--text);
}

.mc-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0;
}

.mc-search {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-md);
  border-radius: var(--radius-md, 12px);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.mc-search:focus {
  outline: none;
  border-color: var(--color-accent, #43a047);
}

.mc-empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-muted);
}

.mc-empty-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.75rem;
}

.mc-empty-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
  color: var(--text);
}

.mc-empty-body {
  font-size: 0.85rem;
  margin: 0;
}

/* Recipe list */
.mc-recipe-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 65vh;
  overflow-y: auto;
}

.mc-recipe-item {
  display: contents;
}

.mc-recipe-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 0.875rem;
  border: 1.5px solid var(--border-md);
  border-radius: var(--radius-md, 12px);
  background: var(--bg-secondary);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background 0.14s, border-color 0.14s, box-shadow 0.14s;
  min-height: 44px;
}

.mc-recipe-card:hover {
  background: var(--bg);
  border-color: var(--color-accent, #43a047);
}

.mc-recipe-card.selected {
  border-color: var(--color-accent, #43a047);
  background: color-mix(in srgb, var(--color-accent, #43a047) 8%, var(--bg-secondary));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent, #43a047) 30%, transparent);
}

.mc-card-check {
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  border: 1.5px solid var(--border-md);
  background: var(--bg);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: background 0.14s, border-color 0.14s;
}

.mc-card-check.visible {
  background: var(--color-accent, #43a047);
  border-color: var(--color-accent, #43a047);
}

.mc-card-body {
  flex: 1;
  min-width: 0;
}

.mc-card-name {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.2rem;
}

.mc-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.mc-card-kcal {
  font-size: 0.775rem;
  color: var(--text-muted);
  font-weight: 500;
}

.mc-card-tag {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-pill, 999px);
  color: white;
  letter-spacing: 0.01em;
}

.tag-protein { background: var(--nutrition-protein, #22c55e); }
.tag-carbs   { background: var(--nutrition-carbs, #f59e0b); }

/* ── Dashboard ──────────────────────────────────────────── */
.mc-dashboard {
  background: var(--bg-secondary);
  border: 1px solid var(--border-md);
  border-radius: var(--radius-md, 12px);
  padding: 1.5rem;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: sticky;
  top: 1rem;
}

/* Empty dashboard state */
.mc-dash-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-muted);
  padding: 1rem;
}

.mc-dash-empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.875rem;
  display: block;
}

.mc-dash-empty-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.4rem;
}

.mc-dash-empty-body {
  font-size: 0.875rem;
  margin: 0;
  max-width: 22ch;
}

/* kcal hero */
.mc-kcal-hero {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.mc-kcal-number {
  font-size: clamp(2.5rem, 6vw, 3.75rem);
  font-weight: 800;
  color: var(--text);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.mc-kcal-label {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-muted);
  align-self: flex-end;
  padding-bottom: 0.2rem;
}

/* Insights */
.mc-insights {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.mc-insight-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.65rem;
  border-radius: var(--radius-pill, 999px);
  background: color-mix(in srgb, var(--color-accent, #43a047) 12%, var(--bg-secondary));
  color: var(--color-accent, #43a047);
  border: 1px solid color-mix(in srgb, var(--color-accent, #43a047) 25%, transparent);
}

/* Chips row */
.mc-chips-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.mc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  flex: 1;
}

.mc-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.625rem;
  border: 1px solid var(--border-md);
  border-radius: var(--radius-pill, 999px);
  background: var(--bg);
  color: var(--text);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  animation: chip-in 0.2s ease;
}

.mc-chip:hover {
  border-color: var(--color-accent, #43a047);
  background: color-mix(in srgb, var(--color-accent, #43a047) 6%, var(--bg));
}

.mc-chip-x {
  font-size: 1rem;
  line-height: 1;
  color: var(--text-muted);
}

@keyframes chip-in {
  from { opacity: 0; transform: translateY(4px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.mc-clear-btn {
  font-size: 0.8rem;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.3rem 0.5rem;
  border-radius: var(--radius-sm, 6px);
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.12s;
}

.mc-clear-btn:hover {
  color: var(--text);
}

/* Macro rows */
.mc-macro-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mc-macro-row {
  display: grid;
  grid-template-columns: 0.875rem 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 0.625rem;
  row-gap: 0.3rem;
  align-items: center;
}

.mc-macro-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  flex-shrink: 0;
  grid-row: 1;
  grid-column: 1;
}

.mc-macro-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  grid-row: 1;
  grid-column: 2;
}

.mc-macro-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  grid-row: 1;
  grid-column: 3;
}

.mc-macro-value {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.mc-macro-unit {
  font-size: 0.775rem;
  font-weight: 400;
  color: var(--text-muted);
}

.mc-macro-pct {
  font-size: 0.775rem;
  font-weight: 600;
  color: var(--text-muted);
  min-width: 2.75rem;
  text-align: right;
}

.mc-macro-pct.pct-high {
  color: var(--color-accent, #43a047);
}

.mc-macro-pct.pct-over {
  color: var(--warning, #c96a00);
}

.mc-bar-track {
  grid-row: 2;
  grid-column: 1 / -1;
  height: 5px;
  background: color-mix(in srgb, var(--text-muted) 18%, var(--bg));
  border-radius: var(--radius-pill, 999px);
  overflow: hidden;
}

.mc-bar-fill {
  height: 100%;
  border-radius: var(--radius-pill, 999px);
  transition: width 0.35s ease;
}

/* Goals note */
.mc-goals-note {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 0;
  font-style: italic;
  line-height: 1.5;
}

/* Add to Plan */
.mc-plan-area {
  margin-top: 0.25rem;
}

.mc-add-plan-btn {
  width: 100%;
  padding: 0.625rem 1rem;
  border: 1.5px solid var(--color-accent, #43a047);
  border-radius: var(--radius-md, 12px);
  background: color-mix(in srgb, var(--color-accent, #43a047) 8%, var(--bg-secondary));
  color: var(--color-accent, #43a047);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 44px;
}

.mc-add-plan-btn:hover {
  background: color-mix(in srgb, var(--color-accent, #43a047) 16%, var(--bg-secondary));
}

.mc-plan-panel {
  border: 1px solid var(--border-md);
  border-radius: var(--radius-md, 12px);
  padding: 1rem;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mc-plan-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.mc-plan-choose {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 0;
}

.mc-day-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.mc-day-btn {
  padding: 0.3rem 0.7rem;
  border: 1.5px solid var(--border-md);
  border-radius: var(--radius-pill, 999px);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.8125rem;
  cursor: pointer;
  min-height: 34px;
  transition: border-color 0.12s, background 0.12s;
}

.mc-day-btn:hover {
  border-color: var(--color-accent, #43a047);
}

.mc-day-btn.selected {
  border-color: var(--color-accent, #43a047);
  background: color-mix(in srgb, var(--color-accent, #43a047) 12%, var(--bg-secondary));
  color: var(--color-accent, #43a047);
  font-weight: 600;
}

.mc-slot-assignments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.mc-slot-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.mc-slot-label {
  font-weight: 600;
  color: var(--text-muted);
  min-width: 5rem;
  text-transform: capitalize;
}

.mc-slot-name {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mc-slot-overflow {
  font-size: 0.775rem;
  color: var(--text-muted);
  font-style: italic;
}

.mc-plan-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.mc-plan-confirm-btn {
  padding: 0.5rem 1.125rem;
  border: none;
  border-radius: var(--radius-md, 12px);
  background: var(--color-accent, #43a047);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  transition: opacity 0.12s;
}

.mc-plan-confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mc-plan-cancel-btn {
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--border-md);
  border-radius: var(--radius-md, 12px);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.875rem;
  cursor: pointer;
  min-height: 44px;
  transition: background 0.12s;
}

.mc-plan-cancel-btn:hover {
  background: var(--bg);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mc-chip { animation: none; }
  .mc-bar-fill { transition: none; }
  .mc-recipe-card, .mc-card-check, .mc-chip { transition: none; }
}
</style>
