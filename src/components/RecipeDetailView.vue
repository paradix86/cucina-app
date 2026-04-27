<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { buildStepsHtml, formatTimerLabel, getPreparationInfo, getSourceDomainLabel, joinMetaParts, scaleIngredients, suggestMealOccasions } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';
import { useShoppingListStore } from '../stores/shoppingList';
import { useRecipeBookStore } from '../stores/recipeBook';
import { buildShareUrl } from '../lib/recipeShare';
import { enrichRecipeNutritionWithProviders } from '../lib/nutritionEnrichment';
import { NUTRITION_PROVIDERS } from '../lib/nutritionProviders';
import { deriveEstimatedIngredients, deriveExcludedIngredients, deriveProviderNames, deriveConfidenceLabel } from '../lib/nutritionTransparency';

const props = defineProps({
  recipe: { type: Object, required: true },
  backLabel: { type: String, default: '' },
  savedMode: { type: Boolean, default: false },
  canSaveBuiltin: { type: Boolean, default: false },
});

const emit = defineEmits([
  'back',
  'start-recipe-timer',
  'start-cooking',
  'add-to-shopping',
  'save-builtin',
  'toggle-favorite',
  'delete-recipe',
  'save-notes',
  'duplicate-recipe',
  'save-recipe-edit',
  'toast',
]);

const shoppingStore = useShoppingListStore();
const { items: shoppingItems } = storeToRefs(shoppingStore);
const recipeBookStore = useRecipeBookStore();

const isCalculatingNutrition = ref(false);

const nutritionContext = computed(() => {
  const n = props.recipe.nutrition;
  if (!n) return null;
  const perServing = n.perServing;
  const perRecipe = n.perRecipe;
  if (perServing && Object.values(perServing).some(v => v != null)) {
    return { data: perServing, isPerServing: true, servingsUsed: n.servingsUsed };
  }
  if (perRecipe && Object.values(perRecipe).some(v => v != null)) {
    return { data: perRecipe, isPerServing: false, servingsUsed: undefined };
  }
  return null;
});

const macroDonut = computed(() => {
  const d = nutritionContext.value?.data;
  if (!d) return null;
  const p  = d.proteinG ?? 0;
  const c  = d.carbsG   ?? 0;
  const f  = d.fatG     ?? 0;
  const fi = d.fiberG   ?? 0;
  const total = p + c + f + fi;
  if (total === 0) return null;
  const s1 = ((p              / total) * 100).toFixed(2);
  const s2 = (((p + c)        / total) * 100).toFixed(2);
  const s3 = (((p + c + f)    / total) * 100).toFixed(2);
  const gradient = `conic-gradient(var(--nutrition-protein) 0% ${s1}%, var(--nutrition-carbs) ${s1}% ${s2}%, var(--nutrition-fat) ${s2}% ${s3}%, var(--nutrition-fiber) ${s3}% 100%)`;
  return { gradient };
});

const nutritionTransparency = computed(() => {
  const ingNutrition = props.recipe.ingredientNutrition ?? [];
  const estimated   = deriveEstimatedIngredients(ingNutrition);
  const excluded    = deriveExcludedIngredients(props.recipe.ingredients ?? [], ingNutrition);
  const sources     = deriveProviderNames(props.recipe.nutrition?.sources);
  const confidence  = deriveConfidenceLabel(props.recipe.nutrition?.sources);
  if (estimated.length === 0 && excluded.length === 0 && sources.length === 0) return null;
  return { estimated, excluded, sources, confidence };
});

function computeIngredientsFingerprint(ingredients) {
  return (ingredients ?? []).join('|');
}

const isNutritionStale = computed(() => {
  const stored = props.recipe.nutrition?.ingredientsFingerprint;
  if (!stored) return false;
  return stored !== computeIngredientsFingerprint(props.recipe.ingredients);
});

const allMacrosZero = computed(() => {
  if (!nutritionContext.value) return false;
  return macroDonut.value === null;
});

async function calculateNutrition() {
  if (isCalculatingNutrition.value || !props.recipe.id) return;
  isCalculatingNutrition.value = true;
  try {
    const result = await enrichRecipeNutritionWithProviders(props.recipe, NUTRITION_PROVIDERS);
    const fingerprint = computeIngredientsFingerprint(props.recipe.ingredients);
    recipeBookStore.update(props.recipe.id, {
      ingredientNutrition: result.ingredientNutrition,
      nutrition: { ...result.nutrition, ingredientsFingerprint: fingerprint },
    });
  } finally {
    isCalculatingNutrition.value = false;
  }
}

