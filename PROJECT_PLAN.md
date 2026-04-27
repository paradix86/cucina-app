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
- Persistence is local-first: Dexie / IndexedDB when available, with `localStorage` fallback and backward-compatible mirrors
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
- [x] Shopping list — with smart grouping, quantity merging, section assignment, merge across recipes; name-first parsing (`maiale macinato 250 g` → quantities aggregate correctly)
- [x] Weekly planner — **delivered** (Mon–Sun grid, breakfast/lunch/dinner slots, recipe picker, persistent local-first storage)

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

### Milestone 7 — Nutrition MVP ✓ delivered
- [x] Nutrition data model (`NutritionPer100g`, `IngredientNutrition`, `RecipeNutrition`) in `src/types.ts`
- [x] Normalization and storage round-trip (`normalizeRecipeNutrition`, `normalizeIngredientNutritionArray`) in `src/lib/storage.ts`
- [x] Italian ingredient parser (`parseIngredientAmount`) in `src/lib/nutrition.ts`
- [x] Nutrition calculation engine (`calculateRecipeNutrition`, `parseServings`, `scaleNutritionBlock`) in `src/lib/nutrition.ts`
- [x] Provider abstraction (`NutritionProviderClient`, `NutritionSearchResult`, `manualProvider`, `getProvider`) in `src/lib/nutritionProviders.ts`
- [x] Multi-provider enrichment orchestrator with ordered fallback and alias-query confidence boost — `src/lib/nutritionEnrichment.ts`
- [x] OpenFoodFacts provider (CORS-safe, top-result selection, confidence scoring) registered in `NUTRITION_PROVIDERS`
- [x] Smart ingredient matching — `normalizeIngredientName`, `getIngredientAliases`, `buildNutritionSearchQueries` — `src/lib/ingredientMatching.ts`; alias table covers olio/farina/riso/pasta/zucchero/uova variants
- [x] Gram estimation from unit context (cucchiaio, cucchiaino, tazza, spicchio, foglia, pizzico…) — `estimateGrams()` in `src/lib/nutrition.ts`
- [x] Transparency UI — estimated quantities, excluded ingredients, provider attribution, confidence label — `src/lib/nutritionTransparency.ts` + `RecipeDetailView.vue`
- [x] Manual quantity override — `parseGramsInput`, `applyGramsOverrides` — `src/lib/nutritionOverride.ts`; inline per-ingredient gram editor with save/cancel in `RecipeDetailView.vue`; persists `status: 'manual'` + updated fingerprint
- [x] Staleness detection — `ingredientsFingerprint` on `RecipeNutrition`; stale-warning banner in UI
- [x] Nutrition section UI in `RecipeDetailView.vue` — badge, conic-gradient macro donut, nutrient grid, loading spinner, per-serving/per-recipe display, 44 px touch targets on `<details>`
- [x] i18n coverage — all 5 languages (IT/EN/DE/FR/ES), 20+ nutrition-specific keys
- [x] Dark-mode badge colors via CSS custom properties in `css/style.css`
- [x] `cloneRecipe` deep-clone of `nutrition` and `ingredientNutrition` in `src/stores/recipeBook.ts`
- [x] Unit tests — `nutrition.test.ts`, `nutritionProviders.test.ts`, `nutritionEnrichment.test.ts`, `ingredientMatching.test.ts`, `nutritionOverride.test.ts`, `store-nutrition.test.ts`
- [x] E2E tests — `tests/e2e/nutrition.spec.ts` (complete/partial/missing/estimated/not-included/manual-override flows)
- [x] Base ingredients provider (`base_ingredients`) — curated dataset of ~55 common Italian cooking ingredients in `src/lib/baseIngredientsData.ts`; safe alias matching with "di X" compound guard in `src/lib/baseIngredientsProvider.ts`; registered as second provider in enrichment chain (manual → base_ingredients → openfoodfacts); covers cereals, dairy, protein, legumes, fruit, vegetables, fats, condiments, nuts/seeds
- [x] Density-based ml→g conversion for known liquids (acqua 1.0, latte* 1.03) via `LIQUID_DENSITIES` in `src/lib/nutrition.ts`; extends `estimateGrams()` without breaking existing unit tests
- [x] Provider display name `'Base ingredients'` added to transparency map in `src/lib/nutritionTransparency.ts`
- [x] Unit tests — `baseIngredientsProvider.test.ts` (exact/starts-with/contains/safety/maxResults/ordering), `baseIngredientsEnrichment.test.ts` (coverage/priority/density/transparency), `estimateGrams.test.ts` ml/l density tests
- [x] E2E tests — porridge recipe (oats + milk + banana + cinnamon + honey); verifies kcal > 0, sources include "Base ingredients", oats matched with base_ingredients provider, density-derived grams, reload persistence

