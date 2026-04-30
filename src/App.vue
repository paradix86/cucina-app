<script setup>
import { computed, onMounted, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import AppFooter from './components/AppFooter.vue';
import ToastStack from './components/ToastStack.vue';
import CookingModeView from './components/CookingModeView.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import TimerAlertModal from './components/TimerAlertModal.vue';
import { t } from './lib/i18n';
import { useToasts } from './composables/useToasts';
import { useTimers } from './composables/useTimers';
import { useTimerAlerts } from './composables/useTimerAlerts';
import { initServiceWorkerUpdates } from './composables/useServiceWorker';
import { useRecipeBookStore } from './stores/recipeBook';
import { useShoppingListStore } from './stores/shoppingList';
import { useWeeklyPlannerStore } from './stores/weeklyPlanner';

const router = useRouter();
const route = useRoute();
const cookingRecipe = ref(null);
const cookingReturnTo = ref('');
const currentView = ref(null);
const moreOpen = ref(false);
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
const weeklyPlanner = useWeeklyPlannerStore();
const timers = useTimers();
const { timerAlert, dismissTimerAlert, snoozeTimerAlert } = useTimerAlerts();

const NAV_ICONS = {
  'recipe-book':   'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  'import':        'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  'shopping-list': 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  'planner':       'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'timer':         'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  'guides':        'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'meal-composer':      'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  'nutrition-goals':    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
};

const MORE_ICON = 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z';

const navTabs = computed(() => [
  { path: '/recipe-book',   label: t('nav_recipebook'),                   icon: NAV_ICONS['recipe-book'],   primary: true  },
  { path: '/shopping-list', label: t('nav_shopping'),                     icon: NAV_ICONS['shopping-list'], primary: true  },
  { path: '/planner',       label: t('nav_planner'),                      icon: NAV_ICONS['planner'],       primary: true  },
  { path: '/timer',         label: t('nav_timer'),                        icon: NAV_ICONS['timer'],         primary: true  },
  { path: '/import',        label: t('nav_import').replace(/^\+\s*/, ''), icon: NAV_ICONS['import'],        primary: false },
  { path: '/guides',        label: t('nav_guides'),                       icon: NAV_ICONS['guides'],        primary: false },
  { path: '/meal-composer',   label: t('nav_meal_composer'),   icon: NAV_ICONS['meal-composer'],   primary: false },
  { path: '/nutrition-goals', label: t('nav_nutrition_goals'), icon: NAV_ICONS['nutrition-goals'], primary: false },
]);

const primaryTabs = computed(() => navTabs.value.filter(tab => tab.primary));
const secondaryTabs = computed(() => navTabs.value.filter(tab => !tab.primary));

const isSecondaryActive = computed(() =>
  secondaryTabs.value.some(tab => route.path.startsWith(tab.path))
);

function isTabActive(tab) {
  if (tab.path === '/recipe-book') {
    return route.path === '/recipe-book' || route.path.startsWith('/recipes');
  }
  return route.path === tab.path || route.path.startsWith(tab.path + '/');
}

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
  cookingReturnTo.value = '';
  recipeBook.refresh();
  shoppingList.refresh();
  weeklyPlanner.refresh();
  currentView.value?.goHome?.();
  router.push('/recipe-book').catch(() => {});
}

function handleRecipeTimer(recipe) {
  timers.startRecipeTimer(recipe.name, recipe.timerSeconds ?? (recipe.timerMinutes ?? 0) * 60);
  router.push('/timer');
}

function normalizeReturnTo(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'planner' || raw === 'shopping-list' ? raw : '';
}

function handleStartCooking(recipe) {
  cookingReturnTo.value = normalizeReturnTo(route.query.returnTo);
  cookingRecipe.value = recipe;
}

function handleCookingExit() {
  const returnTo = cookingReturnTo.value;
  cookingRecipe.value = null;
  cookingReturnTo.value = '';
  if (returnTo === 'planner') {
    router.push('/planner').catch(() => {});
    return;
  }
  if (returnTo === 'shopping-list') {
    router.push('/shopping-list').catch(() => {});
  }
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
  initServiceWorkerUpdates(showToast);
});

watch(() => route.fullPath, () => {
  moreOpen.value = false;
  if (!cookingRecipe.value) return;
  cookingRecipe.value = null;
  cookingReturnTo.value = '';
});
</script>

<template>
  <AppHeader :on-home="goHome" />

  <div class="app-shell">
    <nav v-if="!cookingRecipe" class="app-sidenav" aria-label="Navigazione principale">
      <RouterLink
        v-for="tab in navTabs"
        :key="tab.path"
        :to="tab.path"
        v-slot="{ navigate }"
        custom
      >
        <button
          class="app-sidenav-item"
          :class="{ active: isTabActive(tab) }"
          @click="navigate"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="tab.icon" />
          </svg>
          <span>{{ tab.label }}</span>
        </button>
      </RouterLink>
    </nav>

    <main id="main-content" class="app">
      <template v-if="cookingRecipe">
        <CookingModeView :recipe="cookingRecipe" @exit="handleCookingExit" />
      </template>
      <template v-else>
        <RouterView v-slot="{ Component, route }">
          <component
            :is="Component"
            :id="Array.isArray(route.params.id) ? route.params.id[0] : route.params.id"
            ref="currentView"
            @start-recipe-timer="handleRecipeTimer"
            @start-cooking="handleStartCooking"
            @add-to-shopping="handleAddToShopping"
            @toast="handleToast"
            @go-home="goHome"
          />
        </RouterView>
      </template>
    </main>
  </div>

  <nav v-if="!cookingRecipe" class="app-bottomnav" aria-label="Navigazione principale">
    <RouterLink
      v-for="tab in primaryTabs"
      :key="tab.path"
      :to="tab.path"
      v-slot="{ navigate }"
      custom
    >
      <button
        class="app-bottomnav-item"
        :class="{ active: isTabActive(tab) }"
        @click="navigate"
      >
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path :d="tab.icon" />
        </svg>
        <span class="app-bottomnav-label">{{ tab.label }}</span>
      </button>
    </RouterLink>
    <button
      class="app-bottomnav-item"
      :class="{ active: moreOpen || isSecondaryActive }"
      @click="moreOpen = !moreOpen"
    >
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="MORE_ICON" />
      </svg>
      <span class="app-bottomnav-label">{{ t('nav_more') }}</span>
    </button>
  </nav>

  <Transition name="more-panel">
    <div v-if="moreOpen" class="app-more-overlay" @click.self="moreOpen = false">
      <nav class="app-more-panel">
        <RouterLink
          v-for="tab in secondaryTabs"
          :key="tab.path"
          :to="tab.path"
          v-slot="{ isActive, navigate }"
          custom
        >
          <button
            class="app-more-item"
            :class="{ active: isActive }"
            @click="navigate(); moreOpen = false"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="tab.icon" />
            </svg>
            {{ tab.label }}
          </button>
        </RouterLink>
      </nav>
    </div>
  </Transition>

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
    :snooze-label="timerAlert.onSnooze ? t('timer_alarm_snooze') : ''"
    @dismiss="dismissTimerAlert"
    @snooze="snoozeTimerAlert"
  />
</template>
