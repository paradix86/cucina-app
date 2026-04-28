<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDebounce } from '@vueuse/core';
import RecipeDetailView from '../components/RecipeDetailView.vue';
import { BUILTIN_RECIPES } from '../lib/builtinData';
import { useRecipeBookStore } from '../stores/recipeBook';
import { getPreparationType } from '../lib/ingredientUtils';
import { getPreparationInfo, getMealOccasionLabel, getSourceDomainLabel, highlight, parseRecipeTime, recipeMatchesQuery, joinMetaParts } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';

const emit = defineEmits(['start-recipe-timer', 'start-cooking', 'add-to-shopping', 'toast', 'go-home']);
const props = defineProps({
  id: { type: String, default: '' },
});
const router = useRouter();

const search = ref('');
const debouncedSearch = useDebounce(search, 180);
const selectedCategory = ref('__all__');
const selectedPrep = ref('all');
const maxTime = ref(120);
const mobileFiltersOpen = ref(false);
const recipeBook = useRecipeBookStore();

const categories = computed(() => ['__all__', ...new Set(BUILTIN_RECIPES.map(recipe => recipe.category))]);
const filteredRecipes = computed(() => BUILTIN_RECIPES
  .filter(recipe => recipeMatchesQuery(recipe, debouncedSearch.value.trim()))
  .filter(recipe => selectedCategory.value === '__all__' || recipe.category === selectedCategory.value)
  .filter(recipe => selectedPrep.value === 'all' || getPreparationType(recipe) === selectedPrep.value)
  .filter(recipe => maxTime.value >= 120 || parseRecipeTime(recipe.time) <= maxTime.value));
const resultsLabel = computed(() => filteredRecipes.value.length < BUILTIN_RECIPES.length ? t('results_showing', { n: filteredRecipes.value.length, total: BUILTIN_RECIPES.length }) : '');
const activeFilterCount = computed(() => {
  let count = 0;
  if (selectedCategory.value !== '__all__') count += 1;
  if (selectedPrep.value !== 'all') count += 1;
  if (maxTime.value < 120) count += 1;
  return count;
});

const selectedRecipeId = computed(() => {
  const id = props.id;
  if (Array.isArray(id)) return id[0] ? String(id[0]) : '';
  if (id == null) return '';
  return String(id);
});

const selectedRecipe = computed(() => {
  if (!selectedRecipeId.value) return null;
  return BUILTIN_RECIPES.find(recipe => recipe.id === selectedRecipeId.value) || null;
});

watch([selectedRecipeId, selectedRecipe], ([id, selected]) => {
  if (id && !selected) {
    router.replace('/recipes').catch(() => {});
  }
}, { immediate: true });

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

function openBuiltinDetail(recipe) {
  router.push({ name: 'recipes-detail', params: { id: recipe.id } }).catch(() => {});
}

defineExpose({
  goHome() {
    router.replace('/recipe-book').catch(() => {});
  },
});
</script>

<template>
  <section class="panel active">
    <div v-if="!selectedRecipe">
      <div class="builtin-intro">
        <h1>{{ t('builtin_title') }}</h1>
        <p class="muted-label">{{ t('builtin_desc') }}</p>
      </div>
      <div id="builtin-toolbar">
        <div class="saved-header">
          <input v-model="search" type="text" :placeholder="t('builtin_search')" />
        </div>
        <div class="saved-filter-mobile-toggle-wrap">
          <button class="btn-ghost saved-filter-mobile-toggle" :aria-expanded="mobileFiltersOpen ? 'true' : 'false'" @click="mobileFiltersOpen = !mobileFiltersOpen">
            <span>{{ mobileFiltersOpen ? t('filters_hide') : t('filters_show') }}</span>
            <span v-if="activeFilterCount" class="saved-filter-mobile-badge">{{ activeFilterCount }}</span>
          </button>
        </div>
        <div class="saved-filter-panel builtin-filter-panel mobile-collapsible" :class="{ 'is-mobile-open': mobileFiltersOpen }">
          <div class="saved-filter-content">
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
          </div>
        </div>
        <div id="builtin-results-count" class="results-count">{{ resultsLabel }}</div>
      </div>
      <div v-if="!filteredRecipes.length" class="ricette-grid" id="builtin-grid">
        <p class="empty">{{ t('recipebook_notfound') }}</p>
      </div>
      <div v-else class="ricette-grid" id="builtin-grid">
        <div v-for="recipe in filteredRecipes" :key="recipe.id" class="ricetta-card" :class="getPreparationInfo(recipe).cardCls" @click="openBuiltinDetail(recipe)">
          <span class="card-src" :class="getPreparationInfo(recipe).cls">{{ getPreparationInfo(recipe).txt }}</span>
          <div class="card-name" v-html="highlight(recipe.name || '', debouncedSearch.trim())"></div>
          <div class="card-body">
            <div class="card-meta-block">
              <div v-if="recipe.time && recipe.time !== 'n.d.'" class="card-row card-row--time">
                <span class="card-row-icon" aria-hidden="true">⏱</span>
                <span>{{ recipe.time }}</span>
              </div>
              <div v-if="recipe.mealOccasion && recipe.mealOccasion.length" class="card-row card-row--meal">
                <span class="card-row-icon" aria-hidden="true">◑</span>
                <span class="card-chips">
                  <span v-for="m in recipe.mealOccasion" :key="m" class="card-chip card-chip--meal">{{ getMealOccasionLabel(m) }}</span>
                </span>
              </div>
              <div v-if="recipe.sourceDomain" class="card-row card-row--source">
                <span class="card-row-icon" aria-hidden="true">↗</span>
                <span>{{ getSourceDomainLabel(recipe.sourceDomain) }}</span>
              </div>
              <div v-if="recipe.category" class="card-row card-row--cat">
                <span class="card-row-icon" aria-hidden="true">◈</span>
                <span>{{ recipe.category }}</span>
              </div>
            </div>
            <div class="card-tags-block" :class="{ 'is-empty': !(recipe.tags && recipe.tags.length) }">
              <div v-if="recipe.tags && recipe.tags.length" class="card-row card-row--tags">
                <span v-for="tag in recipe.tags.slice(0, 3)" :key="tag" class="card-chip card-chip--tag">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else id="builtin-detail">
      <RecipeDetailView
        :recipe="selectedRecipe"
        :can-save-builtin="true"
        @back="router.push('/recipes')"
        @save-builtin="saveBuiltin"
        @start-recipe-timer="emit('start-recipe-timer', $event)"
        @start-cooking="emit('start-cooking', $event)"
        @add-to-shopping="emit('add-to-shopping', $event)"
      />
    </div>
  </section>
</template>
