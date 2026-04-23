<script setup>
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { buildStepsHtml, formatTimerLabel, getPreparationInfo, getSourceDomainLabel, joinMetaParts, scaleIngredients, suggestMealOccasions } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';
import { useShoppingListStore } from '../stores/shoppingList';

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
  'save-notes',
  'duplicate-recipe',
  'save-recipe-edit',
]);

const shoppingStore = useShoppingListStore();
const { items: shoppingItems } = storeToRefs(shoppingStore);

const servings = ref(parseInt(props.recipe.servings, 10) || 4);
const noteDraft = ref(props.recipe.notes || '');
const isEditing = ref(false);
const editError = ref('');
const prepOptions = ['classic', 'bimby', 'airfryer'];
const mealOccasionOptions = ['Colazione', 'Pranzo', 'Cena', 'Spuntino'];
const editDraft = ref(buildEditDraft(props.recipe));

watch(() => props.recipe, recipe => {
  servings.value = parseInt(recipe.servings, 10) || 4;
  noteDraft.value = recipe.notes || '';
  if (!isEditing.value) {
    editDraft.value = buildEditDraft(recipe);
  }
}, { immediate: true });

const prepInfo = computed(() => getPreparationInfo(props.recipe));
const scaledIngredients = computed(() => scaleIngredients(props.recipe.ingredients || [], parseInt(props.recipe.servings, 10) || 4, servings.value));
const steps = computed(() => buildStepsHtml(props.recipe.steps || [], prepInfo.value.type));
const hasShoppingContributions = computed(() => {
  if (!props.recipe?.id) return false;
  return shoppingItems.value.some(item => item.sourceRecipeId === props.recipe.id);
});
const shoppingActionLabel = computed(() => (hasShoppingContributions.value ? t('shopping_remove_from_recipe') : t('shopping_add')));

function changeServings(delta) {
  servings.value = Math.max(1, Math.min(20, servings.value + delta));
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
  const updates = {
    name,
    category: editDraft.value.category.trim(),
    servings: String(editDraft.value.servings || '').trim(),
    time: editDraft.value.time.trim(),
    emoji: editDraft.value.emoji.trim() || '🍴',
    preparationType: prepOptions.includes(editDraft.value.preparationType) ? editDraft.value.preparationType : 'classic',
    timerMinutes: Number.isFinite(timerMinutes) && timerMinutes > 0 ? timerMinutes : 0,
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
</script>

<template>
  <div>
    <button class="detail-back" @click="emit('back')">{{ backLabel || t('detail_back') }}</button>
    <div v-if="!isEditing" class="detail-wrap">
      <div class="detail-head">
        <div v-if="recipe.coverImageUrl" class="detail-cover-wrap">
          <img class="detail-cover-img" :src="recipe.coverImageUrl" :alt="recipe.name" loading="lazy" decoding="async" />
        </div>
        <h2 class="detail-title">{{ recipe.emoji || '🍴' }} {{ recipe.name }}</h2>
        <p class="detail-meta">{{ joinMetaParts([recipe.category, recipe.time, recipe.difficolta]) }}</p>
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

      <div class="detail-actions-shell">
        <div class="detail-action-primary">
          <button class="btn-start-cooking" @click="emit('start-cooking', recipe)">{{ t('cooking_start') }}</button>
        </div>

        <div class="detail-actions detail-actions-secondary-tier">
          <button class="btn-secondary detail-action-shopping" @click="onShoppingAction">{{ shoppingActionLabel }}</button>
          <button v-if="recipe.timerMinutes" class="btn-secondary" @click="emit('start-recipe-timer', recipe)">
            {{ t('detail_timer_btn', { t: formatTimerLabel(recipe.timerMinutes) }) }}
          </button>
          <button
            v-if="savedMode"
            class="btn-secondary btn-favorite"
            :class="{ active: recipe.favorite }"
            @click="emit('toggle-favorite', recipe)"
            type="button"
          >
            <span class="button-icon">★</span>
            {{ recipe.favorite ? t('favorite_remove') : t('favorite_add') }}
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
  </div>
</template>
