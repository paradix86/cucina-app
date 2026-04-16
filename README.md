# 🍳 Cucina App

Tablet-friendly cooking app built with Vue 3 + Vite.

- No backend
- `localStorage` persistence only
- Static deploy friendly
- PWA (cache-first service worker)

## Core Features

- **Recipe Book**: saved recipes, detail routes, notes, favorites, recent, source/type/site filters
- **Import**: URL import with adapter-based website parsing, diagnostics, metadata preview/edit before save
- **Manual Import**: structured form to create recipes without a URL
- **Built-in Recipes**: curated dataset with preparation-type filtering
- **Shopping List**: add ingredients from recipes, smart grouping (numeric + exact), per-recipe contribution breakdown, section assignment
- **Cooking Mode**: step-by-step fullscreen mode with per-step timer
- **Timers**: multiple parallel timers with toast completion feedback
- **Theme + i18n**: light/dark/system theme, IT/EN/DE/FR/ES translations

## Stack

- Vue 3 (`<script setup>`)
- Vite 8
- Vue Router 4 (hash history)
- Pinia 3
- TypeScript gradual migration (`allowJs` still enabled)
- VueUse (targeted utilities)

## Local Development

```bash
git clone https://github.com/paradix86/cucina-app.git
cd cucina-app
npm install
npm run dev
```

The dev server URL is printed by Vite (default is usually `http://localhost:5173` unless a custom port is used).

```bash
npm run build
npm run preview
```

## Project Layout (high level)

```text
src/
  App.vue
  main.js
  types.ts
  router/index.js
  views/
  components/
  stores/
    recipeBook.ts
    shoppingList.ts
  composables/
    useImportFlow.ts
    useTimers.js
    useTheme.js
    useServiceWorker.js
  lib/
    storage.ts
    recipes.js
    i18n.js
    i18nData.js
    builtinData.js
    appMeta.js
    import/
      core.ts
      web.ts
      adapters.ts
public/
  sw.js
  manifest.json
  icons/
```

## Import Architecture

URL import pipeline:
1. Detect source type (`web`, `youtube`, `tiktok`, `instagram`)
2. Normalize source domain
3. Fetch readable web content for website imports
4. Resolve adapter by domain (or generic fallback)
5. Build preview recipe with metadata (`source`, `sourceDomain`, `preparationType`, `tags`)
6. Save to Recipe Book after user confirmation

Supported website adapters:
- `giallozafferano.it`
- `ricetteperbimby.it`

Unsupported websites fail with explicit diagnostics in the import UI.

## Persistence and Compatibility

- Recipe model is normalized before persistence.
- Legacy data compatibility is preserved in `src/lib/storage.ts` (`migrateFromV2`, `normalizeStoredRecipe` path).
- Legacy `bimby: boolean` remains supported, while `preparationType` is first-class.

## PWA / Cache Caveat

The app uses a cache-first service worker (`public/sw.js`).

When changing deployable static assets, **bump `CACHE_NAME`** in `public/sw.js`.
If runtime behavior looks stale in a deployed environment, clear service workers + caches and reload.

## Deployment

`npm run build` outputs static assets in `dist/`.

Deploy `dist/` to any static host (Netlify, Vercel static, GitHub Pages, etc.).  
If hosting under a subpath, set `base` in `vite.config.js` accordingly.

## License

MIT
