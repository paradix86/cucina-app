<script setup>
import { computed, ref } from 'vue';
import { useImportFlow } from '../composables/useImportFlow';
import { getSourceDomainLabel, joinMetaParts } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';
import { useRecipeBookStore } from '../stores/recipeBook';
import { DUEMME_RECIPE_PACK } from '../lib/duemmePack';

const emit = defineEmits(['toast', 'go-home']);
const { url, loading, status, diagnostic, previewRecipe, importRecipeFromUrl, updatePreparationType, savePreviewedRecipe, discardPreview, removeTag, addTag } = useImportFlow();
const recipeBookStore = useRecipeBookStore();

const prepOptions = ['classic', 'bimby', 'airfryer'];
const showManualForm = ref(false);
const showCollectionBrowser = ref(false);
const selectedCollectionIds = ref([]);
const selectedCollectionId = ref('');
const previewIngredients = computed(() => Array.isArray(previewRecipe.value?.ingredients) ? previewRecipe.value.ingredients : []);
const previewSteps = computed(() => Array.isArray(previewRecipe.value?.steps) ? previewRecipe.value.steps : []);
const collectionRecipes = computed(() => DUEMME_RECIPE_PACK);
const collectionSelectedCount = computed(() => selectedCollectionIds.value.length);
const selectedCollectionRecipe = computed(() => {
  if (!selectedCollectionId.value) return collectionRecipes.value[0] || null;
  return collectionRecipes.value.find(recipe => recipe.id === selectedCollectionId.value) || null;
});
const collectionPreviewMeta = computed(() => {
  if (!selectedCollectionRecipe.value) return '';
  return joinMetaParts([
    selectedCollectionRecipe.value.category,
    selectedCollectionRecipe.value.time,
    selectedCollectionRecipe.value.servings ? `${selectedCollectionRecipe.value.servings} ${t('detail_servings').toLowerCase()}` : '',
    selectedCollectionRecipe.value.difficolta,
  ]);
});
const previewMeta = computed(() => {
  if (!previewRecipe.value) return '';
  return joinMetaParts([
    previewRecipe.value.category,
    previewRecipe.value.time,
    previewRecipe.value.servings ? `${previewRecipe.value.servings} ${t('detail_servings').toLowerCase()}` : '',
    previewRecipe.value.difficolta,
  ]);
});

const manualForm = ref(buildManualForm());

function buildManualForm() {
  return {
    name: '',
    category: '',
    servings: '',
    time: '',
    emoji: '',
    preparationType: 'classic',
    timerMinutes: '',
    ingredients: [''],
    steps: [''],
  };
}

async function submit() {
  await importRecipeFromUrl();
}

function openManualForm() {
  showManualForm.value = true;
}

function closeManualForm() {
  showManualForm.value = false;
}

function openCollectionBrowser() {
  showCollectionBrowser.value = true;
  if (!selectedCollectionId.value && collectionRecipes.value.length) {
    selectedCollectionId.value = collectionRecipes.value[0].id;
  }
}

function closeCollectionBrowser() {
  showCollectionBrowser.value = false;
}

function toggleCollectionSelection(recipeId) {
  if (selectedCollectionIds.value.includes(recipeId)) {
    selectedCollectionIds.value = selectedCollectionIds.value.filter(id => id !== recipeId);
    return;
  }
  selectedCollectionIds.value = [...selectedCollectionIds.value, recipeId];
}

function selectAllCollectionRecipes() {
  selectedCollectionIds.value = collectionRecipes.value.map(recipe => recipe.id);
}

function clearCollectionSelection() {
  selectedCollectionIds.value = [];
}

function importSelectedCollectionRecipes() {
  if (!selectedCollectionIds.value.length) return;
  let added = 0;
  selectedCollectionIds.value.forEach(recipeId => {
    const recipe = collectionRecipes.value.find(item => item.id === recipeId);
    if (recipeBookStore.add(recipe)) added += 1;
  });
  emit('toast', added ? t('guide_pack_import_ok', { n: added }) : t('guide_pack_import_none'), added ? 'success' : 'info');
  if (added) {
    selectedCollectionIds.value = [];
    emit('go-home');
  }
}

