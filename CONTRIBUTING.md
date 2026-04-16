# CONTRIBUTING.md

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
git clone https://github.com/paradix86/cucina-app.git
cd cucina-app
npm install
```

## Development

```bash
npm run dev      # dev server (URL printed by Vite)
npm run build    # production build → dist/
npm run preview  # serve the built dist/ locally
npx vue-tsc --noEmit   # TypeScript check for migrated scope
```

The app uses Vite with HMR. After editing files in `src/`, the browser updates automatically.

## Project structure

```text
src/
  App.vue              root component
  main.js              bootstrap (Vue + Pinia + Router)
  types.ts             shared TypeScript declarations
  router/index.js      route definitions
  views/               one component per route
  components/          shared components
  stores/              Pinia stores (recipeBook, shoppingList)
  composables/         Vue composables
  lib/                 pure logic (no Vue imports)
    storage.ts         localStorage CRUD + shopping parsing
    i18n.js            t() translation function
    i18nData.js        strings in 5 languages
    builtinData.js     built-in recipe dataset
    import/            typed import pipeline (core.ts, web.ts, adapters.ts)
public/
  sw.js                service worker
  manifest.json        PWA manifest
  icons/               PWA icons
```

## Development rules

### 1. i18n is required

All user-facing strings go through `t('key')` in `src/lib/i18n.js`.

Every new key must be added to **all five** language sections in `src/lib/i18nData.js` (IT, EN, DE, FR, ES).

### 2. localStorage compatibility

Existing saved data must survive upgrades. Recipe normalization lives in `normalizeStoredRecipe()` in `src/lib/storage.ts`. Any new field added to the recipe model must have a safe default there.

Do not change how existing fields are stored in a way that breaks old data.

### 3. Pinia for shared state

New cross-view reactive state belongs in a Pinia store under `src/stores/`.

When destructuring state from a Pinia store inside a composable or setup function, use `storeToRefs(store)` to preserve reactivity:

```js
import { storeToRefs } from 'pinia';
const { recipes } = storeToRefs(useRecipeBookStore());
```

Direct destructuring (`const { recipes } = store`) breaks reactivity for refs.

### 4. lib/ is Vue-free

`src/lib/` contains pure logic only — no Vue imports, no refs, no reactive. This keeps it testable and framework-independent.

Domain-critical logic should be typed first (storage, import adapters/parsers, store contracts).

### 5. Keep changes focused

Prefer surgical, verifiable changes over broad refactors. If a request is narrowly scoped, treat it as such.

### 6. Service worker and caching

The app ships a cache-first service worker (`public/sw.js`).

In a deployed environment, if a static asset changes, old clients will keep serving cached files until the SW detects an update. If you change assets that must invalidate across deployments, bump `CACHE_NAME` in `public/sw.js`.

In local dev (`npm run dev`), the SW is not active — Vite serves files directly. This is the expected behavior.

### 7. Touch UX

The app is optimized for tablets and touchscreens. Avoid small tap targets or cramped layouts.

## Recipe model

Use the current v3 English shape for new work:

```js
{
  id: '...',
  name: '...',
  category: '...',
  preparationType: 'classic', // 'classic' | 'bimby' | 'airfryer'
  bimby: false,               // legacy compat — keep it
  emoji: '🍳',
  time: '20 min',
  servings: '4',
  source: 'web',
  sourceDomain: 'giallozafferano.it',
  ingredients: ['200 g pasta', '...'],
  steps: ['Step 1', '...'],
  timerMinutes: 0,
  notes: '',
  favorite: false,
  tags: [],
  lastViewedAt: 0,
}
```

## Website import

The import pipeline in `src/lib/import/` follows this flow:

1. Normalize domain via `normalizeSourceDomain()`
2. Select a domain adapter if one exists (`adapters.ts`)
3. Fall back to generic parser if no adapter matches
4. Persist `source`, `sourceDomain`, `preparationType`, and suggested `tags`

Adding a new adapter: add an entry to the adapter registry in `src/lib/import/adapters.ts` with a domain matcher and a parse function. Do not break existing adapters.

## CSS

All styles are in `css/style.css`, organized with commented sections. Reuse existing CSS custom properties and utility classes. Check both light and dark theme after visual changes.

## Testing

At minimum, for any non-trivial change:

1. `npm run dev` and exercise the affected flow
2. Check browser console for errors
3. If the change involves import, shopping list, or recipe persistence: test save → reload → verify data survived
4. If the change is UI/flow related, run a targeted Playwright validation
5. `npx vue-tsc --noEmit` — confirm TS checks pass
6. `npm run build` — confirm the build passes cleanly

**Stale SW caveat (deployed environments only):** if testing a deployed version and behavior seems wrong, clear service workers and caches, then reload. In local dev this does not apply.

## Pull request checklist

- [ ] feature or fix works locally with `npm run dev`
- [ ] `npx vue-tsc --noEmit` passes
- [ ] `npm run build` passes with no errors
- [ ] no console errors introduced
- [ ] new UI strings added to `src/lib/i18nData.js` (all 5 languages)
- [ ] `localStorage` backward compatibility considered
- [ ] Playwright or targeted manual verification performed
- [ ] `CACHE_NAME` bumped in `public/sw.js` if deployed cached assets changed

## Documentation

If your change introduces a new functional area, workflow, persistence model, or import adapter, update the relevant docs:

- `README.md`
- `PROJECT_PLAN.md`
- `AGENTS.md`
- `CONTRIBUTING.md`
