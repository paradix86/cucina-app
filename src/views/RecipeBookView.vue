<script setup>
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useDebounce } from '@vueuse/core';
import RecipeDetailView from '../components/RecipeDetailView.vue';
import { useRecipeBookStore } from '../stores/recipeBook';
import { getPreparationInfo, getSourceDomainLabel, highlight, joinMetaParts, recipeMatchesQuery } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';

const emit = defineEmits(['start-recipe-timer', 'start-cooking', 'add-to-shopping', 'toast']);
const props = defineProps({
  id: { type: String, default: '' },
});
const router = useRouter();
const store = useRecipeBookStore();
const { recipes } = storeToRefs(store);

const search = ref('');
const debouncedSearch = useDebounce(search, 180);
const sourceFilter = ref('all');
const filterType = ref('all');
const siteFilter = ref('all');

const sourceOptions = [
  ['all', () => t('filter_all')],
  ['youtube', () => t('source_youtube')],
  ['tiktok', () => t('source_tiktok')],
  ['instagram', () => t('source_instagram')],
  ['classica', () => t('source_classic')],
  ['bimby', () => t('source_bimby')],
  ['web', () => t('source_web')],
  ['manual', () => t('source_manual')],
];

const siteCounts = computed(() => recipes.value.reduce((acc, recipe) => {
  if (recipe.sourceDomain) acc[recipe.sourceDomain] = (acc[recipe.sourceDomain] || 0) + 1;
  return acc;
}, {}));

const sortedDomains = computed(() => Object.keys(siteCounts.value).sort((a, b) => getSourceDomainLabel(a).localeCompare(getSourceDomainLabel(b))));

const filteredRecipes = computed(() => {
  const query = debouncedSearch.value.trim();
  const list = recipes.value.filter(recipe => {
    const matchQuery = recipeMatchesQuery(recipe, query);
    const matchSource = sourceFilter.value === 'all' || (recipe.source || 'web') === sourceFilter.value;
    const matchType = filterType.value === 'all'
      || (filterType.value === 'favorites' && recipe.favorite)
      || (filterType.value === 'recent' && recipe.lastViewedAt);
    const matchSite = siteFilter.value === 'all' || recipe.sourceDomain === siteFilter.value;
    return matchQuery && matchSource && matchType && matchSite;
  });
  if (filterType.value === 'recent') {
    list.sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0));
  }
  return list;
});

const savedCountLabel = computed(() => recipes.value.length === 1 ? t('recipebook_saved', { n: recipes.value.length }) : t('recipebook_saved_plural', { n: recipes.value.length }));
const resultsLabel = computed(() => filteredRecipes.value.length < recipes.value.length ? t('results_showing', { n: filteredRecipes.value.length, total: recipes.value.length }) : '');

const selectedRecipeId = computed(() => {
  const id = props.id;
  if (Array.isArray(id)) return id[0] ? String(id[0]) : '';
  if (id == null) return '';
  return String(id);
});

const selectedRecipe = computed(() => {
  if (!selectedRecipeId.value) return null;
  return recipes.value.find(recipe => recipe.id === selectedRecipeId.value) || null;
});

watch([selectedRecipeId, selectedRecipe], ([id, selected]) => {
  if (id && !selected) {
    router.replace('/recipe-book').catch(() => {});
  }
}, { immediate: true });

function openDetail(recipe) {
  router.push({ name: 'recipe-book-detail', params: { id: recipe.id } }).catch(() => {});
  store.viewed(recipe.id);
}

function confirmDelete(id) {
  if (!window.confirm(t('delete_confirm'))) return;
  store.remove(id);
  if (selectedRecipeId.value === id) {
    router.replace('/recipe-book').catch(() => {});
  }
}

function onImportBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  emit('toast', t('import_loading'));
  store.importBackup(file).then(total => {
    emit('toast', t('backup_import_ok', { n: total }), 'success');
  }).catch(() => {
    emit('toast', t('backup_import_err'), 'error');
  }).finally(() => {
    event.target.value = '';
  });
}

function toggleFavorite(id) {
  store.toggleFavorite(id);
}

function saveRecipeNotes(payload) {
  if (store.saveNotes(payload.recipe.id, payload.notes)) {
    emit('toast', t('recipe_notes_saved'), 'success');
  }
}

function duplicateRecipe(recipe) {
  const duplicated = store.duplicate(recipe.id);
  if (!duplicated) {
    emit('toast', t('recipe_duplicate_err'), 'error');
    return;
  }
  emit('toast', t('recipe_duplicate_ok'), 'success');
  router.push({ name: 'recipe-book-detail', params: { id: duplicated.id } }).catch(() => {});
}

