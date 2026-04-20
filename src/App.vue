<script setup>
import { computed, onMounted, provide, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import AppFooter from './components/AppFooter.vue';
import ToastStack from './components/ToastStack.vue';
import CookingModeView from './components/CookingModeView.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import TimerAlertModal from './components/TimerAlertModal.vue';
import { t, initLanguage } from './lib/i18n.js';
import { migrateFromV2 } from './lib/storage';
import { useToasts } from './composables/useToasts.js';
import { useTimers } from './composables/useTimers.js';
import { useTimerAlerts } from './composables/useTimerAlerts.js';
import { initServiceWorkerUpdates } from './composables/useServiceWorker.js';
import { useRecipeBookStore } from './stores/recipeBook';
import { useShoppingListStore } from './stores/shoppingList';

const router = useRouter();
const cookingRecipe = ref(null);
const currentView = ref(null);
const confirmState = ref({
  open: false,
  title: '',
  message: '',
  confirmLabel: '',
  cancelLabel: '',
});
let confirmResolver = null;

const { showToast } = useToasts();
const recipeBook = useRecipeBookStore();
const shoppingList = useShoppingListStore();
const timers = useTimers();
const { timerAlert, dismissTimerAlert } = useTimerAlerts();

const tabs = computed(() => [
  { path: '/recipe-book', label: t('nav_recipebook') },
  { path: '/import',      label: t('nav_import') },
  { path: '/recipes',     label: t('nav_recipes') },
  { path: '/shopping-list', label: t('nav_shopping') },
  { path: '/timer',       label: t('nav_timer') },
  { path: '/guides',      label: t('nav_guides') },
]);

function requestConfirm(options = {}) {
  const {
    title = t('confirm_title'),
    message = '',
    confirmLabel = t('confirm_confirm'),
    cancelLabel = t('confirm_cancel'),
  } = options;
  return new Promise(resolve => {
    confirmResolver = resolve;
    confirmState.value = {
      open: true,
      title,
      message,
      confirmLabel,
      cancelLabel,
    };
  });
}

function resolveConfirm(value) {
  if (confirmResolver) confirmResolver(value);
  confirmResolver = null;
  confirmState.value = {
    open: false,
    title: '',
    message: '',
    confirmLabel: '',
    cancelLabel: '',
  };
}

provide('requestConfirm', requestConfirm);

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
  if (recipe?.action === 'remove' && recipe?.recipe?.id) {
    const removed = shoppingList.removeRecipeIngredients(recipe.recipe.id);
    if (removed) showToast(t('shopping_removed_toast', { n: removed }), 'info');
    return;
  }

  const payload = recipe?.recipe ? recipe : { recipe, selectedServings: undefined, baseServings: undefined };
  const baseServings = Number(payload.baseServings) || parseInt(payload.recipe?.servings, 10) || 1;
  const selectedServings = Number(payload.selectedServings) || baseServings;
  const scaleFactor = baseServings > 0 ? selectedServings / baseServings : 1;
  const added = shoppingList.addRecipeIngredients(payload.recipe, { scaleFactor });
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
  <ConfirmDialog
    :open="confirmState.open"
    :title="confirmState.title"
    :message="confirmState.message"
    :confirm-label="confirmState.confirmLabel"
    :cancel-label="confirmState.cancelLabel"
    @confirm="resolveConfirm(true)"
    @cancel="resolveConfirm(false)"
  />
  <TimerAlertModal
    :open="timerAlert.open"
    :title="timerAlert.title"
    :message="timerAlert.message"
    :dismiss-label="t('timer_alarm_dismiss')"
    @dismiss="dismissTimerAlert"
  />
</template>
