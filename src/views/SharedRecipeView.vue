<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import RecipeDetailView from '../components/RecipeDetailView.vue';
import { decodeShareData, sharedPayloadToRecipe } from '../lib/recipeShare';
import { useRecipeBookStore } from '../stores/recipeBook';
import { t } from '../lib/i18n.js';
import type { Recipe } from '../types';

const emit = defineEmits<{
  (e: 'start-cooking', recipe: Recipe): void;
  (e: 'start-recipe-timer', recipe: Recipe): void;
  (e: 'add-to-shopping', payload: unknown): void;
  (e: 'toast', message: string, type: string): void;
}>();

const route = useRoute();
const router = useRouter();
const store = useRecipeBookStore();

const payload = ref<ReturnType<typeof decodeShareData>>(null);
const invalid = ref(false);
const saved = ref(false);

const previewRecipe = computed<Recipe | null>(() => {
  if (!payload.value) return null;
  return sharedPayloadToRecipe(payload.value, '__shared_preview__');
});

onMounted(() => {
  // Try Vue Router query first (works for hash routing within app)
  let data = route.query['data'];
  if (Array.isArray(data)) data = data[0];

  // Fallback: parse from window.location.hash for direct shared links
  // This handles cases where the URL was opened directly (e.g., mobile share)
  if (!data || typeof data !== 'string') {
    try {
      const hash = window.location.hash;
      const hashParts = hash.split('?');
      if (hashParts.length >= 2) {
        const searchParams = new URLSearchParams(hashParts[1]);
        data = searchParams.get('data');
      }
    } catch {
      // Ignore parsing errors
    }
  }

  const decoded = decodeShareData(data ?? null);
  if (decoded) {
    payload.value = decoded;
  } else {
    invalid.value = true;
  }
});

function handleSave(recipe: Recipe) {
  if (saved.value) return;
  saved.value = true;
  const id = `shared-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const newRecipe: Recipe = { ...recipe, id, source: 'shared', favorite: false, notes: '', lastViewedAt: 0 };
  store.add(newRecipe);
  emit('toast', t('shared_saved_ok'), 'success');
  router.push(`/recipe-book/${id}`);
}
</script>

<template>
  <section class="panel active">
    <div v-if="invalid" class="shared-invalid-state">
      <p class="shared-error-msg">{{ t('shared_invalid') }}</p>
      <button class="btn-secondary" @click="router.push('/recipe-book')">{{ t('shared_back') }}</button>
    </div>

    <template v-else-if="previewRecipe">
      <div class="shared-banner">
        <p class="shared-banner-title">{{ t('shared_title') }}</p>
        <p class="shared-banner-subtitle">{{ t('shared_subtitle') }}</p>
      </div>

      <RecipeDetailView
        :recipe="previewRecipe"
        :back-label="t('shared_back')"
        :saved-mode="false"
        :can-save-builtin="true"
        @back="router.push('/recipe-book')"
        @save-builtin="handleSave"
        @start-cooking="(r) => emit('start-cooking', r)"
        @start-recipe-timer="(r) => emit('start-recipe-timer', r)"
        @add-to-shopping="(p) => emit('add-to-shopping', p)"
      />
    </template>
  </section>
</template>

<style scoped>
.shared-invalid-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 1rem;
  text-align: center;
}

.shared-error-msg {
  color: var(--color-err, #c62828);
  font-size: 1rem;
}

.shared-banner {
  padding: 0.75rem 1rem 0;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  margin-bottom: 0.5rem;
}

.shared-banner-title {
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-accent, #43A047);
  margin: 0 0 0.15rem;
}

.shared-banner-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-secondary, #666);
  margin: 0 0 0.75rem;
}
</style>