const servings = ref(parseInt(props.recipe.servings, 10) || 4);
const noteDraft = ref(props.recipe.notes || '');
const isEditing = ref(false);
const editError = ref('');
const prepOptions = ['classic', 'bimby', 'airfryer'];
const mealOccasionOptions = ['Colazione', 'Pranzo', 'Cena', 'Spuntino'];
const editDraft = ref(buildEditDraft(props.recipe));
const coverImageFailed = ref(false);

watch(() => props.recipe, recipe => {
  servings.value = parseInt(recipe.servings, 10) || 4;
  noteDraft.value = recipe.notes || '';
  coverImageFailed.value = false;
  if (!isEditing.value) {
    editDraft.value = buildEditDraft(recipe);
  }
}, { immediate: true });

const prepInfo = computed(() => getPreparationInfo(props.recipe));
const scaledIngredients = computed(() => scaleIngredients(props.recipe.ingredients || [], parseInt(props.recipe.servings, 10) || 4, servings.value));
const steps = computed(() => buildStepsHtml(props.recipe.steps || [], prepInfo.value.type));
const resolvedCoverImageUrl = computed(() => normalizeCoverImageUrl(props.recipe.coverImageUrl));
const showCoverImage = computed(() => Boolean(resolvedCoverImageUrl.value) && !coverImageFailed.value);
const hasShoppingContributions = computed(() => {
  if (!props.recipe?.id) return false;
  return shoppingItems.value.some(item => item.sourceRecipeId === props.recipe.id);
});
const shoppingActionLabel = computed(() => (hasShoppingContributions.value ? t('shopping_remove_from_recipe') : t('shopping_add')));

function changeServings(delta) {
  servings.value = Math.max(1, Math.min(20, servings.value + delta));
}

function normalizeCoverImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function onCoverImageError() {
  coverImageFailed.value = true;
}

function buildEditDraft(recipe) {
  const suggested = suggestMealOccasions(recipe);
  return {
    name: recipe.name || '',
    category: recipe.category || '',
    servings: recipe.servings || '',
    time: recipe.time || '',
    emoji: recipe.emoji || '',
    preparationType: prepOptions.includes(recipe.preparationType) ? recipe.preparationType : 'classic',
    timerMinutes: recipe.timerMinutes > 0 ? String(recipe.timerMinutes) : '',
    coverImageUrl: recipe.coverImageUrl || '',
    ingredients: Array.isArray(recipe.ingredients) && recipe.ingredients.length ? [...recipe.ingredients] : [''],
    steps: Array.isArray(recipe.steps) && recipe.steps.length ? [...recipe.steps] : [''],
    mealOccasion: Array.isArray(recipe.mealOccasion) ? [...recipe.mealOccasion] : [],
    suggestedMealOccasions: suggested.length > 0 ? suggested : null,
  };
}

function startEdit() {
  editDraft.value = buildEditDraft(props.recipe);
  editError.value = '';
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  editError.value = '';
  editDraft.value = buildEditDraft(props.recipe);
}

function addDraftIngredient() {
  editDraft.value.ingredients.push('');
}

function removeDraftIngredient(index) {
  if (editDraft.value.ingredients.length <= 1) return;
  editDraft.value.ingredients.splice(index, 1);
}

function moveDraftIngredient(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= editDraft.value.ingredients.length) return;
  const next = [...editDraft.value.ingredients];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  editDraft.value.ingredients = next;
}

function addDraftStep() {
  editDraft.value.steps.push('');
}

function removeDraftStep(index) {
  if (editDraft.value.steps.length <= 1) return;
  editDraft.value.steps.splice(index, 1);
}

function moveDraftStep(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= editDraft.value.steps.length) return;
  const next = [...editDraft.value.steps];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  editDraft.value.steps = next;
}

function toggleMealOccasion(occasion) {
  if (!editDraft.value.mealOccasion) {
    editDraft.value.mealOccasion = [];
  }
  const idx = editDraft.value.mealOccasion.indexOf(occasion);
  if (idx < 0) {
    editDraft.value.mealOccasion.push(occasion);
  } else {
    editDraft.value.mealOccasion.splice(idx, 1);
  }
}

