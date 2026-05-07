<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { t } from '../lib/i18n';
import { computeIngredientsFingerprint } from '../lib/nutrition';
import { parseGramsInput, parseNutrientInput, applyNutritionOverrides } from '../lib/nutritionOverride';
import { deriveEstimatedIngredients, deriveExcludedIngredients, deriveProviderNames, deriveConfidenceLabel } from '../lib/nutritionTransparency';
import { useRecipeBookStore } from '../stores/recipeBook';
import { useNutritionGoalsStore } from '../stores/nutritionGoalsStore';
import { buildGoalComparison, parseGoalInput } from '../lib/nutritionGoals';

const props = defineProps({
  recipe:            { type: Object,  required: true },
  isCalculating:     { type: Boolean, default: false },
  nutritionContext:   { type: Object,  default: null },
  calculateDisabled: { type: Boolean, default: false },
});

const emit = defineEmits(['calculate', 'save', 'toast']);

const recipeBookStore = useRecipeBookStore();
const goalsStore = useNutritionGoalsStore();

// ── Donut animation ────────────────────────────────────────────────────────────
const donutProgress = ref(1);
let donutRafId = null;

function animateDonut() {
  if (donutRafId != null) cancelAnimationFrame(donutRafId);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    donutProgress.value = 1;
    return;
  }
  const DURATION = 700;
  const start = performance.now();
  function step(now) {
    const elapsed = Math.min((now - start) / DURATION, 1);
    // cubic ease-out
    donutProgress.value = 1 - Math.pow(1 - elapsed, 3);
    if (elapsed < 1) {
      donutRafId = requestAnimationFrame(step);
    } else {
      donutRafId = null;
    }
  }
  donutRafId = requestAnimationFrame(step);
}

watch(
  () => props.recipe.nutrition?.calculatedAt,
  (val, old) => {
    if (val && val !== old) {
      donutProgress.value = 0;
      nextTick(animateDonut);
    }
  },
);

onUnmounted(() => {
  if (donutRafId != null) cancelAnimationFrame(donutRafId);
});

// ── Derived from nutritionContext ──────────────────────────────────────────────
const macroDonut = computed(() => {
  const d = props.nutritionContext?.data;
  if (!d) return null;
  const p  = d.proteinG ?? 0;
  const c  = d.carbsG   ?? 0;
  const f  = d.fatG     ?? 0;
  const fi = d.fiberG   ?? 0;
  const total = p + c + f + fi;
  if (total === 0) return null;
  const s1 = ((p           / total) * 100).toFixed(2);
  const s2 = (((p + c)     / total) * 100).toFixed(2);
  const s3 = (((p + c + f) / total) * 100).toFixed(2);
  return { s1, s2, s3 };
});

const animatedDonutGradient = computed(() => {
  if (!macroDonut.value) return null;
  const p  = donutProgress.value;
  const s1 = (parseFloat(macroDonut.value.s1) * p).toFixed(2);
  const s2 = (parseFloat(macroDonut.value.s2) * p).toFixed(2);
  const s3 = (parseFloat(macroDonut.value.s3) * p).toFixed(2);
  const s4 = (100 * p).toFixed(2);
  return `conic-gradient(var(--nutrition-protein) 0% ${s1}%, var(--nutrition-carbs) ${s1}% ${s2}%, var(--nutrition-fat) ${s2}% ${s3}%, var(--nutrition-fiber) ${s3}% ${s4}%, var(--color-border, #e0e0e0) ${s4}% 100%)`;
});

const animatedNumbers = computed(() => {
  const d = props.nutritionContext?.data;
  if (!d) return { kcal: null, proteinG: null, carbsG: null, fatG: null, fiberG: null };
  const p = donutProgress.value;
  function anim(v) { return v == null ? null : v * p; }
  return {
    kcal:     anim(d.kcal),
    proteinG: anim(d.proteinG),
    carbsG:   anim(d.carbsG),
    fatG:     anim(d.fatG),
    fiberG:   anim(d.fiberG),
  };
});