### Milestone 7 — Nutrition post-MVP backlog
- [ ] Per-100g manual override — let users enter their own `nutritionPer100g` values when a provider result is wrong or unavailable
- [ ] Provider selector UI — let users choose between available providers (manual built-in, OpenFoodFacts) per session or per recipe
- [ ] USDA FoodData Central provider — higher coverage for non-Italian ingredients; requires CORS proxy or edge function
- [ ] Micronutrient breakdown panel — vitamins (A, C, D, B12…) and minerals (iron, calcium…) where provider data includes them
- [ ] Base ingredients dataset expansion — add regional synonyms, more fruit/veg variants, prepared foods (sugo, brodo, etc.); each new entry requires aliases + unit tests per AGENTS.md rules
- [ ] Source provenance field on base_ingredients entries — record which food table (CREA, USDA) each value came from
- [ ] Nutrition import/export edge cases — round-trip fidelity for recipes with `status: 'manual'`; handle `ingredientsFingerprint` mismatch on shared-link import

### Milestone 6 — Architecture (v1 foundation delivered)
- [x] Vue 3 + Vite migration
- [x] Vue Router (hash history, app routes)
- [x] Pinia stores (recipeBook, shoppingList, weeklyPlanner)
- [x] TypeScript bootstrap (`tsconfig.json`, `allowJs`)
- [x] TypeScript migration (stores, storage/domain, import parsing layer)
- [x] VueUse targeted adoption
- [x] Adapter-based website import architecture
- [x] Internationalisation (IT, EN, DE, FR, ES)
- [x] PWA / service worker (`public/sw.js`, `public/manifest.webmanifest`)
- [x] Storage Phase 1/2 — `StorageAdapter` seam + Dexie-backed async adapter with fallback
- [ ] Storage Phase 3 — remaining sync compatibility cleanup and legacy call-site reduction

## Technical debt backlog (do before next feature wave)

### Wave 0 — Quick wins (≤1 day each, no risk)
- [x] Surface `saveRecipeBook` errors — `StorageWriteError` is thrown by storage and surfaced by Pinia stores via toast on recipe write/import failures
- [x] Fix `useTimers.js` interval lifecycle — visibility handling, interval cleanup, and test/HMR cleanup are implemented
- [ ] Normalize `timerMinutes` → seconds in `normalizeStoredRecipe()` — cooking mode recomputes it, but the right place is normalization

### Wave 1 — Code quality (2–4 days, feature-neutral)
- [x] Split `src/lib/import/adapters.ts` (1171 lines) into `adapters/index.ts` + one file per adapter + `jsonld.ts` + `generic.ts`
- [x] Route-level lazy loading — non-default routes are dynamic imports; main chunk dropped from ~648 kB to ~34 kB
- [x] Ninja built-in pack (`vetted_subset`) — emitted as a separate lazy chunk, not part of the initial bundle
- [ ] Bundle audit — residual heavy chunks: `i18n` (~153 kB gz 46), `storage/Dexie` (~147 kB gz 47); evaluate if further splitting is worthwhile
- [ ] Extend TypeScript to `useTimers.js` and remaining JS composables (opportunistically, when touching files)

### Wave 3 — Storage architecture
- [x] Phase 1: StorageAdapter interface — implemented in `src/lib/persistence/storageAdapter.ts`
- [x] Phase 2: Dexie / IndexedDB adapter — implemented in `src/lib/persistence/dexieAdapter.ts`
- [x] Phase 2: async Pinia hydration/write paths for recipe book, shopping list, and weekly planner
- [x] Phase 2: localStorage fallback / mirror retained for backward compatibility
- [ ] Phase 3: remove remaining legacy sync call sites and reduce refresh-after-write round trips
- [ ] Phase 3: harden migration/fallback verification for Dexie/localStorage compatibility
- [ ] Background SW update notification toast — `updatefound` event → "New version available, reload?" toast

## Active backlog

