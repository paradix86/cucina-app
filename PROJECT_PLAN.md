# Cucina App — Project Plan

Operational backlog and roadmap for both human and agent-assisted development.

## Goals

- Make the app more useful during real cooking sessions on tablets and touchscreens
- Improve UX, local persistence, and offline reliability
- Add organizational features while keeping the app static and deployable anywhere

## Constraints

- Vue 3 + Vite SPA (migrated from vanilla JS)
- Pinia 3 for shared reactive state
- No backend, no server-side logic
- All user-facing strings must go through `t('key')` — new keys must be added to all 5 languages
- Persistence is `localStorage`-only
- `localStorage` backward compatibility must be preserved across upgrades
- If a deployed cached asset changes, bump `CACHE_NAME` in `public/sw.js`

## Architecture state (current)

The app has gone through a full architectural migration:

- ~~Vanilla JS / no-build~~ → **Vue 3 + Vite**
- ~~Global DOM manipulation~~ → **component-based SFCs**
- ~~Module-level singleton refs~~ → **Pinia stores**
- ~~Single flat file~~ → **Vue Router with hash-based routes**
- **TypeScript gradual migration**: shared types + typed stores + typed storage + typed import layer

## Milestones

### Milestone 1 — Cooking Core
- [x] Step-by-step cooking mode
- [x] Toast notifications
- [x] Manual dark mode toggle

### Milestone 2 — Personal Recipe Book
- [x] Personal notes on recipes
- [x] Export / Import backup JSON
- [x] Manual import (form, no URL required)

### Milestone 3 — Planning
- [x] Shopping list — with smart grouping, quantity merging, section assignment, merge across recipes
- [ ] Weekly planner — **backlog**

### Milestone 4 — Project Hygiene
- [x] `AGENTS.md`
- [x] `CONTRIBUTING.md`
- [x] `README.md` (aligned to Vue/Vite)
- [x] `PROJECT_PLAN.md` (this file)

### Milestone 5 — Smart Features
- [x] Favorites
- [x] Custom tags (on import + on saved recipes)
- [x] Recent recipes (`lastViewedAt`)
- [x] Advanced filters (source type, preparation type, site, favorites, recent)
- [ ] Meal prep / batch cooking — **backlog**
- [ ] Pantry suggestions — **backlog**

### Milestone 6 — Architecture (completed)
- [x] Vue 3 + Vite migration
- [x] Vue Router (hash history, 5 routes)
- [x] Pinia stores (recipeBook, shoppingList)
- [x] TypeScript bootstrap (`tsconfig.json`, `allowJs`)
- [x] TypeScript migration (stores, storage/domain, import parsing layer)
- [x] VueUse targeted adoption
- [x] Adapter-based website import architecture
- [x] Internationalisation (IT, EN, DE, FR, ES)
- [x] PWA / service worker (`public/sw.js`, `public/manifest.webmanifest`)

## Technical debt backlog (do before next feature wave)

### Wave 0 — Quick wins (≤1 day each, no risk)
- [ ] Surface `saveRecipeBook` errors to callers — currently swallowed silently; return a result so the UI can warn on localStorage full
- [ ] Fix `useTimers.js` interval lifecycle — module-level singleton interval is never cleared on page hide or HMR; add `visibilitychange` cleanup and export `teardownTimers()`
- [ ] Normalize `timerMinutes` → seconds in `normalizeStoredRecipe()` — cooking mode recomputes it, but the right place is normalization

### Wave 1 — Code quality (2–4 days, feature-neutral)
- [ ] Split `src/lib/import/adapters.ts` (1171 lines) into `adapters/index.ts` + one file per adapter + `jsonld.ts` + `generic.ts`
- [ ] Lazy-load the Ninja built-in pack (7558-line JSON currently bundled at build time) — dynamic `import()` on first access
- [ ] Extend TypeScript to `useTimers.js` and remaining JS composables (opportunistically, when touching files)

### Wave 3 — Architecture investments (after Wave 2 features)
- [ ] IndexedDB migration via Dexie — `storage.ts` has the migration path comment; introduce a `StorageAdapter` interface first
- [ ] Remove Pinia refresh-after-write round-trip — after IndexedDB lands only
- [ ] Background SW update notification toast — `updatefound` event → "New version available, reload?" toast

## Active backlog

### P0
1. Weekly planner

### P1
1. Ingredient checklist in cooking mode
2. Recipe sharing via JSON link/QR
3. Meal prep / batch cooking view
4. Pantry ingredient tracking

### P2
1. Recipe duplication
2. Recipe collections / grouping
3. Search by ingredient
4. Diet / allergen filters

## Current product directions

### 1. Import architecture

Adapter-based pipeline for supported recipe websites:
1. domain normalization
2. adapter selection
3. site-specific parsing
4. generic fallback
5. tag and `preparationType` inference

Current supported adapters: `giallozafferano.it`, `ricetteperbimby.it`

New adapters go in `src/lib/import/adapters.ts`.

### 2. Recipe metadata richness

The recipe model supports:
- `source`, `sourceDomain`
- `preparationType` (`classic` | `bimby` | `airfryer`)
- `notes`, `favorite`, `tags`, `lastViewedAt`

This powers filtering, detail views, shopping list attribution, and future organizational features.

### 3. Preparation type as a first-class concept

`preparationType` is normalized and stored on every recipe.
It drives: card badges, filters, detail views, cooking mode instructions label, import inference.
The legacy `bimby: boolean` field is kept for backward compatibility.

## Feature specs

### Manual Import (form) — delivered

Outcome delivered: users can create recipes without a URL from the Import view.

Implemented MVP fields: name, category, servings, emoji, time, dynamic ingredients list, dynamic steps list, optional timer, preparation type.

### Weekly Planner

Outcome: assign recipes to day/meal slots over a week.

Suggested MVP: Monday–Sunday grid, lunch/dinner slots, recipe picker from saved book.

Suggested v2: generate shopping list from the week, drag and drop.

Files likely involved:
- new `src/views/PlannerView.vue`
- new `src/stores/planner.ts`
- `src/router/index.js`
- `src/lib/storage.ts`
- `src/lib/i18nData.js`

Acceptance criteria:
- persistent plan in `localStorage`
- simple add/remove workflow

## Recipe model reference

Current shape (v3), forward-compatible:

```js
{
  id: '...',
  name: '...',
  category: '...',
  preparationType: 'classic', // 'classic' | 'bimby' | 'airfryer'
  bimby: false,               // legacy compat
  emoji: '...',
  time: '20 min',
  servings: '4',
  source: 'web',
  sourceDomain: 'giallozafferano.it',
  ingredients: ['...'],
  steps: ['...'],
  timerMinutes: 10,
  notes: '',
  favorite: false,
  tags: [],
  lastViewedAt: 0,
}
```

Additions to the model must be backward-compatible and handled in `normalizeStoredRecipe()` in `src/lib/storage.ts`.

## Definition of done

A feature is complete when:
- it has working UI
- all new strings are in `src/lib/i18nData.js` (all 5 languages)
- state persists correctly via Pinia store → `localStorage`
- no console errors
- `npm run build` passes
- a targeted manual or Playwright verification was performed