function submitEdit() {
  const name = editDraft.value.name.trim();
  const ingredients = editDraft.value.ingredients.map(item => item.trim()).filter(Boolean);
  const steps = editDraft.value.steps.map(item => item.trim()).filter(Boolean);

  if (!name) {
    editError.value = t('manual_validation_name');
    return;
  }
  if (!ingredients.length) {
    editError.value = t('manual_validation_ingredients');
    return;
  }
  if (!steps.length) {
    editError.value = t('manual_validation_steps');
    return;
  }

  const timerMinutes = parseInt(editDraft.value.timerMinutes, 10);
  const normalizedCoverImageUrl = normalizeCoverImageUrl(editDraft.value.coverImageUrl);
  const updates = {
    name,
    category: editDraft.value.category.trim(),
    servings: String(editDraft.value.servings || '').trim(),
    time: editDraft.value.time.trim(),
    emoji: editDraft.value.emoji.trim() || '🍴',
    preparationType: prepOptions.includes(editDraft.value.preparationType) ? editDraft.value.preparationType : 'classic',
    timerMinutes: Number.isFinite(timerMinutes) && timerMinutes > 0 ? timerMinutes : 0,
    coverImageUrl: normalizedCoverImageUrl || undefined,
    ingredients,
    steps,
    mealOccasion: editDraft.value.mealOccasion && editDraft.value.mealOccasion.length > 0 ? editDraft.value.mealOccasion : undefined,
  };

  emit('save-recipe-edit', {
    recipeId: props.recipe.id,
    updates,
    onComplete(ok) {
      if (!ok) {
        editError.value = t('recipe_edit_save_err');
        return;
      }
      editError.value = '';
      isEditing.value = false;
    },
  });
}

function onShoppingAction() {
  const baseServings = parseInt(props.recipe.servings, 10) || 1;
  emit('add-to-shopping', {
    action: hasShoppingContributions.value ? 'remove' : 'add',
    recipe: props.recipe,
    selectedServings: servings.value,
    baseServings,
  });
}

function printRecipe() {
  window.print();
}

const shareStatus = ref(''); // '' | 'ok' | 'err' | 'too_long'
let shareStatusTimer = null;

function scheduleShareClear() {
  if (shareStatusTimer) clearTimeout(shareStatusTimer);
  shareStatusTimer = setTimeout(() => { shareStatus.value = ''; }, 3000);
}

async function copyUrlToClipboard(url) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      shareStatus.value = 'ok';
      emit('toast', t('share_copy_ok'), 'success');
    } catch {
      shareStatus.value = 'err';
      emit('toast', t('share_copy_err'), 'error');
    }
  } else {
    shareStatus.value = 'err';
    emit('toast', t('share_copy_err'), 'error');
  }
  scheduleShareClear();
}

async function shareRecipe() {
  if (props.recipe.id === '__shared_preview__') return;
  const result = buildShareUrl(props.recipe);
  if ('error' in result) {
    shareStatus.value = 'too_long';
    scheduleShareClear();
    return;
  }
  const { url } = result;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: props.recipe.name || 'Cucina App', url });
      return; // native sheet handled it — no extra feedback needed
    } catch (e) {
      if (e && e.name === 'AbortError') return; // user cancelled — silent
      // real error: fall through to clipboard
    }
  }
  await copyUrlToClipboard(url);
}

// QR state
const showQr = ref(false);
const qrDataUrl = ref('');
const qrModalUrl = ref('');
const qrCopyStatus = ref(''); // '' | 'ok' | 'err'
let qrCopyTimer = null;

async function openQr() {
  if (props.recipe.id === '__shared_preview__') return;
  const result = buildShareUrl(props.recipe);
  if ('error' in result) {
    shareStatus.value = 'too_long';
    scheduleShareClear();
    return;
  }
  const { url } = result;
  qrModalUrl.value = url;
  qrDataUrl.value = '';
  showQr.value = true;
  // Wait for modal to be fully rendered - use double nextTick to ensure
  // the DOM is fully laid out with dimensions (important for mobile)
  await nextTick();
  await nextTick();
  // Additional small delay for mobile browsers to complete layout
  await new Promise(resolve => setTimeout(resolve, 50));
  try {
    const QRCode = (await import('qrcode')).default;
    qrDataUrl.value = await QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#1a1a18', light: '#ffffff' } });
  } catch (e) {
    console.warn('QR code generation failed:', e);
    // if QR generation fails, the modal still shows with copy-link option
  }
}