### Completed
1. ~~Weekly planner~~ — delivered in v0.10.0
2. ~~Import adapter split~~ — adapter registry and per-site files delivered
3. ~~Storage Phase 1/2~~ — adapter seam and Dexie-backed persistence delivered; Phase 3 remains
4. ~~Route-level lazy loading~~ — main chunk 34 kB; all non-default routes code-split
5. ~~Ingredient checklist in cooking mode~~ — in-memory tap-to-check per step; resets on exit/re-entry
6. ~~Recipe sharing~~ — backend-free share link (`/shared-recipe?data=…`), LZ-string compression + base64url fallback, save shared recipe, QR code modal, clipboard fallback; Web Share API path exists where available, but iOS/Android verification remains a P1 follow-up
7. ~~Nutrition MVP~~ — multi-provider enrichment (manual built-in + OpenFoodFacts), smart Italian ingredient matching with alias table, gram estimation from unit context, transparency UI, manual quantity override, staleness detection, full unit + E2E coverage

### Post-v1 stabilization
- [ ] RicettePerBimby live adapter hardening — verify against current live pages and add/update fixtures where stable
- [ ] E2E stability monitoring — keep watching route churn, storage bootstrap, import failures, and planner navigation regressions
- [x] PWA manifest/installability polish — migrated to `manifest.webmanifest`, icons reorganised under `/icons/`, paths verified
- [x] Lightweight report-problem footer link — implemented as mailto-based v1 entry point
- [x] Selected Recipe Book filter chip text visibility fix

### P0
- [ ] *(none currently)*

### P1
1. Post-v1 stabilization mostly delivered; RicettePerBimby live adapter hardening remains open before broader sharing
2. ~~Ingredient checklist in cooking mode~~ — delivered; in-memory, resets on exit
3. ~~Recipe sharing via JSON link/QR~~ — delivered; see Completed above
4. Meal prep / batch cooking view
5. Web Share API cross-browser verification (iOS Safari, Android Chrome) — follow-up to recipe sharing

### P2
1. Pantry ingredient tracking
2. Recipe duplication
3. Recipe collections / grouping
4. Search by ingredient
5. Diet / allergen filters

## Current product directions

### 1. Import architecture

Adapter-based pipeline for supported recipe websites:
1. domain normalization
2. adapter selection
3. site-specific parsing
4. generic fallback
5. tag and `preparationType` inference

Current supported adapters: `giallozafferano.it`, `ricetteperbimby.it`, `ricettebimbynet.it`, `vegolosi.it`

New adapters go in `src/lib/import/adapters/` (split from single adapters.ts file).
The adapter split is complete; live-site hardening remains ongoing, especially for RicettePerBimby.

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

### Weekly Planner — delivered

Outcome: users can assign recipes to day/meal slots over a week.

Implemented: Monday–Sunday grid, breakfast/lunch/dinner slots, recipe picker from saved book, persistent local-first plan.

Files involved:
- `src/views/WeeklyPlannerView.vue`
- `src/stores/weeklyPlanner.ts`
- `src/router/index.js`
- `src/lib/storage.ts`
- `src/lib/i18nData.js`

Acceptance criteria:
- [x] persistent plan in local-first storage
- [x] simple add/remove workflow

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
  coverImageUrl: 'https://example.com/cover.jpg', // optional; normalized to http/https only
  ingredients: ['...'],
  steps: ['...'],
  timerMinutes: 10,
  notes: '',
  favorite: false,
  tags: [],
  lastViewedAt: 0,
  // Nutrition — populated on demand via RecipeDetailView "Calculate" button
  ingredientNutrition: [
    {
      ingredientName: 'pasta',
      grams: 200,
      gramsEstimated: false,
      source: { provider: 'openfoodfacts' },
      nutritionPer100g: { kcal: 350, proteinG: 13, carbsG: 70, fatG: 1.5, fiberG: 2.7 },
    },
  ],
  nutrition: {
    status: 'complete',   // 'missing' | 'partial' | 'complete' | 'manual'
    perRecipe:  { kcal: 700, proteinG: 26, carbsG: 140, fatG: 3.0, fiberG: 5.4 },
    perServing: { kcal: 350, proteinG: 13, carbsG:  70, fatG: 1.5, fiberG: 2.7 },
    servingsUsed: 2,
    calculatedAt: '2026-04-27T11:00:00.000Z',
    ingredientsFingerprint: '200 g pasta',  // staleness guard; recalc clears stale-warning
    sources: [{ provider: 'openfoodfacts', confidence: 0.92 }],
  },
}
```

Additions to the model must be backward-compatible and handled in `normalizeStoredRecipe()` in `src/lib/storage.ts`.

## Definition of done

A feature is complete when:
- it has working UI
- all new strings are in `src/lib/i18nData.js` (all 5 languages)
- state persists correctly via Pinia store → local-first storage adapter
- no console errors
- `npm run build` passes
- a targeted manual or Playwright verification was performed
