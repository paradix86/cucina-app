import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index.js';
import { hydrateAppState } from './bootstrap/hydrateAppState';
import { initLanguage } from './lib/i18n.js';
import { migrateFromV2 } from './lib/storage';
import '../css/style.css';

const app = createApp(App);
const pinia = createPinia();

initLanguage();
migrateFromV2();

app.use(pinia);
app.use(router);

await hydrateAppState(pinia);

app.mount('#app');
