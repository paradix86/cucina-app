<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { t } from '../lib/i18n.js';
import { computeIngredientsFingerprint } from '../lib/nutrition';
import { parseGramsInput, parseNutrientInput, applyNutritionOverrides } from '../lib/nutritionOverride';
import { deriveEstimatedIngredients, deriveExcludedIngredients, deriveProviderNames, deriveConfidenceLabel } from '../lib/nutritionTransparency';
import { useRecipeBookStore } from '../stores/recipeBook';

const props = defineProps({
  recipe:           { type: Object,  required: true },
  isCalculating:    { type: Boolean, default: false },
  nutritionContext: { type: Object,  default: null },
});

const emit = defineEmits(['calculate', 'save', 'toast']);

const recipeBookStore = useRecipeBookStore();

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

      <!-- Macro rows -->
      <div class="nutrition-macros">
        <div v-if="nutritionContext.data.proteinG != null" class="nutrition-macro-row nutrition-macro-row--protein">
          <span class="nutrition-macro-dot"></span>
          <span class="nutrition-macro-name">{{ t('section_proteins') }}</span>
          <span class="nutrition-macro-val" aria-live="off">{{ animatedNumbers.proteinG != null ? animatedNumbers.proteinG.toFixed(1) : '—' }}g</span>
        </div>
        <div v-if="nutritionContext.data.carbsG != null" class="nutrition-macro-row nutrition-macro-row--carbs">
          <span class="nutrition-macro-dot"></span>
          <span class="nutrition-macro-name">{{ t('section_carbs') }}</span>
          <span class="nutrition-macro-val" aria-live="off">{{ animatedNumbers.carbsG != null ? animatedNumbers.carbsG.toFixed(1) : '—' }}g</span>
        </div>
        <div v-if="nutritionContext.data.fatG != null" class="nutrition-macro-row nutrition-macro-row--fat">
          <span class="nutrition-macro-dot"></span>
          <span class="nutrition-macro-name">{{ t('nutrition_fat') }}</span>
          <span class="nutrition-macro-val" aria-live="off">{{ animatedNumbers.fatG != null ? animatedNumbers.fatG.toFixed(1) : '—' }}g</span>
        </div>
        <div v-if="nutritionContext.data.fiberG != null" class="nutrition-macro-row nutrition-macro-row--fiber">
          <span class="nutrition-macro-dot"></span>
          <span class="nutrition-macro-name">{{ t('nutrition_fiber') }}</span>
          <span class="nutrition-macro-val" aria-live="off">{{ animatedNumbers.fiberG != null ? animatedNumbers.fiberG.toFixed(1) : '—' }}g</span>
        </div>
      </div>
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
        :disabled="isCalculating"
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

.nutrition-editor-input {
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

.nutrition-editor-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}

.nutrition-editor-actions button {
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
</style>