async function copyQrLink() {
  if (!qrModalUrl.value) return;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(qrModalUrl.value);
      qrCopyStatus.value = 'ok';
      emit('toast', t('share_copy_ok'), 'success');
    } catch {
      qrCopyStatus.value = 'err';
      emit('toast', t('share_copy_err'), 'error');
    }
  } else {
    qrCopyStatus.value = 'err';
    emit('toast', t('share_copy_err'), 'error');
  }
  if (qrCopyTimer) clearTimeout(qrCopyTimer);
  qrCopyTimer = setTimeout(() => { qrCopyStatus.value = ''; }, 2500);
}

function closeQr() {
  showQr.value = false;
  qrCopyStatus.value = '';
}
</script>

<template>
  <div>
    <div class="detail-top-bar">
      <button class="detail-back" @click="emit('back')">{{ backLabel || t('detail_back') }}</button>
      <div v-if="savedMode && !isEditing" class="detail-quick-actions">
        <button
          class="detail-quick-btn detail-quick-fav"
          :class="{ 'is-fav': recipe.favorite }"
          :title="recipe.favorite ? t('favorite_remove') : t('favorite_add')"
          type="button"
          @click="emit('toggle-favorite', recipe)"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" :fill="recipe.favorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <button
          class="detail-quick-btn detail-quick-del"
          :title="t('delete_recipe')"
          type="button"
          @click="emit('delete-recipe', recipe)"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>
    <div v-if="!isEditing" class="detail-wrap">
      <div class="detail-head">
        <div class="detail-cover-wrap">
          <img
            v-if="showCoverImage"
            class="detail-cover-img"
            :src="resolvedCoverImageUrl"
            :alt="recipe.name"
            loading="lazy"
            decoding="async"
            @error="onCoverImageError"
          />
          <div v-else class="detail-cover-placeholder" aria-hidden="true">
            <span class="detail-cover-placeholder-icon">{{ recipe.emoji || '🍽️' }}</span>
          </div>
        </div>
        <h2 class="detail-title">{{ recipe.emoji || '🍴' }} {{ recipe.name }}</h2>
        <p class="detail-meta">{{ joinMetaParts([recipe.category, recipe.time, recipe.difficolta]) }}</p>
        <button class="btn-start-cooking detail-top-start" @click="emit('start-cooking', recipe)">{{ t('cooking_start') }}</button>
        <p class="detail-print-servings print-only">{{ t('detail_servings') }}: {{ servings }}</p>
      </div>

      <div class="detail-meta-grid detail-meta-panel">
        <div class="detail-meta-row">
          <span class="sec-label-inline">{{ t('detail_method') }}:</span>
          <span class="detail-meta-value">
            <span class="card-src" :class="prepInfo.cls">{{ prepInfo.txt }}</span>
          </span>
        </div>
        <div v-if="recipe.mealOccasion && recipe.mealOccasion.length" class="detail-meta-row detail-meta-row--chips">
          <span class="sec-label-inline">{{ t('meal_occasion_label') }}:</span>
          <div class="meal-occasion-badges">
            <span v-for="occasion in recipe.mealOccasion" :key="occasion" class="meal-badge">{{ t(`meal_occasion_${occasion.toLowerCase()}`) }}</span>
          </div>
        </div>
        <div v-if="recipe.sourceDomain || recipe.url" class="detail-meta-row">
          <span class="sec-label-inline">{{ t('detail_source_site') }}:</span>
          <p class="detail-origin">
            <a v-if="recipe.url" :href="recipe.url" target="_blank" rel="noopener">{{ getSourceDomainLabel(recipe.sourceDomain) || recipe.url }}</a>
            <span v-else>{{ getSourceDomainLabel(recipe.sourceDomain) }}</span>
          </p>
        </div>
        <div v-if="recipe.tags && recipe.tags.length" class="detail-meta-row detail-meta-row--chips">
          <span class="sec-label-inline">{{ t('import_tags') }}:</span>
          <div class="card-chips detail-tag-list">
            <span v-for="tag in recipe.tags.slice(0, 5)" :key="tag" class="card-chip card-chip--tag">{{ tag }}</span>
          </div>
        </div>
      </div>

      <div class="servings-ctrl">
        <span class="sec-label">{{ t('detail_servings') }}</span>
        <div class="servings-row">
          <button @click="changeServings(-1)" class="servings-btn" type="button">−</button>
          <span id="servings-val">{{ servings }}</span>
          <button @click="changeServings(1)" class="servings-btn" type="button">+</button>
        </div>
      </div>

      <div v-if="recipe.ingredients && recipe.ingredients.length" class="ing-wrap">
        <p class="sec-label">{{ t('detail_ingredients') }}</p>
        <ul class="ing-list">
          <li v-for="ingredient in scaledIngredients" :key="ingredient">{{ ingredient }}</li>
        </ul>
      </div>

      <div v-if="steps" class="steps-wrap">
        <p class="sec-label">{{ t('detail_steps' + (prepInfo.type === 'bimby' ? '_bimby' : '')) }}</p>
        <div class="steps-list" v-html="steps"></div>
      </div>

      <div v-if="recipe.importedInfo && recipe.importedInfo.tips && recipe.importedInfo.tips.length" class="imported-info-wrap card">
        <p class="sec-label">{{ t('recipe_imported_info') }}</p>
        <div v-for="tip in recipe.importedInfo.tips" :key="tip.title" class="imported-tip">
          <span class="imported-tip-title">{{ tip.title }}</span>
          <span class="imported-tip-text">{{ tip.text }}</span>
        </div>
      </div>

      <div v-if="savedMode" class="nutrition-wrap card">
        <div class="nutrition-header">
          <p class="sec-label">{{ t('nutrition') }}</p>
          <span class="nutrition-badge" :class="`nutrition-badge--${recipe.nutrition?.status ?? 'missing'}`">
            {{ t(`nutrition_status_${recipe.nutrition?.status ?? 'missing'}`) }}
          </span>
        </div>

        <div v-if="nutritionContext" class="nutrition-body">
          <div class="nutrition-visual">
            <div
              v-if="isCalculatingNutrition"
              class="nutrition-donut nutrition-donut--loading"
              role="img"
              :aria-label="t('calculate_nutrition')"
            >
              <div class="nutrition-donut-hole">
                <span class="nutrition-spinner" aria-hidden="true"></span>
              </div>
            </div>
            <div
              v-else-if="macroDonut"
              class="nutrition-donut"
              role="img"
              :aria-label="t('nutrition_distribution')"
              :style="{ background: macroDonut.gradient }"
            >
              <div class="nutrition-donut-hole">
                <span class="nutrition-kcal-val">{{ nutritionContext.data.kcal != null ? Math.round(nutritionContext.data.kcal) : '—' }}</span>
                <span class="nutrition-kcal-lbl">kcal</span>
              </div>
            </div>
            <div v-else class="nutrition-kcal-solo">
              <span class="nutrition-kcal-val">{{ nutritionContext.data.kcal != null ? Math.round(nutritionContext.data.kcal) : '—' }}</span>
              <span class="nutrition-kcal-lbl">kcal</span>
            </div>
          </div>

          <div class="nutrition-macros">
            <div v-if="nutritionContext.data.proteinG != null" class="nutrition-macro-row nutrition-macro-row--protein">
              <span class="nutrition-macro-dot"></span>
              <span class="nutrition-macro-name">{{ t('section_proteins') }}</span>
              <span class="nutrition-macro-val">{{ nutritionContext.data.proteinG.toFixed(1) }}g</span>
            </div>
            <div v-if="nutritionContext.data.carbsG != null" class="nutrition-macro-row nutrition-macro-row--carbs">
              <span class="nutrition-macro-dot"></span>
              <span class="nutrition-macro-name">{{ t('section_carbs') }}</span>
              <span class="nutrition-macro-val">{{ nutritionContext.data.carbsG.toFixed(1) }}g</span>
            </div>
            <div v-if="nutritionContext.data.fatG != null" class="nutrition-macro-row nutrition-macro-row--fat">
              <span class="nutrition-macro-dot"></span>
              <span class="nutrition-macro-name">{{ t('nutrition_fat') }}</span>
              <span class="nutrition-macro-val">{{ nutritionContext.data.fatG.toFixed(1) }}g</span>
            </div>
            <div v-if="nutritionContext.data.fiberG != null" class="nutrition-macro-row nutrition-macro-row--fiber">
              <span class="nutrition-macro-dot"></span>
              <span class="nutrition-macro-name">{{ t('nutrition_fiber') }}</span>
              <span class="nutrition-macro-val">{{ nutritionContext.data.fiberG.toFixed(1) }}g</span>
            </div>
          </div>
        </div>

        <p v-if="allMacrosZero" class="nutrition-no-macros-note">{{ t('nutrition_no_macros') }}</p>

        <p v-if="recipe.nutrition?.status === 'partial'" class="nutrition-partial-note">
          {{ t('nutrition_partial_note') }}
        </p>

        <p v-if="isNutritionStale" class="nutrition-stale-warning">⚠ {{ t('nutrition_stale_warning') }}</p>

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

        <div class="nutrition-footer">
          <button
            class="btn-secondary"
            :disabled="isCalculatingNutrition"
            type="button"
            @click="calculateNutrition"
          >{{ isCalculatingNutrition ? '…' : t('calculate_nutrition') }}</button>
        </div>
      </div>

      <div class="detail-actions-shell">
        <div class="detail-action-primary">
          <button class="btn-start-cooking" @click="emit('start-cooking', recipe)">{{ t('cooking_start') }}</button>
        </div>

        <div class="detail-actions detail-actions-secondary-tier">
          <button class="btn-secondary detail-action-shopping" @click="onShoppingAction">{{ shoppingActionLabel }}</button>
          <button v-if="recipe.timerMinutes" class="btn-secondary" @click="emit('start-recipe-timer', recipe)">
            {{ t('detail_timer_btn', { t: formatTimerLabel(recipe.timerMinutes) }) }}
          </button>
          <button v-if="canSaveBuiltin" class="btn-secondary" @click="emit('save-builtin', recipe)">{{ t('builtin_save') }}</button>
        </div>

        <div class="detail-actions detail-actions-utility">
          <button v-if="savedMode" class="btn-ghost btn-utility btn-utility-icon" @click="emit('duplicate-recipe', recipe)" type="button">
            <span class="button-icon">⎘</span>
            {{ t('recipe_duplicate') }}
          </button>
          <button v-if="savedMode" class="btn-ghost btn-utility btn-utility-icon" @click="startEdit" type="button">
            <span class="button-icon">✎</span>
            {{ t('recipe_edit') }}
          </button>
          <button class="btn-ghost btn-print btn-utility" @click="printRecipe" type="button">🖨 {{ t('recipe_print') }}</button>
          <template v-if="recipe.id !== '__shared_preview__'">
            <button class="btn-ghost btn-utility btn-share" type="button" @click="shareRecipe">🔗 {{ t('share_recipe') }}</button>
            <button class="btn-ghost btn-utility btn-qr" type="button" @click="openQr">{{ t('share_qr_btn') }}</button>
            <span v-if="shareStatus === 'ok'" class="share-feedback share-ok">{{ t('share_copy_ok') }}</span>
            <span v-else-if="shareStatus === 'too_long'" class="share-feedback share-err">{{ t('share_too_long') }}</span>
            <span v-else-if="shareStatus === 'err'" class="share-feedback share-err">{{ t('share_copy_err') }}</span>
          </template>
        </div>
      </div>
    </div>
    <div v-else-if="savedMode" class="notes-box card recipe-edit-box">
      <div class="sec-label">{{ t('recipe_edit_title') }}</div>
      <div class="edit-section edit-metadata">
        <div class="manual-grid">
          <div class="manual-field">
            <label for="edit-name">{{ t('manual_name_label') }}</label>
            <input id="edit-name" v-model="editDraft.name" type="text" :placeholder="t('manual_name_placeholder')" />
          </div>
          <div class="manual-field">
            <label for="edit-category">{{ t('manual_category_label') }}</label>
            <input id="edit-category" v-model="editDraft.category" type="text" :placeholder="t('manual_category_placeholder')" />
          </div>
          <div class="manual-field">
            <label for="edit-servings">{{ t('manual_servings_label') }}</label>
            <input id="edit-servings" v-model="editDraft.servings" type="number" min="1" max="20" />
          </div>
          <div class="manual-field">
            <label for="edit-time">{{ t('manual_time_label') }}</label>
            <input id="edit-time" v-model="editDraft.time" type="text" :placeholder="t('manual_time_placeholder')" />
          </div>
          <div class="manual-field">
            <label for="edit-emoji">{{ t('manual_emoji_label') }}</label>
            <input id="edit-emoji" v-model="editDraft.emoji" type="text" maxlength="4" :placeholder="t('manual_emoji_placeholder')" />
          </div>
          <div class="manual-field">
            <label for="edit-preparation">{{ t('manual_prep_label') }}</label>
            <select id="edit-preparation" v-model="editDraft.preparationType">
              <option v-for="prep in prepOptions" :key="prep" :value="prep">{{ t(`prep_${prep}`) }}</option>
            </select>
          </div>
          <div class="manual-field">
            <label for="edit-timer">{{ t('manual_timer_label') }}</label>
            <input id="edit-timer" v-model="editDraft.timerMinutes" type="number" min="0" step="1" :placeholder="t('manual_timer_placeholder')" />
          </div>
          <div class="manual-field manual-field--full">
            <label for="edit-cover-image-url">{{ t('manual_cover_image_label') }}</label>
            <input
              id="edit-cover-image-url"
              v-model="editDraft.coverImageUrl"
              type="url"
              inputmode="url"
              autocomplete="url"
              :placeholder="t('manual_cover_image_placeholder')"
            />
          </div>
        </div>
      </div>

      <div class="edit-section edit-meal-occasion">
        <label class="sec-label">{{ t('meal_occasion_label') }}</label>
        <div v-if="editDraft.suggestedMealOccasions && editDraft.suggestedMealOccasions.length" class="meal-suggestions">
          <small class="meal-suggestions-hint">{{ t('meal_occasion_suggested', { suggestions: editDraft.suggestedMealOccasions.map(o => t(`meal_occasion_${o.toLowerCase()}`)).join(', ') }) }}</small>
        </div>
        <div class="meal-occasion-chips">
          <button
            v-for="occasion in mealOccasionOptions"
            :key="occasion"
            class="meal-chip"
            :class="{ active: editDraft.mealOccasion && editDraft.mealOccasion.includes(occasion) }"
            @click="toggleMealOccasion(occasion)"
          >
            {{ t(`meal_occasion_${occasion.toLowerCase()}`) }}
          </button>
        </div>
      </div>

      <div class="edit-section edit-ingredients">
        <div class="manual-list-wrap">
          <div class="manual-list-header">
            <span class="sec-label">{{ t('detail_ingredients') }}</span>
          </div>
          <div class="manual-list-items">
            <div v-for="(ingredient, index) in editDraft.ingredients" :key="`edit-ingredient-${index}`" class="manual-list-item">
              <input v-model="editDraft.ingredients[index]" type="text" :placeholder="t('manual_ingredient_placeholder', { n: index + 1 })" />
              <div class="manual-item-actions">
                <button class="btn-move" :title="t('manual_move_up')" :disabled="index === 0" @click="moveDraftIngredient(index, -1)">↑</button>
                <button class="btn-move" :title="t('manual_move_down')" :disabled="index === editDraft.ingredients.length - 1" @click="moveDraftIngredient(index, 1)">↓</button>
                <button class="btn-remove" :disabled="editDraft.ingredients.length <= 1" @click="removeDraftIngredient(index)" :title="t('manual_remove_item')">🗑</button>
              </div>
            </div>
          </div>
          <div class="manual-list-footer">
            <button class="btn-add" @click="addDraftIngredient">+ {{ t('manual_add_ingredient') }}</button>
          </div>
        </div>
      </div>

      <div class="edit-section edit-steps">
        <div class="manual-list-wrap">
          <div class="manual-list-header">
            <span class="sec-label">{{ t('detail_steps') }}</span>
          </div>
          <div class="manual-list-items">
            <div v-for="(step, index) in editDraft.steps" :key="`edit-step-${index}`" class="manual-list-item manual-list-item-step">
              <textarea v-model="editDraft.steps[index]" rows="2" :placeholder="t('manual_step_placeholder', { n: index + 1 })"></textarea>
              <div class="manual-item-actions">
                <button class="btn-move" :title="t('manual_move_up')" :disabled="index === 0" @click="moveDraftStep(index, -1)">↑</button>
                <button class="btn-move" :title="t('manual_move_down')" :disabled="index === editDraft.steps.length - 1" @click="moveDraftStep(index, 1)">↓</button>
                <button class="btn-remove" :disabled="editDraft.steps.length <= 1" @click="removeDraftStep(index)" :title="t('manual_remove_item')">🗑</button>
              </div>
            </div>
          </div>
          <div class="manual-list-footer">
            <button class="btn-add" @click="addDraftStep">+ {{ t('manual_add_step') }}</button>
          </div>
        </div>
      </div>

      <p v-if="editError" class="status-msg err">{{ editError }}</p>
      <div class="notes-actions recipe-edit-actions">
        <button class="btn-primary" @click="submitEdit">{{ t('recipe_edit_save') }}</button>
        <button class="btn-ghost" @click="cancelEdit">{{ t('recipe_edit_cancel') }}</button>
      </div>
    </div>
    <div v-if="savedMode && !isEditing" class="notes-box card">
      <div class="sec-label">{{ t('recipe_notes') }}</div>
      <textarea v-model="noteDraft" class="notes-textarea" :placeholder="t('recipe_notes_placeholder')"></textarea>
      <div class="notes-actions">
        <button class="btn-primary" @click="emit('save-notes', { recipe, notes: noteDraft })">{{ t('recipe_notes_save') }}</button>
      </div>
    </div>

    <div v-if="showQr" class="qr-overlay" role="dialog" aria-modal="true" @click.self="closeQr" @keydown.esc="closeQr">
      <div class="qr-modal card">
        <p class="qr-modal-title">{{ t('share_recipe') }}</p>
        <p class="qr-modal-name">{{ recipe.emoji || '🍴' }} {{ recipe.name }}</p>
        <img v-if="qrDataUrl" :src="qrDataUrl" class="qr-img" :alt="`QR code – ${recipe.name}`" width="240" height="240" />
        <div v-else class="qr-placeholder">…</div>
        <p class="qr-modal-hint">{{ t('share_qr_hint') }}</p>
        <input
          v-if="qrModalUrl"
          type="text"
          readonly
          :value="qrModalUrl"
          class="qr-url-input"
          :aria-label="t('share_recipe')"
          @click="($event.target).select()"
        />
        <div class="qr-modal-actions">
          <button class="btn-secondary" type="button" @click="copyQrLink">
            {{ qrCopyStatus === 'ok' ? t('share_copy_ok') : t('share_qr_copy') }}
          </button>
          <button class="btn-ghost" type="button" @click="closeQr">{{ t('share_qr_close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 0;
}

.detail-quick-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.detail-quick-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card-bg, var(--bg));
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.detail-quick-btn:hover {
  background: var(--hover-bg, rgba(0,0,0,0.06));
  color: var(--text);
}

.detail-quick-fav.is-fav {
  color: var(--accent, #e8a020);
}

.detail-quick-del:hover {
  color: var(--danger, #d9534f);
  border-color: var(--danger, #d9534f);
}

.qr-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.qr-modal {
  width: min(320px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  text-align: center;
}

.qr-modal-title {
  font-weight: 700;
  font-size: 1rem;
  margin: 0;
  color: var(--text);
}

.qr-modal-name {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin: 0;
}

.qr-img {
  display: block;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.qr-placeholder {
  width: 240px;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-hint);
  font-size: 2rem;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.qr-modal-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

.qr-url-input {
  width: 100%;
  font-size: 0.72rem;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-secondary, var(--bg));
  color: var(--text-muted);
  cursor: text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qr-modal-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.qr-modal-actions button {
  flex: 1;
  min-width: 100px;
  min-height: 40px;
}

.imported-info-wrap {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.imported-tip {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.imported-tip-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.imported-tip-text {
  font-size: 0.9rem;
  color: var(--text);
  line-height: 1.5;
}

/* ── Nutrition section ── */
.nutrition-wrap {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nutrition-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nutrition-header .sec-label {
  margin: 0;
}

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

.nutrition-partial-note {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

.nutrition-footer {
  display: flex;
}

.nutrition-footer button {
  flex: 1;
}

.nutrition-transparency {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

.nutrition-sources {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0;
}

.nutrition-no-macros-note {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0 0 4px;
  font-style: italic;
}

.nutrition-stale-warning {
  font-size: 0.78rem;
  color: var(--color-warn, #b45309);
  background: var(--color-warn-bg, #fef3c7);
  border-radius: 6px;
  padding: 4px 8px;
  margin: 4px 0;
}

.nutrition-donut--loading {
  background: conic-gradient(var(--border, #e0e0e0) 0% 100%);
}

.nutrition-spinner {
  display: block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border, #e0e0e0);
  border-top-color: var(--color-accent, #43a047);
  border-radius: 50%;
  animation: nutrition-spin 0.8s linear infinite;
}

@keyframes nutrition-spin {
  to { transform: rotate(360deg); }
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
