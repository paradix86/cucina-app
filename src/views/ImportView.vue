<script setup>
import { computed } from 'vue';
import { useImportFlow } from '../composables/useImportFlow.js';
import { getSourceDomainLabel, joinMetaParts } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';

const emit = defineEmits(['toast', 'go-home']);
const { url, loading, status, diagnostic, previewRecipe, importRecipeFromUrl, updatePreparationType, savePreviewedRecipe, discardPreview, removeTag, addTag } = useImportFlow();

const prepOptions = ['classic', 'bimby', 'airfryer'];
const previewIngredients = computed(() => Array.isArray(previewRecipe.value?.ingredients) ? previewRecipe.value.ingredients : []);
const previewSteps = computed(() => Array.isArray(previewRecipe.value?.steps) ? previewRecipe.value.steps : []);
const previewMeta = computed(() => {
  if (!previewRecipe.value) return '';
  return joinMetaParts([
    previewRecipe.value.category,
    previewRecipe.value.time,
    previewRecipe.value.servings ? `${previewRecipe.value.servings} ${t('detail_servings').toLowerCase()}` : '',
    previewRecipe.value.difficolta,
  ]);
});

async function submit() {
  await importRecipeFromUrl();
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
    <div class="import-box card">
      <h2>{{ t('import_title') }}</h2>
      <p class="muted-label" style="margin-bottom:12px">{{ t('import_desc') }}</p>
      <div class="source-pills">
        <span class="src-pill yt">YouTube</span>
        <span class="src-pill tt">TikTok</span>
        <span class="src-pill ig">Instagram</span>
        <span class="src-pill web">Web</span>
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
