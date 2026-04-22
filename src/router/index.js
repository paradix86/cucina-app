import { createRouter, createWebHashHistory } from 'vue-router';
import RecipeBookView from '../views/RecipeBookView.vue';
import ImportView from '../views/ImportView.vue';
import BuiltinRecipesView from '../views/BuiltinRecipesView.vue';
import ShoppingListView from '../views/ShoppingListView.vue';
import TimerView from '../views/TimerView.vue';
import GuidesView from '../views/GuidesView.vue';
import WeeklyPlannerView from '../views/WeeklyPlannerView.vue';

const routes = [
  { path: '/', redirect: '/recipe-book' },
  { path: '/recipe-book',  name: 'recipe-book',  component: RecipeBookView },
  { path: '/recipe-book/:id', name: 'recipe-book-detail', component: RecipeBookView, props: true },
  { path: '/import',       name: 'import',        component: ImportView },
  { path: '/recipes',      name: 'recipes',       component: BuiltinRecipesView },
  { path: '/recipes/:id', name: 'recipes-detail', component: BuiltinRecipesView, props: true },
  { path: '/shopping-list',name: 'shopping-list', component: ShoppingListView },
  { path: '/planner',      name: 'planner',       component: WeeklyPlannerView },
  { path: '/timer',        name: 'timer',         component: TimerView },
  { path: '/guides',       name: 'guides',        component: GuidesView },
  // Catch-all: redirect unknown paths to recipe book
  { path: '/:pathMatch(.*)*', redirect: '/recipe-book' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
});
