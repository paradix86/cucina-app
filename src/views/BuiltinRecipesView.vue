<script setup>
import { computed, ref } from 'vue';
import RecipeDetailView from '../components/RecipeDetailView.vue';
import { BUILTIN_RECIPES } from '../lib/builtinData.js';
import { useRecipeBook } from '../composables/useRecipeBook.js';
import { getPreparationType } from '../lib/storage.js';
import { getPreparationInfo, highlight, parseRecipeTime, recipeMatchesQuery, joinMetaParts } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';

const emit = defineEmits(['start-recipe-timer', 'start-cooking', 'add-to-shopping', 'toast', 'go-home']);

const search = ref('');
const selectedCategory = ref('__all__');
const selectedPrep = ref('all');
const maxTime = ref(120);
const selectedRecipe = ref(null);
const recipeBook = useRecipeBook();

const categories = computed(() => ['__all__', ...new Set(BUILTIN_RECIPES.map(recipe => recipe.category))]);
const filteredRecipes = computed(() => BUILTIN_RECIPES
  .filter(recipe => recipeMatchesQuery(recipe, search.value.trim()))
  .filter(recipe => selectedCategory.value === '__all__' || recipe.category === selectedCategory.value)
  .filter(recipe => selectedPrep.value === 'all' || getPreparationType(recipe) === selectedPrep.value)
  .filter(recipe => parseRecipeTime(recipe.time) <= maxTime.value));
const resultsLabel = computed(() => filteredRecipes.value.length < BUILTIN_RECIPES.length ? t('results_showing', { n: filteredRecipes.value.length, total: BUILTIN_RECIPES.length }) : '');

function resetFilters() {
  search.value = '';
  selectedCategory.value = '__all__';
  selectedPrep.value = 'all';
  maxTime.value = 120;
}

function saveBuiltin(recipe) {
  const ok = recipeBook.add({ ...recipe });
  emit('toast', ok ? t('builtin_saved_ok') : t('builtin_already_saved'), ok ? 'success' : 'info');
  if (ok) {
    emit('go-home');
  }
}

defineExpose({
  goHome() {
    selectedRecipe.value = null;
  },
});
</script>

<template>
  <section class="panel active">
    <div v-if="!selectedRecipe">
      <div id="builtin-toolbar">
        <div class="saved-header">
          <input v-model="search" type="text" :placeholder="t('builtin_search')" />
        </div>
        <div id="builtin-cats" class="filter-row source-pills">
          <button v-for="category in categories" :key="category" class="src-pill" :class="{ active: selectedCategory === category }" @click="selectedCategory = category">
            {{ category === '__all__' ? t('builtin_filter_all') : category }}
          </button>
        </div>
        <div id="builtin-filters">
          <div class="filter-row">
            <span class="filter-label">{{ t('filter_method') }}:</span>
            <button class="src-pill" :class="{ active: selectedPrep === 'all' }" @click="selectedPrep = 'all'">{{ t('filter_all') }}</button>
            <button class="src-pill" :class="{ active: selectedPrep === 'classic' }" @click="selectedPrep = 'classic'">{{ t('filter_classic') }}</button>
            <button class="src-pill" :class="{ active: selectedPrep === 'bimby' }" @click="selectedPrep = 'bimby'">{{ t('filter_bimby') }}</button>
            <button class="src-pill" :class="{ active: selectedPrep === 'airfryer' }" @click="selectedPrep = 'airfryer'">{{ t('filter_airfryer') }}</button>
          </div>
          <div class="filter-row time-slider-row">
            <span class="filter-label">{{ t('filter_max_time') }}:</span>
            <input v-model="maxTime" type="range" min="5" max="120" step="5" />
            <span id="time-val">{{ maxTime >= 120 ? t('filter_any_time') : `${maxTime} ${t('minutes_short')}` }}</span>
          </div>
          <button v-if="search || selectedCategory !== '__all__' || selectedPrep !== 'all' || maxTime < 120" class="reset-filters" @click="resetFilters">{{ t('filter_reset') }}</button>
        </div>
        <div id="builtin-results-count" class="results-count">{{ resultsLabel }}</div>
      </div>
      <div v-if="!filteredRecipes.length" class="ricette-grid" id="builtin-grid">
        <p class="empty">{{ t('recipebook_notfound') }}</p>
      </div>
      <div v-else class="ricette-grid" id="builtin-grid">
        <div v-for="recipe in filteredRecipes" :key="recipe.id" class="ricetta-card" :class="getPreparationInfo(recipe).cardCls" @click="selectedRecipe = recipe">
          <span class="card-src" :class="getPreparationInfo(recipe).cls">{{ getPreparationInfo(recipe).txt }}</span>
          <div class="card-name" v-html="highlight(recipe.name || '', search.trim())"></div>
          <div class="card-meta">{{ joinMetaParts([recipe.category, recipe.time, `${recipe.servings} ${t('detail_servings').toLowerCase()}`]) }}</div>
        </div>
      </div>
    </div>
    <div v-else id="builtin-detail">
      <RecipeDetailView
        :recipe="selectedRecipe"
        :can-save-builtin="true"
        @back="selectedRecipe = null"
        @save-builtin="saveBuiltin"
        @start-recipe-timer="emit('start-recipe-timer', $event)"
        @start-cooking="emit('start-cooking', $event)"
        @add-to-shopping="emit('add-to-shopping', $event)"
      />
    </div>
  </section>
</template>
