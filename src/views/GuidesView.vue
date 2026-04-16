<script setup lang="ts">
import { computed } from 'vue';
import mealPrepGuideRaw from '../content/duemme/meal_prep_guide.md?raw';
import { DUEMME_RECIPE_PACK } from '../lib/duemmePack';
import { t } from '../lib/i18n';
import { useRecipeBookStore } from '../stores/recipeBook';

const emit = defineEmits(['toast']);
const recipeBookStore = useRecipeBookStore();

const recipePackSize = computed(() => DUEMME_RECIPE_PACK.length);

function importDuemmePack(): void {
  let added = 0;
  DUEMME_RECIPE_PACK.forEach(recipe => {
    if (recipeBookStore.add(recipe)) added += 1;
  });

  if (added > 0) {
    emit('toast', t('guide_pack_import_ok', { n: added }), 'success');
    return;
  }
  emit('toast', t('guide_pack_import_none'), 'info');
}
</script>

<template>
  <section class="panel active">
    <div class="card guide-card">
      <h2>{{ t('guide_title') }}</h2>
      <p class="muted-label guide-subtitle">{{ t('guide_desc') }}</p>

      <div class="guide-actions">
        <button class="btn-primary" id="guide-import-pack" @click="importDuemmePack">
          {{ t('guide_pack_import', { n: recipePackSize }) }}
        </button>
        <a
          class="btn-ghost"
          href="https://github.com/duemme/piano_alimentare/tree/main/ricette"
          target="_blank"
          rel="noopener"
        >
          {{ t('guide_pack_source') }}
        </a>
      </div>
    </div>

    <article class="card guide-markdown">
      <h3>{{ t('guide_meal_prep_title') }}</h3>
      <p class="muted-label">{{ t('guide_meal_prep_source') }}</p>
      <pre class="guide-pre">{{ mealPrepGuideRaw }}</pre>
    </article>
  </section>
</template>
