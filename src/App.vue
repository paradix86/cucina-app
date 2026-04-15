<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import AppFooter from './components/AppFooter.vue';
import ToastStack from './components/ToastStack.vue';
import CookingModeView from './components/CookingModeView.vue';
import { t, initLanguage } from './lib/i18n.js';
import { migrateFromV2 } from './lib/storage.js';
import { useToasts } from './composables/useToasts.js';
import { useTimers } from './composables/useTimers.js';
import { initServiceWorkerUpdates } from './composables/useServiceWorker.js';
import { useRecipeBookStore } from './stores/recipeBook.js';
import { useShoppingListStore } from './stores/shoppingList.js';

const router = useRouter();
const cookingRecipe = ref(null);
const currentView = ref(null);

const { showToast } = useToasts();
const recipeBook = useRecipeBookStore();
const shoppingList = useShoppingListStore();
const timers = useTimers();

const tabs = computed(() => [
  { path: '/recipe-book', label: t('nav_recipebook') },
  { path: '/import',      label: t('nav_import') },
  { path: '/recipes',     label: t('nav_recipes') },
  { path: '/shopping-list', label: t('nav_shopping') },
  { path: '/timer',       label: t('nav_timer') },
]);

function goHome() {
  cookingRecipe.value = null;
  recipeBook.refresh();
  shoppingList.refresh();
  currentView.value?.goHome?.();
  router.push('/recipe-book').catch(() => {});
}

function handleRecipeTimer(recipe) {
  timers.startRecipeTimer(recipe.name, recipe.timerMinutes);
  router.push('/timer');
}

function handleAddToShopping(recipe) {
  const added = shoppingList.addRecipeIngredients(recipe);
  if (added) showToast(t('shopping_added_toast', { n: added }), 'success');
}

function handleToast(message, type = 'info') {
  showToast(message, type);
}

onMounted(() => {
  migrateFromV2();
  initLanguage();
  initServiceWorkerUpdates();
});
</script>

<template>
  <AppHeader :on-home="goHome" />

  <main class="app">
    <template v-if="cookingRecipe">
      <CookingModeView :recipe="cookingRecipe" @exit="cookingRecipe = null" />
    </template>
    <template v-else>
      <nav class="tabs" role="tablist">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.path"
          :to="tab.path"
          v-slot="{ isActive, navigate }"
          custom
        >
          <button
            :id="`tab-${tab.path.slice(1)}`"
            class="tab"
            :class="{ active: isActive }"
            role="tab"
            :aria-selected="isActive"
            @click="navigate"
          >
            {{ tab.label }}
          </button>
        </RouterLink>
      </nav>

      <RouterView v-slot="{ Component, route }">
        <component
          :is="Component"
          :id="Array.isArray(route.params.id) ? route.params.id[0] : route.params.id"
          ref="currentView"
          @start-recipe-timer="handleRecipeTimer"
          @start-cooking="cookingRecipe = $event"
          @add-to-shopping="handleAddToShopping"
          @toast="handleToast"
          @go-home="goHome"
        />
      </RouterView>
    </template>
  </main>

  <AppFooter />
  <ToastStack />
</template>
