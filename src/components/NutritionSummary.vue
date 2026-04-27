<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { t } from '../lib/i18n.js';
import { computeIngredientsFingerprint } from '../lib/nutrition';

const props = defineProps({
  recipe:           { type: Object,  required: true },
  isCalculating:    { type: Boolean, default: false },
  nutritionContext: { type: Object,  default: null },
});

const emit = defineEmits(['calculate']);

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
</style>
