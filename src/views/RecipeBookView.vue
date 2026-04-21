<script setup>
import { computed, inject, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useDebounce } from '@vueuse/core';
import RecipeDetailView from '../components/RecipeDetailView.vue';
import { useRecipeBookStore } from '../stores/recipeBook';
import { getPreparationInfo, getSourceDomainLabel, getMealOccasionLabel, highlight, joinMetaParts, recipeMatchesQuery, MEAL_OCCASION_OPTIONS } from '../lib/recipes.js';
import { t } from '../lib/i18n.js';

const emit = defineEmits(['start-recipe-timer', 'start-cooking', 'add-to-shopping', 'toast']);
const props = defineProps({
  id: { type: String, default: '' },
});
const router = useRouter();
const store = useRecipeBookStore();
const { recipes } = storeToRefs(store);
const requestConfirm = inject('requestConfirm', null);

const search = ref('');
const debouncedSearch = useDebounce(search, 180);
const sourceFilter = ref('all');
const filterType = ref('all');
const siteFilter = ref('all');
const mealFilter = ref('all');
const mobileFiltersOpen = ref(false);

const sourceOptions = [
  { value: 'all', label: () => t('filter_all') },
  { value: 'youtube', label: () => t('source_youtube') },
  { value: 'tiktok', label: () => t('source_tiktok') },
  { value: 'instagram', label: () => t('source_instagram') },
  { value: 'classica', label: () => t('source_classic') },
  { value: 'bimby', label: () => t('source_bimby') },
  { value: 'web', label: () => t('source_web') },
  { value: 'manual', label: () => t('source_manual') },
];

const sourceCounts = computed(() => recipes.value.reduce((acc, recipe) => {
  const key = recipe.source || 'web';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {}));

const visibleSourceOptions = computed(() => sourceOptions.filter(option => (
  option.value === 'all' || (sourceCounts.value[option.value] || 0) > 0
)));

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
    const matchMeal = mealFilter.value === 'all' || (recipe.mealOccasion || []).includes(mealFilter.value);
    return matchQuery && matchSource && matchType && matchSite && matchMeal;
  });
  if (filterType.value === 'recent') {
    list.sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0));
  }
  return list;
});

const savedCountLabel = computed(() => recipes.value.length === 1 ? t('recipebook_saved', { n: recipes.value.length }) : t('recipebook_saved_plural', { n: recipes.value.length }));
const resultsLabel = computed(() => filteredRecipes.value.length < recipes.value.length ? t('results_showing', { n: filteredRecipes.value.length, total: recipes.value.length }) : '');
const activeFilterCount = computed(() => {
  let count = 0;
  if (sourceFilter.value !== 'all') count += 1;
  if (filterType.value !== 'all') count += 1;
  if (siteFilter.value !== 'all') count += 1;
  if (mealFilter.value !== 'all') count += 1;
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
  return recipes.value.find(recipe => recipe.id === selectedRecipeId.value) || null;
});

watch([selectedRecipeId, selectedRecipe], ([id, selected]) => {
  if (id && !selected) {
    router.replace('/recipe-book').catch(() => {});
  }
}, { immediate: true });

watch(visibleSourceOptions, (options) => {
  if (!options.some(option => option.value === sourceFilter.value)) {
    sourceFilter.value = 'all';
  }
});

function openDetail(recipe) {
  router.push({ name: 'recipe-book-detail', params: { id: recipe.id } }).catch(() => {});
  store.viewed(recipe.id);
}

async function confirmDelete(id) {
  const confirmed = requestConfirm
    ? await requestConfirm({
        message: t('delete_confirm'),
        confirmLabel: t('confirm_confirm'),
        cancelLabel: t('confirm_cancel'),
      })
    : false;
  if (!confirmed) return;
  store.remove(id);
  if (selectedRecipeId.value === id) {
    router.replace('/recipe-book').catch(() => {});
  }
}

function onExportBackup() {
  const count = store.exportBackup();
  emit('toast', t('backup_export_ok', { n: count }), 'success');
}

