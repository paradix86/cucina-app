# 🍳 Cucina App

A cooking web app designed for tablets and touchscreens.

Vue 3 + Vite SPA. No backend. State is persisted in `localStorage`.

## Features

| Section | What it does |
|---|---|
| 📚 **Recipe Book** | Saved recipes with search, filters (source, type, site, favorites, recent), notes, and detail view |
| ＋ **Import** | Import from recipe websites via adapter-based extraction; preview and save before committing |
| 🍝 **Recipes** | Built-in dataset of classic and Bimby TM5 recipes |
| 🛒 **Shopping List** | Add ingredients from recipes; smart grouping, quantity merging, and section assignment |
| ⏱ **Timer** | Multiple parallel timers, launchable from recipes |
| 🍳 **Cooking Mode** | Step-by-step guided view for active cooking |

## Local development

```bash
git clone https://github.com/paradix86/cucina-app.git
cd cucina-app
npm install
npm run dev
```

App runs at `http://localhost:4173`.

```bash
npm run build     # production build → dist/
npm run preview   # preview the built dist/
```

## Project structure

```text
cucina-app/
├── src/
│   ├── App.vue              # root component — layout, router outlet, global event handlers
│   ├── main.js              # bootstrap: Vue + Pinia + Router
│   ├── types.d.ts           # shared TypeScript type declarations (gradual adoption)
│   ├── router/
│   │   └── index.js         # Vue Router, hash history
│   ├── views/               # one component per route
│   │   ├── RecipeBookView.vue
│   │   ├── ImportView.vue
│   │   ├── BuiltinRecipesView.vue
│   │   ├── ShoppingListView.vue
│   │   └── TimerView.vue
│   ├── components/          # shared components
│   │   ├── AppHeader.vue
│   │   ├── AppFooter.vue
│   │   ├── CookingModeView.vue
│   │   ├── RecipeDetailView.vue
│   │   └── ToastStack.vue
│   ├── stores/              # Pinia stores — shared reactive state
│   │   ├── recipeBook.js
│   │   └── shoppingList.js
│   ├── composables/         # Vue composables
│   │   ├── useRecipeBook.js
│   │   ├── useShoppingList.js
│   │   ├── useImportFlow.js
│   │   ├── useTimers.js
│   │   ├── useToasts.js
│   │   ├── useTheme.js
│   │   └── useServiceWorker.js
│   └── lib/                 # pure logic, no Vue dependency
│       ├── storage.js        # localStorage CRUD, shopping grouping/parsing
│       ├── recipes.js        # recipe helpers (filters, highlight, formatting)
│       ├── i18n.js           # t() translation function
│       ├── i18nData.js       # strings in EN, IT, DE, FR, ES
│       ├── builtinData.js    # built-in recipe dataset
│       ├── appMeta.js        # version and build metadata
│       └── import/
│           ├── core.js       # URL detection, domain normalization
│           ├── web.js        # web fetch, readable extraction, failure inference
│           └── adapters.js   # domain adapter registry and generic fallback
├── public/
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # service worker
│   └── icons/               # PWA icons
├── vite.config.js
├── tsconfig.json            # allowJs + gradual TS adoption
└── package.json
```

## Recipe import

The `+ Import` tab supports recipe website URLs.

Architecture:
1. URL → detect source type (web / YouTube / TikTok / Instagram)
2. Fetch readable page content
3. Select domain-specific adapter if available, otherwise use generic fallback
4. Parse recipe fields, assign `sourceDomain`, `preparationType`, and suggested tags
5. Show preview — user can adjust before saving

Currently supported website adapters:
- `giallozafferano.it`
- `ricetteperbimby.it`

Imported recipes persist: `source`, `sourceDomain`, `preparationType`, `tags`.

Some websites will remain unsupported due to CORS restrictions or anti-bot protections. The app fails honestly in those cases.

## Preparation types

Recipes carry a first-class `preparationType` field:

- `classic`
- `bimby`
- `airfryer`

The legacy `bimby: boolean` field is preserved for backward compatibility with existing saved data.

## Adding built-in recipes

Edit [`src/lib/builtinData.js`](src/lib/builtinData.js) and add an entry to the recipes array:

```js
{
  id: 'my-recipe-1',
  name: 'My Recipe',
  category: 'Primi',
  preparationType: 'classic', // 'classic' | 'bimby' | 'airfryer'
  emoji: '🍝',
  time: '30 min',
  servings: '4',
  source: 'classica',
  ingredients: ['200 g pasta', '...'],
  steps: ['Step 1', 'Step 2'],
  timerMinutes: 10,
}
```

## i18n

All user-facing strings go through `t('key')` (see [`src/lib/i18n.js`](src/lib/i18n.js)).

Supported languages: Italian, English, German, French, Spanish.

New strings must be added to all five language sections in [`src/lib/i18nData.js`](src/lib/i18nData.js).

## Offline / PWA

The app ships a cache-first service worker (`public/sw.js`).

If a deployed static asset changes, bump `CACHE_NAME` in `public/sw.js` to invalidate caches.

## Deployment

Build produces a static bundle in `dist/`. Deploy that folder to any static host.

For GitHub Pages with a subdirectory URL, `vite.config.js` may need a `base` option set to the repo name.

## Browser compatibility

Tested in Chrome, Firefox, Safari, Edge (modern versions).

Optimized for tablets and touchscreens. Supports light and dark themes.

## License

MIT — free for personal and commercial use.