function addIngredientField() {
  manualForm.value.ingredients.push('');
}

function removeIngredientField(index) {
  if (manualForm.value.ingredients.length <= 1) return;
  manualForm.value.ingredients.splice(index, 1);
}

function moveIngredientField(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= manualForm.value.ingredients.length) return;
  const next = [...manualForm.value.ingredients];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  manualForm.value.ingredients = next;
}

function addStepField() {
  manualForm.value.steps.push('');
}

function removeStepField(index) {
  if (manualForm.value.steps.length <= 1) return;
  manualForm.value.steps.splice(index, 1);
}

function moveStepField(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= manualForm.value.steps.length) return;
  const next = [...manualForm.value.steps];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  manualForm.value.steps = next;
}

function saveManualRecipe() {
  const name = manualForm.value.name.trim();
  const ingredients = manualForm.value.ingredients.map(item => item.trim()).filter(Boolean);
  const steps = manualForm.value.steps.map(item => item.trim()).filter(Boolean);
  if (!name) {
    emit('toast', t('manual_validation_name'), 'error');
    return;
  }
  if (!ingredients.length) {
    emit('toast', t('manual_validation_ingredients'), 'error');
    return;
  }
  if (!steps.length) {
    emit('toast', t('manual_validation_steps'), 'error');
    return;
  }
  const timerMinutes = parseInt(manualForm.value.timerMinutes, 10);
  const recipe = {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    category: manualForm.value.category.trim(),
    servings: String(manualForm.value.servings || '').trim(),
    time: manualForm.value.time.trim(),
    emoji: manualForm.value.emoji.trim() || '🍴',
    preparationType: prepOptions.includes(manualForm.value.preparationType) ? manualForm.value.preparationType : 'classic',
    source: 'manual',
    ingredients,
    steps,
    timerMinutes: Number.isFinite(timerMinutes) && timerMinutes > 0 ? timerMinutes : 0,
    tags: [],
  };
  const ok = recipeBookStore.add(recipe);
  if (!ok) {
    emit('toast', t('manual_saved_err'), 'error');
    return;
  }
  emit('toast', t('manual_saved_ok'), 'success');
  manualForm.value = buildManualForm();
  showManualForm.value = false;
  emit('go-home');
}

function savePreview() {
  const ok = savePreviewedRecipe();
  emit('toast', ok ? t('builtin_saved_ok') : t('builtin_already_saved'), ok ? 'success' : 'info');
  if (ok) {
    emit('go-home');
  }
}
</script>