defineExpose({
  goHome() {
    store.refresh();
    router.replace('/recipe-book').catch(() => {});
  },
});
</script>

<template>
  <section class="panel active">
    <div v-if="!selectedRecipe" id="saved-list-view">
      <div class="saved-header">
        <input v-model="search" type="text" :placeholder="t('recipebook_search')" />
        <span id="saved-count" class="muted-label">{{ savedCountLabel }}</span>
      </div>
      <div class="backup-actions">
        <button class="btn-ghost" @click="store.exportBackup(); emit('toast', t('backup_export_ok'), 'success')">{{ t('backup_export') }}</button>
        <label class="btn-ghost" style="display:inline-flex;align-items:center;justify-content:center;cursor:pointer">
          {{ t('backup_import') }}
          <input hidden type="file" accept="application/json,.json" @change="onImportBackup" />
        </label>
      </div>
      <div id="saved-source-filter">
        <div class="saved-filter-group">
          <div class="filter-row">
            <button v-for="[value, label] in sourceOptions" :key="value" class="src-pill" :class="{ active: sourceFilter === value }" @click="sourceFilter = value">{{ label() }}</button>
          </div>
        </div>
        <div class="saved-filter-group">
          <div class="filter-row">
            <button class="type-pill" :class="{ active: filterType === 'all' }" @click="filterType = 'all'">{{ t('filter_all') }}</button>
            <button class="type-pill" :class="{ active: filterType === 'favorites' }" @click="filterType = 'favorites'">{{ t('filter_favorites') }}</button>
            <button class="type-pill" :class="{ active: filterType === 'recent' }" @click="filterType = 'recent'">{{ t('filter_recent') }}</button>
          </div>
        </div>
        <div v-if="sortedDomains.length" class="saved-filter-group">
          <span class="filter-group-label">{{ t('filter_site') }}:</span>
          <div class="filter-row">
            <button class="site-pill" :class="{ active: siteFilter === 'all' }" @click="siteFilter = 'all'">{{ t('filter_all_sites') }} <span class="pill-count">({{ recipes.length }})</span></button>
            <button v-for="domain in sortedDomains" :key="domain" class="site-pill" :class="{ active: siteFilter === domain }" @click="siteFilter = domain">{{ getSourceDomainLabel(domain) }} <span class="pill-count">({{ siteCounts[domain] }})</span></button>
          </div>
        </div>
      </div>
      <div id="saved-results-count" class="results-count">{{ resultsLabel }}</div>
      <div v-if="!recipes.length" class="ricette-grid" id="saved-grid">
        <p class="empty">{{ t('recipebook_empty') }}<br />{{ t('recipebook_empty_hint') }}</p>
      </div>
      <div v-else-if="!filteredRecipes.length" class="ricette-grid" id="saved-grid">
        <p class="empty">{{ t('recipebook_notfound') }}</p>
      </div>
      <div v-else class="ricette-grid" id="saved-grid">
        <div v-for="recipe in filteredRecipes" :key="recipe.id" class="ricetta-card" @click="openDetail(recipe)">
          <span class="card-src" :class="getPreparationInfo(recipe).cls">{{ getPreparationInfo(recipe).txt }}</span>
          <button class="card-del btn-danger" @click.stop="confirmDelete(recipe.id)" title="✕">✕</button>
          <button class="card-fav" @click.stop="toggleFavorite(recipe.id)" :title="recipe.favorite ? t('favorite_remove') : t('favorite_add')">{{ recipe.favorite ? '★' : '☆' }}</button>
          <div class="card-name" v-html="highlight(recipe.name || '', debouncedSearch.trim())"></div>
          <div class="card-meta">{{ joinMetaParts([recipe.category, recipe.time]) }}</div>
          <div v-if="recipe.sourceDomain" class="card-origin">{{ getSourceDomainLabel(recipe.sourceDomain) }}</div>
        </div>
      </div>
    </div>
    <div v-else id="saved-detail-view">
      <RecipeDetailView
        :recipe="selectedRecipe"
        saved-mode
        @back="router.push('/recipe-book')"
        @start-recipe-timer="emit('start-recipe-timer', $event)"
        @start-cooking="emit('start-cooking', $event)"
        @add-to-shopping="emit('add-to-shopping', $event)"
        @toggle-favorite="toggleFavorite($event.id)"
        @save-notes="saveRecipeNotes"
        @duplicate-recipe="duplicateRecipe"
      />
    </div>
  </section>
</template>