const macroAnimatedPct = computed(() => {
  const d = props.nutritionContext?.data;
  if (!d || !macroDonut.value) return { protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const p  = d.proteinG ?? 0;
  const c  = d.carbsG   ?? 0;
  const f  = d.fatG     ?? 0;
  const fi = d.fiberG   ?? 0;
  const total = p + c + f + fi;
  const prog = donutProgress.value;
  if (total === 0) return { protein: 0, carbs: 0, fat: 0, fiber: 0 };
  return {
    protein: +((p  / total) * 100 * prog).toFixed(1),
    carbs:   +((c  / total) * 100 * prog).toFixed(1),
    fat:     +((f  / total) * 100 * prog).toFixed(1),
    fiber:   +((fi / total) * 100 * prog).toFixed(1),
  };
});

const INSIGHT_EMOJI = {
  nutrition_insight_high_protein: '💪',
  nutrition_insight_low_protein:  '⚠️',
  nutrition_insight_carb_heavy:   '🍝',
  nutrition_insight_fat_rich:     '🧈',
  nutrition_insight_good_fiber:   '🌱',
  nutrition_insight_low_fiber:    '⚠️',
  nutrition_insight_balanced:     '✅',
};

// ── Nutrition Goals ────────────────────────────────────────────────────────────
const GOAL_FIELDS = [
  { key: 'kcal',     labelKey: 'nutrition_goals_kcal_label',    unit: 'kcal' },
  { key: 'proteinG', labelKey: 'nutrition_goals_protein_label', unit: 'g' },
  { key: 'carbsG',   labelKey: 'nutrition_goals_carbs_label',   unit: 'g' },
  { key: 'fatG',     labelKey: 'nutrition_goals_fat_label',     unit: 'g' },
  { key: 'fiberG',   labelKey: 'nutrition_goals_fiber_label',   unit: 'g' },
];

const goalComparison = computed(() => {
  const ctx = props.nutritionContext;
  if (!ctx) return [];
  const goals = goalsStore.goals;
  const hasAnyGoal = Object.values(goals).some(v => v != null);
  if (!hasAnyGoal) return [];
  const nutrition = ctx.perServing ?? ctx.perRecipe ?? ctx.data;
  return buildGoalComparison(nutrition, goals);
});

const whyInsights = computed(() => {
  const ctx = props.nutritionContext;
  if (!ctx) return [];
  const d = ctx.perServing ?? ctx.perRecipe ?? ctx.data;
  if (!d) return [];
  const goals = goalsStore.goals;
  const result = [];
  if (result.length < 3 && goals.proteinG && d.proteinG != null) {
    const pct = d.proteinG / goals.proteinG;
    if (pct >= 0.30)     result.push({ key: 'nutrition_insight_high_protein', type: 'positive' });
    else if (pct < 0.15) result.push({ key: 'nutrition_insight_low_protein',  type: 'caution'  });
  }
  if (result.length < 3 && goals.fiberG && d.fiberG != null) {
    const pct = d.fiberG / goals.fiberG;
    if (pct >= 0.25)     result.push({ key: 'nutrition_insight_good_fiber', type: 'positive' });
    else if (pct < 0.10) result.push({ key: 'nutrition_insight_low_fiber',  type: 'caution'  });
  }
  if (result.length < 3) {
    const p = d.proteinG ?? 0, c = d.carbsG ?? 0, f = d.fatG ?? 0, fi = d.fiberG ?? 0;
    const total = p + c + f + fi;
    if (total > 0) {
      if (c / total > 0.50)      result.push({ key: 'nutrition_insight_carb_heavy', type: 'info'    });
      else if (f / total > 0.40) result.push({ key: 'nutrition_insight_fat_rich',   type: 'caution' });
    }
  }
  if (result.length === 0) {
    const p = d.proteinG ?? 0, c = d.carbsG ?? 0, f = d.fatG ?? 0, fi = d.fiberG ?? 0;
    const total = p + c + f + fi;
    if (total > 0 && c / total <= 0.50 && f / total <= 0.50 && p / total <= 0.50)
      result.push({ key: 'nutrition_insight_balanced', type: 'positive' });
  }
  return result;
});

// ── Goals editor ──────────────────────────────────────────────────────────────
const showGoalsEditor = ref(false);
const goalsDraft = ref({ kcal: '', proteinG: '', carbsG: '', fatG: '', fiberG: '' });

function openGoalsEditor() {
  const g = goalsStore.goals;
  goalsDraft.value = {
    kcal:     g.kcal     != null ? String(g.kcal)     : '',
    proteinG: g.proteinG != null ? String(g.proteinG) : '',
    carbsG:   g.carbsG   != null ? String(g.carbsG)   : '',
    fatG:     g.fatG     != null ? String(g.fatG)     : '',
    fiberG:   g.fiberG   != null ? String(g.fiberG)   : '',
  };
  showGoalsEditor.value = true;
}

function cancelGoalsEditor() {
  showGoalsEditor.value = false;
}

function saveGoalsEditor() {
  const next = {};
  for (const f of GOAL_FIELDS) {
    const val = parseGoalInput(goalsDraft.value[f.key] ?? '');
    if (val !== undefined) next[f.key] = val;
  }
  goalsStore.update(next);
  showGoalsEditor.value = false;
  emit('toast', t('nutrition_goals_saved'), 'success');
}

const statusExplanation = computed(() => {
  const status = props.recipe.nutrition?.status;
  if (!status || status === 'missing') return null;
  return `nutrition_status_desc_${status}`;
});

const noDisplayableMacros = computed(() => {
  if (!props.nutritionContext) return false;
  return macroDonut.value === null;
});

const isNutritionStale = computed(() => {
  const stored = props.recipe.nutrition?.ingredientsFingerprint;
  if (!stored) return false;
  return stored !== computeIngredientsFingerprint(props.recipe.ingredients);
});

// ── Transparency ────────────────────────────────────────────────────────────────
const nutritionTransparency = computed(() => {
  const ingNutrition = props.recipe.ingredientNutrition ?? [];
  const estimated   = deriveEstimatedIngredients(ingNutrition);
  const excluded    = deriveExcludedIngredients(props.recipe.ingredients ?? [], ingNutrition);
  const sources     = deriveProviderNames(props.recipe.nutrition?.sources);
  const confidence  = deriveConfidenceLabel(props.recipe.nutrition?.sources);
  if (estimated.length === 0 && excluded.length === 0 && sources.length === 0) return null;
  return { estimated, excluded, sources, confidence };
});

// ── Details toggle ──────────────────────────────────────────────────────────────
const showDetails = ref(false);

const hasDetails = computed(() => {
  return props.recipe.nutrition != null && (
    nutritionTransparency.value != null ||
    (props.recipe.ingredientNutrition && props.recipe.ingredientNutrition.length > 0)
  );
});

// ── Editor state ────────────────────────────────────────────────────────────────
const showEditor      = ref(false);
const gramsDraft      = ref({});
const per100gDraft    = ref({});
const expandedPer100g = ref({});

const PER100G_FIELDS = [
  { key: 'kcal',     labelKey: null,               label: 'kcal', unit: 'kcal' },
  { key: 'proteinG', labelKey: 'section_proteins',                unit: 'g' },
  { key: 'carbsG',   labelKey: 'section_carbs',                   unit: 'g' },
  { key: 'fatG',     labelKey: 'nutrition_fat',                    unit: 'g' },
  { key: 'fiberG',   labelKey: 'nutrition_fiber',                  unit: 'g' },
];

function openEditor() {
  const gDraft    = {};
  const p100Draft = {};
  const ingMap    = new Map(
    (props.recipe.ingredientNutrition ?? []).map(ing => [ing.ingredientName, ing]),
  );
  for (const raw of props.recipe.ingredients ?? []) {
    const ing = ingMap.get(raw);
    gDraft[raw] = ing?.grams != null ? String(ing.grams) : '';
    const p = ing?.nutritionPer100g ?? {};
    p100Draft[raw] = {
      kcal:     p.kcal     != null ? String(p.kcal)     : '',
      proteinG: p.proteinG != null ? String(p.proteinG) : '',
      carbsG:   p.carbsG   != null ? String(p.carbsG)   : '',
      fatG:     p.fatG     != null ? String(p.fatG)     : '',
      fiberG:   p.fiberG   != null ? String(p.fiberG)   : '',
    };
  }
  gramsDraft.value      = gDraft;
  per100gDraft.value    = p100Draft;
  expandedPer100g.value = {};
  showEditor.value      = true;
  showDetails.value     = true;
}

function cancelEditor() {
  showEditor.value      = false;
  gramsDraft.value      = {};
  per100gDraft.value    = {};
  expandedPer100g.value = {};
}

function togglePer100gRow(name) {
  expandedPer100g.value = { ...expandedPer100g.value, [name]: !expandedPer100g.value[name] };
}

function setPer100gField(name, field, value) {
  const current = per100gDraft.value[name] ?? {};
  per100gDraft.value = { ...per100gDraft.value, [name]: { ...current, [field]: value } };
}

function saveEditor() {
  const storedMap = new Map(
    (props.recipe.ingredientNutrition ?? []).map(ing => [ing.ingredientName, ing]),
  );

  const gramsOverrides = {};
  for (const [name, raw] of Object.entries(gramsDraft.value)) {
    const parsed = parseGramsInput(String(raw));
    if (parsed !== (storedMap.get(name)?.grams ?? undefined)) {
      gramsOverrides[name] = parsed;
    }
  }

  const per100gOverrides = {};
  for (const [name, fields] of Object.entries(per100gDraft.value)) {
    const storedPer100g = storedMap.get(name)?.nutritionPer100g;
    const patch = {
      kcal:     parseNutrientInput(String(fields.kcal     ?? '')),
      proteinG: parseNutrientInput(String(fields.proteinG ?? '')),
      carbsG:   parseNutrientInput(String(fields.carbsG   ?? '')),
      fatG:     parseNutrientInput(String(fields.fatG     ?? '')),
      fiberG:   parseNutrientInput(String(fields.fiberG   ?? '')),
    };
    const anyChanged = Object.keys(patch).some(
      k => patch[k] !== (storedPer100g ? storedPer100g[k] : undefined),
    );
    if (anyChanged) per100gOverrides[name] = patch;
  }

  const result = applyNutritionOverrides({
    ingredientNutrition: props.recipe.ingredientNutrition ?? [],
    gramsOverrides,
    per100gOverrides,
    ingredients: props.recipe.ingredients ?? [],
    servings: props.recipe.servings,
  });
  const fingerprint = computeIngredientsFingerprint(props.recipe.ingredients);
  recipeBookStore.update(props.recipe.id, {
    ingredientNutrition: result.ingredientNutrition,
    nutrition: { ...result.nutrition, ingredientsFingerprint: fingerprint },
  });

  showEditor.value      = false;
  gramsDraft.value      = {};
  per100gDraft.value    = {};
  expandedPer100g.value = {};
  emit('toast', t('nutrition_values_updated'), 'success');
  donutProgress.value = 0;
  nextTick(animateDonut);
}
</script>

<template>
  <div class="nutrition-summary-card">
    <!-- Header: label + status badge -->
    <div class="nutrition-header">
      <p class="sec-label">{{ t('nutrition') }}</p>
      <span
        class="nutrition-badge"
        :class="`nutrition-badge--${recipe.nutrition?.status ?? 'missing'}`"
      >
        {{ t(`nutrition_status_${recipe.nutrition?.status ?? 'missing'}`) }}
      </span>
    </div>
    <p v-if="statusExplanation" class="nutrition-status-desc">{{ t(statusExplanation) }}</p>

    <!-- Stale warning -->
    <p v-if="isNutritionStale" class="nutrition-stale-warning">
      &#9888; {{ t('nutrition_stale_warning') }}
    </p>

    <!-- Visual: donut + macros -->
    <div v-if="nutritionContext" class="nutrition-body">
      <div class="nutrition-visual">
        <!-- Loading spinner -->
        <div
          v-if="isCalculating"
          class="nutrition-donut nutrition-donut--loading"
          role="img"
          :aria-label="t('nutrition_calculating')"
        >
          <div class="nutrition-donut-hole">
            <span class="nutrition-spinner" aria-hidden="true"></span>
          </div>
        </div>

        <!-- Donut ring -->
        <div
          v-else-if="animatedDonutGradient"
          class="nutrition-donut"
          role="img"
          :aria-label="t('nutrition_distribution')"
          :style="{ background: animatedDonutGradient }"
        >
          <div class="nutrition-donut-hole">
            <span class="nutrition-kcal-val" aria-live="off">
              {{ animatedNumbers.kcal != null ? Math.round(animatedNumbers.kcal) : '—' }}
            </span>
            <span class="nutrition-kcal-lbl">kcal</span>
          </div>
        </div>

        <!-- Solo kcal (no donut — all macros zero) -->
        <div v-else class="nutrition-kcal-solo">
          <span class="nutrition-kcal-val" aria-live="off">
            {{ animatedNumbers.kcal != null ? Math.round(animatedNumbers.kcal) : '—' }}
          </span>
          <span class="nutrition-kcal-lbl">kcal</span>
        </div>
      </div>

      <!-- Macro rows with progress bars -->
      <div class="nutrition-macros">
        <div v-if="nutritionContext.data.proteinG != null" class="nutrition-macro-row nutrition-macro-row--protein">
          <span class="nutrition-macro-dot" aria-hidden="true"></span>
          <span class="nutrition-macro-name">{{ t('section_proteins') }}</span>
          <div
            class="nutrition-macro-bar-wrap"
            role="progressbar"
            :aria-valuenow="macroAnimatedPct.protein"
            :aria-valuemax="100"
            :aria-label="`${t('section_proteins')}: ${macroAnimatedPct.protein.toFixed(0)}%`"
          >
            <div class="nutrition-macro-bar nutrition-macro-bar--protein" :style="{ width: `${macroAnimatedPct.protein}%` }"></div>
          </div>
          <span class="nutrition-macro-val" aria-live="off">{{ animatedNumbers.proteinG != null ? animatedNumbers.proteinG.toFixed(1) : '—' }}g</span>
          <span class="nutrition-macro-pct" aria-hidden="true">{{ macroAnimatedPct.protein.toFixed(0) }}%</span>
        </div>
        <div v-if="nutritionContext.data.carbsG != null" class="nutrition-macro-row nutrition-macro-row--carbs">
          <span class="nutrition-macro-dot" aria-hidden="true"></span>
          <span class="nutrition-macro-name">{{ t('section_carbs') }}</span>
          <div
            class="nutrition-macro-bar-wrap"
            role="progressbar"
            :aria-valuenow="macroAnimatedPct.carbs"
            :aria-valuemax="100"
            :aria-label="`${t('section_carbs')}: ${macroAnimatedPct.carbs.toFixed(0)}%`"
          >
            <div class="nutrition-macro-bar nutrition-macro-bar--carbs" :style="{ width: `${macroAnimatedPct.carbs}%` }"></div>
          </div>
          <span class="nutrition-macro-val" aria-live="off">{{ animatedNumbers.carbsG != null ? animatedNumbers.carbsG.toFixed(1) : '—' }}g</span>
          <span class="nutrition-macro-pct" aria-hidden="true">{{ macroAnimatedPct.carbs.toFixed(0) }}%</span>
        </div>
        <div v-if="nutritionContext.data.fatG != null" class="nutrition-macro-row nutrition-macro-row--fat">
          <span class="nutrition-macro-dot" aria-hidden="true"></span>
          <span class="nutrition-macro-name">{{ t('nutrition_fat') }}</span>
          <div
            class="nutrition-macro-bar-wrap"
            role="progressbar"
            :aria-valuenow="macroAnimatedPct.fat"
            :aria-valuemax="100"
            :aria-label="`${t('nutrition_fat')}: ${macroAnimatedPct.fat.toFixed(0)}%`"
          >
            <div class="nutrition-macro-bar nutrition-macro-bar--fat" :style="{ width: `${macroAnimatedPct.fat}%` }"></div>
          </div>
          <span class="nutrition-macro-val" aria-live="off">{{ animatedNumbers.fatG != null ? animatedNumbers.fatG.toFixed(1) : '—' }}g</span>
          <span class="nutrition-macro-pct" aria-hidden="true">{{ macroAnimatedPct.fat.toFixed(0) }}%</span>
        </div>
        <div v-if="nutritionContext.data.fiberG != null" class="nutrition-macro-row nutrition-macro-row--fiber">
          <span class="nutrition-macro-dot" aria-hidden="true"></span>
          <span class="nutrition-macro-name">{{ t('nutrition_fiber') }}</span>
          <div
            class="nutrition-macro-bar-wrap"
            role="progressbar"
            :aria-valuenow="macroAnimatedPct.fiber"
            :aria-valuemax="100"
            :aria-label="`${t('nutrition_fiber')}: ${macroAnimatedPct.fiber.toFixed(0)}%`"
          >
            <div class="nutrition-macro-bar nutrition-macro-bar--fiber" :style="{ width: `${macroAnimatedPct.fiber}%` }"></div>
          </div>
          <span class="nutrition-macro-val" aria-live="off">{{ animatedNumbers.fiberG != null ? animatedNumbers.fiberG.toFixed(1) : '—' }}g</span>
          <span class="nutrition-macro-pct" aria-hidden="true">{{ macroAnimatedPct.fiber.toFixed(0) }}%</span>
        </div>
      </div>
    </div>

    <!-- Goal comparison bars -->
    <div v-if="goalComparison.length" class="nutrition-goal-section">
      <p class="nutrition-goal-vs-label">{{ t('nutrition_goals_vs_daily') }}</p>
      <div
        v-for="item in goalComparison"
        :key="item.key"
        class="nutrition-goal-row"
      >
        <span class="nutrition-goal-name">{{ t(item.labelKey) }}</span>
        <div
          class="nutrition-goal-bar-wrap"
          role="progressbar"
          :aria-valuenow="item.pct"
          :aria-valuemax="100"
          :aria-label="`${t(item.labelKey)}: ${item.pct}%`"
        >
          <div
            class="nutrition-goal-bar"
            :class="{ 'nutrition-goal-bar--over': item.pct > 100 }"
            :style="{ width: `${Math.min(item.pct, 100)}%` }"
          ></div>
        </div>
        <span class="nutrition-goal-val">{{ item.unit === 'kcal' ? Math.round(item.value) : item.value.toFixed(1) }}{{ item.unit }}</span>
        <span class="nutrition-goal-pct" :class="{ 'nutrition-goal-pct--over': item.pct > 100 }">{{ item.pct }}%</span>
      </div>
    </div>

    <!-- Why this recipe? insights -->
    <div v-if="whyInsights.length" class="nutrition-insights" :aria-label="t('nutrition_insights_label')">
      <span
        v-for="badge in whyInsights"
        :key="badge.key"
        class="nutrition-insight-badge"
        :class="`nutrition-insight-badge--${badge.type}`"
        role="note"
      >{{ INSIGHT_EMOJI[badge.key] }} {{ t(badge.key) }}</span>
    </div>

    <!-- No macros note -->
    <p v-if="noDisplayableMacros" class="nutrition-no-macros-note">{{ t('nutrition_no_macros') }}</p>

    <!-- Partial note -->
    <p v-if="recipe.nutrition?.status === 'partial'" class="nutrition-partial-note">
      {{ t('nutrition_partial_note') }}
    </p>

    <!-- Estimation note (status is not manual) -->
    <p
      v-if="recipe.nutrition?.status && recipe.nutrition.status !== 'missing' && recipe.nutrition.status !== 'manual'"
      class="nutrition-estimation-note"
    >
      {{ t('nutrition_estimated_quantities_note') }}
    </p>

    <!-- Manual note -->
    <p v-if="recipe.nutrition?.status === 'manual'" class="nutrition-manual-note">
      {{ t('nutrition_status_manual') }}
    </p>

    <!-- Calculate / Recalculate button -->
    <div class="nutrition-footer">
      <button
        class="btn-secondary"
        :disabled="isCalculating || calculateDisabled"
        type="button"
        @click="emit('calculate')"
      >
        {{ isCalculating ? t('nutrition_calculating') : t('calculate_nutrition') }}
      </button>
    </div>

    <!-- Details toggle (only when there are details to show) -->
    <button
      v-if="hasDetails"
      class="nutrition-details-toggle"
      type="button"
      :aria-expanded="showDetails"
      @click="showDetails = !showDetails"
    >
      <p class="sec-label">{{ t('nutrition_details_title') }}</p>
      <span class="nutrition-details-chevron" :class="{ open: showDetails }" aria-hidden="true">&#9660;</span>
    </button>

    <!-- Collapsible details section (v-show keeps editor inputs alive) -->
    <div
      v-show="showDetails && hasDetails"
      class="nutrition-details-section"
      role="region"
      :aria-label="t('nutrition_details_title')"
    >
      <!-- Transparency -->
      <div v-if="nutritionTransparency" class="nutrition-transparency">
        <p v-if="nutritionTransparency.sources.length" class="nutrition-sources">
          {{ t('nutrition_sources') }}: {{ nutritionTransparency.sources.join(', ') }}<span v-if="nutritionTransparency.confidence"> · {{ t('nutrition_confidence_' + nutritionTransparency.confidence) }}</span>
        </p>
        <details v-if="nutritionTransparency.estimated.length" class="nutrition-details-group">
          <summary>{{ t('nutrition_estimated_quantities') }} ({{ nutritionTransparency.estimated.length }})</summary>
          <ul>
            <li v-for="est in nutritionTransparency.estimated" :key="est.name">
              {{ est.name }} {{ t('nutrition_estimated_as', { g: est.grams }) }}
            </li>
          </ul>
        </details>
        <details v-if="nutritionTransparency.excluded.length" class="nutrition-details-group">
          <summary>{{ t('nutrition_not_included') }} ({{ nutritionTransparency.excluded.length }})</summary>
          <ul>
            <li v-for="exc in nutritionTransparency.excluded" :key="exc.name">
              {{ exc.name }} — {{ t(`nutrition_reason_${exc.reason}`) }}
            </li>
          </ul>
        </details>
      </div>

      <!-- Edit quantities button + editor -->
      <div v-if="recipe.ingredientNutrition && recipe.ingredientNutrition.length > 0" class="nutrition-details-edit">
        <button
          v-if="!showEditor && recipe.nutrition && (recipe.ingredients?.length ?? 0) > 0"
          class="btn-ghost"
          type="button"
          @click="openEditor"
        >{{ t('nutrition_edit_quantities') }}</button>

        <div v-if="showEditor" class="nutrition-editor">
          <div
            v-for="raw in (recipe.ingredients ?? [])"
            :key="raw"
            class="nutrition-editor-ingredient"
          >
            <div class="nutrition-editor-row">
              <span class="nutrition-editor-name">{{ raw }}</span>
              <input
                class="nutrition-editor-input"
                type="text"
                inputmode="decimal"
                :aria-label="`${raw} – g`"
                :value="gramsDraft[raw]"
                @input="gramsDraft[raw] = $event.target.value"
              />
              <span class="nutrition-editor-unit">g</span>
            </div>
            <button
              class="nutrition-editor-expand-btn"
              type="button"
              @click="togglePer100gRow(raw)"
            >
              <span class="nutrition-editor-expand-arrow">{{ expandedPer100g[raw] ? '▾' : '▸' }}</span>
              {{ t('nutrition_edit_values') }}
            </button>
            <div v-if="expandedPer100g[raw]" class="nutrition-editor-per100g">
              <span class="nutrition-per100g-hint">{{ t('nutrition_per_100g') }}</span>
              <div
                v-for="field in PER100G_FIELDS"
                :key="field.key"
                class="nutrition-per100g-row"
              >
                <span class="nutrition-per100g-label">{{ field.labelKey ? t(field.labelKey) : field.label }}</span>
                <input
                  class="nutrition-editor-input"
                  type="text"
                  inputmode="decimal"
                  :aria-label="`${raw} – ${field.labelKey ? t(field.labelKey) : field.label} (${field.unit})`"
                  :value="per100gDraft[raw]?.[field.key] ?? ''"
                  @input="setPer100gField(raw, field.key, $event.target.value)"
                />
                <span class="nutrition-editor-unit">{{ field.unit }}</span>
              </div>
            </div>
          </div>
          <p class="nutrition-editor-hint">{{ t('nutrition_salt_note') }}</p>
          <div class="nutrition-editor-actions">
            <button class="btn-primary" type="button" @click="saveEditor">{{ t('recipe_edit_save') }}</button>
            <button class="btn-ghost" type="button" @click="cancelEditor">{{ t('recipe_edit_cancel') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Goals editor toggle -->
    <button
      class="nutrition-details-toggle nutrition-goals-toggle"
      type="button"
      :aria-expanded="showGoalsEditor"
      @click="showGoalsEditor ? cancelGoalsEditor() : openGoalsEditor()"
    >
      <p class="sec-label">{{ t('nutrition_goals_title') }}</p>
      <span class="nutrition-details-chevron" :class="{ open: showGoalsEditor }" aria-hidden="true">&#9660;</span>
    </button>

    <!-- Goals editor -->
    <div v-show="showGoalsEditor" class="nutrition-goals-editor" role="region" :aria-label="t('nutrition_goals_title')">
      <div v-for="field in GOAL_FIELDS" :key="field.key" class="nutrition-goal-editor-row">
        <label :for="`goal-${field.key}`" class="nutrition-goal-editor-label">{{ t(field.labelKey) }}</label>
        <input
          :id="`goal-${field.key}`"
          class="nutrition-goals-editor-input"
          type="text"
          inputmode="decimal"
          :placeholder="field.unit"
          :value="goalsDraft[field.key]"
          @input="goalsDraft[field.key] = $event.target.value"
        />
        <span class="nutrition-editor-unit">{{ field.unit }}</span>
      </div>
      <div class="nutrition-goals-editor-actions">
        <button class="btn-primary" type="button" @click="saveGoalsEditor">{{ t('nutrition_goals_save') }}</button>
        <button class="btn-ghost" type="button" @click="cancelGoalsEditor">{{ t('recipe_edit_cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Card entrance animation */
@keyframes nutrition-fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nutrition-summary-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (prefers-reduced-motion: no-preference) {
  .nutrition-summary-card {
    animation: nutrition-fade-slide-in 0.3s ease-out both;
  }
}

/* ── Header ── */
.nutrition-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nutrition-header .sec-label {
  margin: 0;
}

/* ── Badge ── */
.nutrition-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 20px;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.nutrition-badge--missing {
  background: var(--hover-bg, rgba(0,0,0,0.06));
  color: var(--text-muted);
}

.nutrition-badge--partial {
  background: var(--nutrition-partial-bg);
  color: var(--nutrition-partial-text);
}

.nutrition-badge--complete {
  background: var(--nutrition-complete-bg);
  color: var(--nutrition-complete-text);
}

.nutrition-badge--manual {
  background: var(--nutrition-manual-bg);
  color: var(--nutrition-manual-text);
}

/* ── Body: donut + macros ── */
.nutrition-body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nutrition-visual {
  flex-shrink: 0;
}

.nutrition-donut {
  width: 108px;
  height: 108px;
  border-radius: 50%;
  position: relative;
}

.nutrition-donut-hole {
  position: absolute;
  inset: 24px;
  border-radius: 50%;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.nutrition-kcal-solo {
  width: 108px;
  height: 108px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.nutrition-kcal-val {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.1;
}

.nutrition-kcal-lbl {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-top: 1px;
}

/* ── Macros ── */
.nutrition-macros {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nutrition-macro-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nutrition-macro-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nutrition-macro-row--protein .nutrition-macro-dot { background: var(--nutrition-protein); }
.nutrition-macro-row--carbs   .nutrition-macro-dot { background: var(--nutrition-carbs); }
.nutrition-macro-row--fat     .nutrition-macro-dot { background: var(--nutrition-fat); }
.nutrition-macro-row--fiber   .nutrition-macro-dot { background: var(--nutrition-fiber); }

.nutrition-macro-name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.nutrition-macro-val {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

/* ── Notes / warnings ── */
.nutrition-no-macros-note {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
  font-style: italic;
}

.nutrition-partial-note {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

.nutrition-estimation-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
  font-style: italic;
}

.nutrition-manual-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
  font-style: italic;
}

.nutrition-stale-warning {
  font-size: 0.78rem;
  color: var(--color-warn);
  background: var(--color-warn-bg);
  border-radius: 6px;
  padding: 4px 8px;
  margin: 0;
}

/* ── Footer ── */
.nutrition-footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.nutrition-footer button {
  flex: 1;
  min-width: 120px;
}

/* ── Loading donut ── */
.nutrition-donut--loading {
  background: conic-gradient(var(--border, #e0e0e0) 0% 100%);
}

.nutrition-spinner {
  display: block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border, #e0e0e0);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: nutrition-spin 0.8s linear infinite;
}

@keyframes nutrition-spin {
  to { transform: rotate(360deg); }
}

/* ── Details toggle ── */
.nutrition-details-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
  user-select: none;
  min-height: 44px;
  gap: 8px;
  background: none;
  border: none;
  border-top: 1px solid var(--border);
  padding: 8px 0 0;
  text-align: left;
}

.nutrition-details-toggle .sec-label {
  margin: 0;
}

.nutrition-details-chevron {
  font-size: 0.7rem;
  color: var(--text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.nutrition-details-chevron.open {
  transform: rotate(180deg);
}

/* ── Details section ── */
.nutrition-details-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nutrition-details-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Editor ── */
.nutrition-editor {
  border-top: 1px solid var(--border);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nutrition-editor-ingredient {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.nutrition-editor-ingredient:last-of-type {
  border-bottom: none;
}

.nutrition-editor-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nutrition-editor-name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nutrition-editor-input,
.nutrition-goals-editor-input {
  width: 72px;
  flex-shrink: 0;
  padding: 4px 6px;
  font-size: 0.9rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  text-align: right;
}

.nutrition-editor-unit {
  font-size: 0.8rem;
  color: var(--text-muted);
  flex-shrink: 0;
  width: 28px;
}

.nutrition-editor-expand-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 4px 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  cursor: pointer;
  text-align: left;
  min-height: 44px;
}

.nutrition-editor-expand-btn:hover {
  color: var(--text);
}

.nutrition-editor-expand-arrow {
  font-size: 0.65rem;
  flex-shrink: 0;
}

.nutrition-editor-per100g {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0 4px 8px;
  border-left: 2px solid var(--border);
  margin-left: 2px;
}

.nutrition-per100g-hint {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-style: italic;
  margin-bottom: 2px;
}

.nutrition-per100g-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nutrition-per100g-label {
  flex: 1;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.nutrition-editor-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
  margin: 4px 0 0;
}

.nutrition-editor-actions,
.nutrition-goals-editor-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}

.nutrition-editor-actions button,
.nutrition-goals-editor-actions button {
  flex: 1;
  min-height: 44px;
}

/* ── Transparency / details groups ── */
.nutrition-transparency {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nutrition-sources {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0;
}

.nutrition-details-group {
  font-size: 0.78rem;
}

.nutrition-details-group summary {
  cursor: pointer;
  color: var(--text-muted);
  list-style: none;
  user-select: none;
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.nutrition-details-group summary::before {
  content: '▸ ';
}

.nutrition-details-group[open] summary::before {
  content: '▾ ';
}

.nutrition-details-group ul {
  margin: 4px 0 0 12px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nutrition-details-group li {
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

/* ── Status description ── */
.nutrition-status-desc {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: -4px 0 0;
  line-height: 1.4;
}

/* ── Macro bars ── */
.nutrition-macro-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nutrition-macro-bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--bg-secondary, rgba(0,0,0,0.06));
  border-radius: 3px;
  overflow: hidden;
  min-width: 0;
}

.nutrition-macro-bar {
  height: 100%;
  border-radius: 3px;
  will-change: width;
  transition: width 0.016s linear;
}

.nutrition-macro-bar--protein { background: var(--nutrition-protein); }
.nutrition-macro-bar--carbs   { background: var(--nutrition-carbs); }
.nutrition-macro-bar--fat     { background: var(--nutrition-fat); }
.nutrition-macro-bar--fiber   { background: var(--nutrition-fiber); }

@media (prefers-reduced-motion: reduce) {
  .nutrition-macro-bar {
    transition: none;
  }
}

.nutrition-macro-pct {
  font-size: 0.72rem;
  color: var(--text-muted);
  width: 30px;
  text-align: right;
  flex-shrink: 0;
}

/* ── Insight badges ── */
.nutrition-insights {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.nutrition-insight-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.nutrition-insight-badge--positive {
  background: var(--nutrition-complete-bg);
  color: var(--nutrition-complete-text);
}

.nutrition-insight-badge--caution {
  background: var(--nutrition-partial-bg);
  color: var(--nutrition-partial-text);
}

.nutrition-insight-badge--info {
  background: var(--hover-bg, rgba(0,0,0,0.06));
  color: var(--text-muted);
}

/* ── Goal comparison ── */
.nutrition-goal-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nutrition-goal-vs-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.nutrition-goal-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nutrition-goal-name {
  font-size: 0.82rem;
  color: var(--text-muted);
  width: 72px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nutrition-goal-bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--bg-secondary, rgba(0,0,0,0.06));
  border-radius: 3px;
  overflow: hidden;
  min-width: 0;
}

.nutrition-goal-bar {
  height: 100%;
  border-radius: 3px;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

.nutrition-goal-bar--over {
  background: var(--nutrition-partial-text, #d97706);
}

@media (prefers-reduced-motion: reduce) {
  .nutrition-goal-bar { transition: none; }
}

.nutrition-goal-val {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  flex-shrink: 0;
  min-width: 48px;
  text-align: right;
}

.nutrition-goal-pct {
  font-size: 0.72rem;
  color: var(--text-muted);
  width: 36px;
  text-align: right;
  flex-shrink: 0;
}

.nutrition-goal-pct--over {
  color: var(--nutrition-partial-text, #d97706);
  font-weight: 700;
}

/* ── Goals editor ── */
.nutrition-goals-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 4px;
}

.nutrition-goal-editor-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}

.nutrition-goal-editor-label {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text);
}

/* ── Micro interactions ── */
.nutrition-footer button,
.nutrition-editor-actions button,
.nutrition-goals-editor-actions button,
.nutrition-details-toggle,
.btn-ghost {
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.nutrition-footer button:hover:not(:disabled),
.nutrition-editor-actions button:hover:not(:disabled),
.nutrition-goals-editor-actions button:hover:not(:disabled) {
  transform: scale(1.02);
}

.nutrition-footer button:active:not(:disabled),
.nutrition-editor-actions button:active:not(:disabled),
.nutrition-goals-editor-actions button:active:not(:disabled) {
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .nutrition-footer button,
  .nutrition-editor-actions button,
  .nutrition-goals-editor-actions button {
    transition: none;
  }
}
</style>