async function onImportBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const confirmed = requestConfirm
    ? await requestConfirm({
        title: t('backup_import_confirm_title'),
        message: t('backup_import_confirm_msg'),
        confirmLabel: t('confirm_confirm'),
        cancelLabel: t('confirm_cancel'),
      })
    : true;

  if (!confirmed) {
    event.target.value = '';
    return;
  }

  store.importBackup(file).then(({ added, total }) => {
    emit('toast', t('backup_import_ok', { added, total }), 'success');
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

function saveRecipeEdit(payload) {
  const ok = store.update(payload.recipeId, payload.updates);
  if (ok) {
    emit('toast', t('recipe_edit_saved'), 'success');
  } else {
    emit('toast', t('recipe_edit_save_err'), 'error');
  }
  if (typeof payload.onComplete === 'function') {
    payload.onComplete(ok);
  }
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
      <div v-if="recipes.length" class="saved-header">
        <input v-model="search" type="text" :placeholder="t('recipebook_search')" />
        <span id="saved-count" class="muted-label">{{ savedCountLabel }}</span>
      </div>
      <div v-if="recipes.length" class="backup-actions">
        <button class="btn-ghost" @click="onExportBackup">{{ t('backup_export') }}</button>
        <label class="btn-ghost" style="display:inline-flex;align-items:center;justify-content:center;cursor:pointer">
          {{ t('backup_import') }}
          <input hidden type="file" accept="application/json,.json" @change="onImportBackup" />
        </label>
      </div>
      <div v-if="recipes.length" class="saved-filter-mobile-toggle-wrap">
        <button class="btn-ghost saved-filter-mobile-toggle" :aria-expanded="mobileFiltersOpen ? 'true' : 'false'" @click="mobileFiltersOpen = !mobileFiltersOpen">
          <span>{{ mobileFiltersOpen ? t('filters_hide') : t('filters_show') }}</span>
          <span v-if="activeFilterCount" class="saved-filter-mobile-badge">{{ activeFilterCount }}</span>
        </button>
      </div>
      <div v-if="recipes.length" id="saved-source-filter" class="saved-filter-panel mobile-collapsible" :class="{ 'is-mobile-open': mobileFiltersOpen }">
        <div class="saved-filter-content">
          <div class="saved-filter-group">
            <div class="filter-row">
              <button
                v-for="option in visibleSourceOptions"
                :key="option.value"
                class="src-pill"
                :class="{ active: sourceFilter === option.value }"
                @click="sourceFilter = option.value"
              >
                {{ option.label() }}
              </button>
            </div>
          </div>
          <div class="saved-filter-group">
            <div class="filter-row">
              <button class="type-pill" :class="{ active: filterType === 'all' }" @click="filterType = 'all'">{{ t('filter_all') }}</button>
              <button class="type-pill" :class="{ active: filterType === 'favorites' }" @click="filterType = 'favorites'">{{ t('filter_favorites') }}</button>
              <button class="type-pill" :class="{ active: filterType === 'recent' }" @click="filterType = 'recent'">{{ t('filter_recent') }}</button>
            </div>
          </div>
          <div class="saved-filter-group filter-group--labeled">
            <span class="filter-group-label">{{ t('filter_meal_occasion') }}</span>
            <div class="filter-row">
              <button class="type-pill" :class="{ active: mealFilter === 'all' }" @click="mealFilter = 'all'">{{ t('filter_all') }}</button>
              <button v-for="occ in MEAL_OCCASION_OPTIONS" :key="occ" class="type-pill" :class="{ active: mealFilter === occ }" @click="mealFilter = occ">{{ getMealOccasionLabel(occ) }}</button>
            </div>
          </div>
          <div v-if="sortedDomains.length" class="saved-filter-group filter-group--labeled">
            <span class="filter-group-label">{{ t('filter_site') }}</span>
            <div class="filter-row">
              <button class="site-pill" :class="{ active: siteFilter === 'all' }" @click="siteFilter = 'all'">{{ t('filter_all_sites') }} <span class="pill-count">({{ recipes.length }})</span></button>
              <button v-for="domain in sortedDomains" :key="domain" class="site-pill" :class="{ active: siteFilter === domain }" @click="siteFilter = domain">{{ getSourceDomainLabel(domain) }} <span class="pill-count">({{ siteCounts[domain] }})</span></button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="recipes.length" id="saved-results-count" class="results-count">{{ resultsLabel }}</div>
      <div v-if="!recipes.length" class="ricette-grid" id="saved-grid">
        <div class="empty-state-shell">
          <span class="empty-kicker">{{ t('recipebook_empty_kicker') }}</span>
          <p class="empty">{{ t('recipebook_empty') }}</p>
          <p class="empty-next muted-label">{{ t('recipebook_empty_hint') }}</p>
          <p class="empty-next muted-label">{{ t('recipebook_empty_next') }}</p>
          <div class="empty-state-actions">
            <button class="btn-primary" @click="router.push({ name: 'import' })">{{ t('empty_cta_import') }}</button>
            <button class="btn-secondary" @click="router.push({ name: 'import', query: { start: 'manual' } })">{{ t('empty_cta_manual') }}</button>
            <button class="btn-secondary" @click="router.push({ name: 'recipes' })">{{ t('empty_cta_browse') }}</button>
          </div>
        </div>
      </div>
      <div v-else-if="!filteredRecipes.length" class="ricette-grid" id="saved-grid">
        <p class="empty">{{ t('recipebook_notfound') }}</p>
      </div>
      <div v-else class="ricette-grid" id="saved-grid">
        <div v-for="recipe in filteredRecipes" :key="recipe.id" class="ricetta-card" @click="openDetail(recipe)">
          <span class="card-src" :class="getPreparationInfo(recipe).cls">{{ getPreparationInfo(recipe).txt }}</span>
          <div class="card-actions">
            <button class="card-fav card-action-btn" @click.stop="toggleFavorite(recipe.id)" :title="recipe.favorite ? t('favorite_remove') : t('favorite_add')">
              <span class="card-action-glyph" aria-hidden="true">{{ recipe.favorite ? '★' : '☆' }}</span>
            </button>
            <button class="card-del card-action-btn btn-danger" @click.stop="confirmDelete(recipe.id)" title="✕">
              <span class="card-action-glyph" aria-hidden="true">✕</span>
            </button>
          </div>
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
        @save-recipe-edit="saveRecipeEdit"
      />
    </div>
  </section>
</template>