<template>
  <section class="panel active">
    <div class="import-shell">
      <div class="import-box card">
        <h2>{{ t('import_section_link_title') }}</h2>
        <p class="muted-label import-section-subtitle">{{ t('import_section_link_desc') }}</p>
        <div class="source-pills source-pills-static">
          <span class="src-pill web">ricetteperbimby.it</span>
          <span class="src-pill web">giallozafferano.it</span>
          <span class="src-pill web">{{ t('source_web') }}</span>
        </div>
        <div class="url-row">
          <input v-model="url" type="url" :placeholder="t('import_placeholder')" />
          <button class="btn-primary" id="btn-import-go" :disabled="loading" @click="submit">{{ t('import_btn') }}</button>
        </div>
        <div class="status-msg" :class="status.type">{{ status.message }}</div>
        <div v-if="diagnostic" class="import-diagnostics" style="display:block" aria-live="polite">
          <div class="import-diagnostics-title">{{ t('import_diag_title') }}</div>
          <div class="import-diagnostics-item"><span class="import-diagnostics-label">{{ t('import_diag_domain') }}:</span> <span class="import-diagnostics-value">{{ diagnostic.domain }}</span></div>
          <div class="import-diagnostics-item"><span class="import-diagnostics-label">{{ t('import_diag_adapter') }}:</span> <span class="import-diagnostics-value">{{ diagnostic.adapter }}</span></div>
          <div class="import-diagnostics-item"><span class="import-diagnostics-label">{{ t('import_diag_stage') }}:</span> <span class="import-diagnostics-value">{{ diagnostic.stage }}</span></div>
          <div class="import-diagnostics-item"><span class="import-diagnostics-label">{{ t('import_diag_reason') }}:</span> <span class="import-diagnostics-value">{{ diagnostic.reason }}</span></div>
          <details v-if="diagnostic.hint" class="import-diagnostics-hint">
            <summary>{{ t('import_diag_hint') }}</summary>
            <div class="import-diagnostics-hint-body">{{ diagnostic.hint }}</div>
          </details>
        </div>
      </div>

      <div class="card import-flow-card">
        <div class="import-flow-head">
          <div>
            <h2>{{ t('import_section_manual_title') }}</h2>
            <p class="muted-label import-section-subtitle">{{ t('import_section_manual_desc') }}</p>
          </div>
          <button class="btn-secondary" id="manual-open" @click="openManualForm">{{ t('import_section_manual_btn') }}</button>
        </div>
        <div v-if="showManualForm" class="manual-form-wrap">
          <div class="manual-form-top-actions">
            <button class="btn-ghost" id="manual-close" @click="closeManualForm">{{ t('import_section_manual_close') }}</button>
          </div>
          <h3 class="manual-form-title">{{ t('manual_title') }}</h3>
          <p class="muted-label" style="margin-bottom:12px">{{ t('manual_desc') }}</p>
          <div class="manual-grid">
            <div class="manual-field">
              <label for="manual-name">{{ t('manual_name_label') }}</label>
              <input id="manual-name" v-model="manualForm.name" type="text" :placeholder="t('manual_name_placeholder')" />
            </div>
            <div class="manual-field">
              <label for="manual-category">{{ t('manual_category_label') }}</label>
              <input id="manual-category" v-model="manualForm.category" type="text" :placeholder="t('manual_category_placeholder')" />
            </div>
            <div class="manual-field">
              <label for="manual-servings">{{ t('manual_servings_label') }}</label>
              <input id="manual-servings" v-model="manualForm.servings" type="number" min="1" max="20" />
            </div>
            <div class="manual-field">
              <label for="manual-time">{{ t('manual_time_label') }}</label>
              <input id="manual-time" v-model="manualForm.time" type="text" :placeholder="t('manual_time_placeholder')" />
            </div>
            <div class="manual-field">
              <label for="manual-emoji">{{ t('manual_emoji_label') }}</label>
              <input id="manual-emoji" v-model="manualForm.emoji" type="text" maxlength="4" :placeholder="t('manual_emoji_placeholder')" />
            </div>
            <div class="manual-field">
              <label for="manual-preparation">{{ t('manual_prep_label') }}</label>
              <select id="manual-preparation" v-model="manualForm.preparationType">
                <option v-for="prep in prepOptions" :key="prep" :value="prep">{{ t(`prep_${prep}`) }}</option>
              </select>
            </div>
            <div class="manual-field">
              <label for="manual-timer">{{ t('manual_timer_label') }}</label>
              <input id="manual-timer" v-model="manualForm.timerMinutes" type="number" min="0" step="1" :placeholder="t('manual_timer_placeholder')" />
            </div>
          </div>
          <div class="manual-list-wrap">
            <div class="manual-list-header">
              <span class="sec-label">{{ t('detail_ingredients') }}</span>
              <button class="btn-ghost" id="manual-add-ingredient" @click="addIngredientField">{{ t('manual_add_ingredient') }}</button>
            </div>
            <div class="manual-list-items">
              <div v-for="(ingredient, index) in manualForm.ingredients" :key="`ingredient-${index}`" class="manual-list-item">
                <input v-model="manualForm.ingredients[index]" type="text" :placeholder="t('manual_ingredient_placeholder', { n: index + 1 })" />
                <div class="manual-item-actions">
                  <button class="btn-ghost btn-reorder" :title="t('manual_move_up')" :disabled="index === 0" @click="moveIngredientField(index, -1)">↑</button>
                  <button class="btn-ghost btn-reorder" :title="t('manual_move_down')" :disabled="index === manualForm.ingredients.length - 1" @click="moveIngredientField(index, 1)">↓</button>
                  <button class="btn-danger" :disabled="manualForm.ingredients.length <= 1" @click="removeIngredientField(index)">{{ t('manual_remove_item') }}</button>
                </div>
              </div>
            </div>
          </div>
          <div class="manual-list-wrap">
            <div class="manual-list-header">
              <span class="sec-label">{{ t('detail_steps') }}</span>
              <button class="btn-ghost" id="manual-add-step" @click="addStepField">{{ t('manual_add_step') }}</button>
            </div>
            <div class="manual-list-items">
              <div v-for="(step, index) in manualForm.steps" :key="`step-${index}`" class="manual-list-item">
                <textarea v-model="manualForm.steps[index]" rows="2" :placeholder="t('manual_step_placeholder', { n: index + 1 })"></textarea>
                <div class="manual-item-actions">
                  <button class="btn-ghost btn-reorder" :title="t('manual_move_up')" :disabled="index === 0" @click="moveStepField(index, -1)">↑</button>
                  <button class="btn-ghost btn-reorder" :title="t('manual_move_down')" :disabled="index === manualForm.steps.length - 1" @click="moveStepField(index, 1)">↓</button>
                  <button class="btn-danger" :disabled="manualForm.steps.length <= 1" @click="removeStepField(index)">{{ t('manual_remove_item') }}</button>
                </div>
              </div>
            </div>
          </div>
          <div class="manual-actions">
            <button id="manual-save" class="btn-primary" @click="saveManualRecipe">{{ t('manual_save') }}</button>
          </div>
        </div>
      </div>

      <div class="card import-flow-card">
        <div class="import-flow-head">
          <div>
            <h2>{{ t('import_section_collections_title') }}</h2>
            <p class="muted-label import-section-subtitle">{{ t('import_section_collections_desc') }}</p>
          </div>
          <button class="btn-secondary" id="collection-open" @click="openCollectionBrowser">{{ t('import_section_collections_browse') }}</button>
        </div>
      </div>
    </div>

    <div v-if="showCollectionBrowser" class="card collection-browser">
      <div class="collection-browser-top">
        <div>
          <h3>{{ t('import_collection_title') }}</h3>
          <p class="muted-label">{{ t('import_collection_desc') }}</p>
        </div>
        <button class="btn-ghost" @click="closeCollectionBrowser">{{ t('import_collection_close') }}</button>
      </div>
      <div class="collection-browser-grid">
        <div class="collection-list">
          <div class="collection-list-actions">
            <button class="btn-ghost" @click="selectAllCollectionRecipes">{{ t('import_collection_select_all') }}</button>
            <button class="btn-ghost" @click="clearCollectionSelection">{{ t('import_collection_clear') }}</button>
          </div>
          <div class="collection-list-items">
            <label
              v-for="recipe in collectionRecipes"
              :key="recipe.id"
              class="collection-item"
              :class="{ active: selectedCollectionId === recipe.id }"
            >
              <input
                type="checkbox"
                :checked="selectedCollectionIds.includes(recipe.id)"
                @change="toggleCollectionSelection(recipe.id)"
              />
              <button class="collection-item-main" @click="selectedCollectionId = recipe.id">
                <span class="collection-item-name">{{ recipe.name }}</span>
                <span class="collection-item-meta">{{ joinMetaParts([recipe.category, recipe.time]) }}</span>
              </button>
            </label>
          </div>
        </div>
        <div v-if="selectedCollectionRecipe" class="collection-preview">
          <h4>{{ selectedCollectionRecipe.emoji || '🍴' }} {{ selectedCollectionRecipe.name }}</h4>
          <p class="muted-label">{{ collectionPreviewMeta }}</p>
          <div class="sec-label">{{ t('detail_ingredients') }}</div>
          <ul class="ing-list collection-preview-list">
            <li v-for="ingredient in selectedCollectionRecipe.ingredients" :key="ingredient">{{ ingredient }}</li>
          </ul>
          <div class="sec-label" style="margin-top:1rem">{{ t('detail_steps') }}</div>
          <div class="collection-preview-steps">
            <div v-for="(step, index) in selectedCollectionRecipe.steps" :key="`${selectedCollectionRecipe.id}-${index}`" class="step-row">
              <span class="step-n">{{ index + 1 }}</span>
              <p class="step-txt">{{ step }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="collection-browser-bottom">
        <span class="muted-label">{{ t('import_collection_selected', { n: collectionSelectedCount }) }}</span>
        <div class="collection-browser-actions">
          <button class="btn-primary" :disabled="!collectionSelectedCount" @click="importSelectedCollectionRecipes">{{ t('import_collection_import') }}</button>
        </div>
      </div>
    </div>

    <div v-if="previewRecipe" class="preview-box card" style="display:block">
      <h3 id="preview-title">{{ previewRecipe.emoji || '🍴' }} {{ previewRecipe.name }}</h3>
      <p id="preview-meta" class="muted-label" style="margin-bottom:12px">{{ previewMeta }}</p>
      <div class="preview-metadata">
        <div v-if="previewRecipe.sourceDomain" class="preview-meta-row">
          <span class="preview-meta-label">{{ t('import_source_site') }}:</span>
          <span class="preview-meta-value">{{ getSourceDomainLabel(previewRecipe.sourceDomain) || previewRecipe.sourceDomain }}</span>
        </div>
        <div class="preview-meta-row">
          <span class="preview-meta-label">{{ t('import_prep_type') }}:</span>
          <div id="preview-prep-type" class="prep-type-pills">
            <button v-for="prep in prepOptions" :key="prep" class="prep-pill" :class="{ active: previewRecipe.preparationType === prep }" @click="updatePreparationType(prep)">{{ t(`prep_${prep}`) }}</button>
          </div>
        </div>
        <div class="preview-meta-row">
          <span class="preview-meta-label">{{ t('import_tags') }}:</span>
          <div id="preview-tags-container" class="preview-tags-wrap">
            <span v-for="tag in previewRecipe.tags || []" :key="tag" class="preview-tag" :data-tag="tag">
              {{ tag }}<button class="tag-remove" @click="removeTag(tag)">×</button>
            </span>
            <input id="preview-tag-input-vue" class="tag-add-input" type="text" :placeholder="t('import_tag_add_placeholder')" @keydown.enter.prevent="addTag" />
            <button class="tag-add-btn" @click="addTag">+</button>
          </div>
        </div>
      </div>
      <div class="sec-label">{{ t('detail_ingredients') }}</div>
      <ul id="preview-ing" class="ing-list">
        <li v-for="ingredient in previewIngredients" :key="ingredient">{{ ingredient }}</li>
      </ul>
      <div class="sec-label" style="margin-top:1rem">{{ t('detail_steps') }}</div>
      <div id="preview-steps">
        <div v-for="(step, index) in previewSteps" :key="`${index}-${step}`" class="step-row">
          <span class="step-n">{{ index + 1 }}</span>
          <p class="step-txt">{{ step }}</p>
        </div>
      </div>
      <div class="preview-actions">
        <button class="btn-primary" @click="savePreview">{{ t('import_save') }}</button>
        <button class="btn-ghost" @click="discardPreview">{{ t('import_discard') }}</button>
      </div>
    </div>
  </section>
</template>
