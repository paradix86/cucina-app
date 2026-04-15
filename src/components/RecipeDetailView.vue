<script setup>
import { computed, ref, watch } from 'vue';
import { buildStepsHtml, formatTimerLabel, getPreparationInfo, getSourceDomainLabel, joinMetaParts, scaleIngredients } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';

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
]);

const servings = ref(parseInt(props.recipe.servings, 10) || 4);
const noteDraft = ref(props.recipe.notes || '');

watch(() => props.recipe, recipe => {
  servings.value = parseInt(recipe.servings, 10) || 4;
  noteDraft.value = recipe.notes || '';
}, { immediate: true });

const prepInfo = computed(() => getPreparationInfo(props.recipe));
const scaledIngredients = computed(() => scaleIngredients(props.recipe.ingredients || [], parseInt(props.recipe.servings, 10) || 4, servings.value));
const steps = computed(() => buildStepsHtml(props.recipe.steps || [], prepInfo.value.type));

function changeServings(delta) {
  servings.value = Math.max(1, Math.min(20, servings.value + delta));
}
</script>

<template>
  <div>
    <button class="detail-back" @click="emit('back')">{{ backLabel || t('detail_back') }}</button>
    <div class="detail-wrap">
      <h2 class="detail-title">{{ recipe.emoji || '🍴' }} {{ recipe.name }}</h2>
      <p class="detail-meta">{{ joinMetaParts([recipe.category, recipe.time, recipe.difficolta]) }}</p>
      <p class="detail-method"><span class="sec-label-inline">{{ t('detail_method') }}:</span> {{ prepInfo.txt }}</p>
      <p v-if="recipe.sourceDomain" class="detail-origin"><span class="sec-label-inline">{{ t('detail_source_site') }}:</span> {{ getSourceDomainLabel(recipe.sourceDomain) }}</p>

      <div class="servings-ctrl">
        <span class="sec-label">{{ t('detail_servings') }}</span>
        <div class="servings-row">
          <button class="servings-btn" aria-label="−" @click="changeServings(-1)">−</button>
          <span id="servings-val">{{ servings }}</span>
          <button class="servings-btn" aria-label="+" @click="changeServings(1)">+</button>
        </div>
      </div>

      <div class="sec-label" style="margin-top:1rem">{{ t('detail_ingredients') }}</div>
      <ul class="ing-list">
        <li v-for="ingredient in scaledIngredients" :key="ingredient">{{ ingredient }}</li>
      </ul>
      <div style="margin-top:0.8rem">
        <button class="btn-shopping" @click="emit('add-to-shopping', recipe)">🛒 {{ t('shopping_add') }}</button>
      </div>

      <div class="sec-label" style="margin-top:1rem">{{ prepInfo.type === 'bimby' ? t('detail_steps_bimby') : t('detail_steps') }}</div>
      <template v-for="step in steps" :key="`${step.index}-${step.text}`">
        <div v-if="step.type === 'bimby'" class="bimby-step">
          <div class="bimby-step-tags">
            <span v-for="tag in step.tags" :key="tag" class="bimby-tag">{{ tag }}</span>
          </div>
          <p>{{ step.index }}. {{ step.text }}</p>
        </div>
        <div v-else class="step-row">
          <span class="step-n">{{ step.index }}</span>
          <p class="step-txt">{{ step.text }}</p>
        </div>
      </template>

      <button class="btn-cooking" @click="emit('start-cooking', recipe)">{{ t('cooking_start') }}</button>
      <a v-if="recipe.url" :href="recipe.url" class="orig-link" target="_blank" rel="noopener">{{ t('detail_open_source') }}</a>
      <div class="detail-actions">
        <button v-if="recipe.timerMinutes > 0" class="btn-primary" @click="emit('start-recipe-timer', recipe)">
          {{ t('detail_timer_btn', { t: formatTimerLabel(recipe.timerMinutes) }) }}
        </button>
        <button v-if="canSaveBuiltin" class="btn-primary" @click="emit('save-builtin', recipe)">{{ t('builtin_save') }}</button>
        <button v-if="savedMode" class="btn-secondary" @click="emit('toggle-favorite', recipe)">
          {{ recipe.favorite ? t('favorite_remove') : t('favorite_add') }}
        </button>
      </div>
    </div>
    <div v-if="savedMode" class="notes-box card">
      <div class="sec-label">{{ t('recipe_notes') }}</div>
      <textarea v-model="noteDraft" class="notes-textarea" :placeholder="t('recipe_notes_placeholder')"></textarea>
      <div class="notes-actions">
        <button class="btn-primary" @click="emit('save-notes', { recipe, notes: noteDraft })">{{ t('recipe_notes_save') }}</button>
      </div>
    </div>
  </div>
</template>
