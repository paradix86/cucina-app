import { createRouter, createWebHashHistory } from 'vue-router';
import RecipeBookView from '../views/RecipeBookView.vue';
import ImportView from '../views/ImportView.vue';
import BuiltinRecipesView from '../views/BuiltinRecipesView.vue';
import ShoppingListView from '../views/ShoppingListView.vue';
import TimerView from '../views/TimerView.vue';

const routes = [
  { path: '/', redirect: '/recipe-book' },
  { path: '/recipe-book',  name: 'recipe-book',  component: RecipeBookView },
  { path: '/import',       name: 'import',        component: ImportView },
  { path: '/recipes',      name: 'recipes',       component: BuiltinRecipesView },
  { path: '/shopping-list',name: 'shopping-list', component: ShoppingListView },
  { path: '/timer',        name: 'timer',         component: TimerView },
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
