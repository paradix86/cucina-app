import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteLocationNormalized, RouteRecordRaw, RouterScrollBehavior } from 'vue-router';
import RecipeBookView from '../views/RecipeBookView.vue';

const ImportView        = () => import('../views/ImportView.vue');
const BuiltinRecipesView = () => import('../views/BuiltinRecipesView.vue');
const ShoppingListView  = () => import('../views/ShoppingListView.vue');
const WeeklyPlannerView = () => import('../views/WeeklyPlannerView.vue');
const TimerView         = () => import('../views/TimerView.vue');
const GuidesView        = () => import('../views/GuidesView.vue');
const SharedRecipeView  = () => import('../views/SharedRecipeView.vue');
const MealComposerView    = () => import('../views/MealComposerView.vue');
const NutritionGoalsView  = () => import('../views/NutritionGoalsView.vue');

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/recipe-book' },
  { path: '/recipe-book',  name: 'recipe-book',  component: RecipeBookView },
  { path: '/recipe-book/:id', name: 'recipe-book-detail', component: RecipeBookView, props: true },
  { path: '/import',       name: 'import',        component: ImportView },
  { path: '/recipes',      name: 'recipes',       component: BuiltinRecipesView },
  { path: '/recipes/:id', name: 'recipes-detail', component: BuiltinRecipesView, props: true },
  { path: '/shopping-list',name: 'shopping-list', component: ShoppingListView },
  { path: '/planner',      name: 'planner',       component: WeeklyPlannerView },
  { path: '/timer',        name: 'timer',         component: TimerView },
  { path: '/guides',         name: 'guides',         component: GuidesView },
  { path: '/shared-recipe',  name: 'shared-recipe',  component: SharedRecipeView },
  { path: '/meal-composer',    name: 'meal-composer',    component: MealComposerView },
  { path: '/nutrition-goals',  name: 'nutrition-goals',  component: NutritionGoalsView },
  // Catch-all: redirect unknown paths to recipe book
  { path: '/:pathMatch(.*)*', redirect: '/recipe-book' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    savedPosition: Parameters<RouterScrollBehavior>[2],
  ) {
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
});
