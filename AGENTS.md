# AGENTS.md

Extended reference for AI agents working in this repository. Start with `CLAUDE.md` for concise session guidance; this file provides the deeper context.

## Stack snapshot

- **Framework**: Vue 3 (`<script setup>` SFCs)
- **Build**: Vite 8
- **Router**: Vue Router 4, hash history (`/#/route`)
- **State**: Pinia 3 (setup stores)
- **Types**: TypeScript gradual migration (`tsconfig.json`, `allowJs: true`)
- **Vue utilities**: VueUse (targeted adoption only)
- **Persistence**: Dexie/IndexedDB adapter with transparent `localStorage` fallback; no backend
- **PWA**: cache-first service worker in `public/sw.js`

## Key source files

| File | Role |
|---|---|
| `src/main.js` | Bootstrap — mounts Vue with Pinia and Router |
| `src/App.vue` | Root layout, `<RouterView>`, global event wiring |
| `src/router/index.ts` | Route definitions (hash history) |
| `src/stores/recipeBook.ts` | Pinia store — recipe array, mutations, computed |
| `src/stores/shoppingList.ts` | Pinia store — shopping items, grouping, mutations |
| `src/stores/weeklyPlanner.ts` | Pinia store — weekly meal-plan slots and mutations |
| `src/stores/nutritionGoalsStore.ts` | Pinia store — per-nutrient daily goals, persistence |
| `src/composables/useImportFlow.ts` | Per-instance import state and logic |
| `src/composables/useCookingPreferences.ts` | Cooking mode preference state (sound, wake lock) |
| `src/composables/useTimers.ts` | Global timer state + interval/visibility lifecycle |
| `src/composables/useTimerAlerts.ts` | Timer sound engine and alert modal state |
| `src/composables/useToasts.ts` | Toast notification stack state and helpers |
| `src/lib/storage.ts` | Public persistence facade + default localStorage adapter wiring |
| `src/lib/persistence/storageAdapter.ts` | Storage adapter contracts and future async seam |
| `src/lib/i18n.js` | `t('key')` translation function |
| `src/lib/i18nData.js` | Translation strings (IT, EN, DE, FR, ES) |
| `src/lib/builtinData.js` | Built-in recipe dataset |
| `src/lib/import/core.ts` | URL detection, source type, domain normalization |
| `src/lib/import/web.ts` | Fetch readable page, failure inference |
| `src/lib/import/adapters/index.ts` | Adapter registry, dispatch, public exports |
| `src/lib/import/adapters/utils.ts` | Shared normalization, category, build helpers |
| `src/lib/import/adapters/{site}.ts` | Per-site parsers: giallozafferano, ricetteperbimby, ricettebimbynet, vegolosi |
| `src/lib/import/adapters/jsonld.ts` | JSON-LD, WPRM, HTML meta extraction |
| `src/lib/import/adapters/generic.ts` | Generic markdown heading-scanner fallback |
| `src/lib/nutrition.ts` | Ingredient parsing, gram estimation, calculation engine |
| `src/lib/nutritionProviders.ts` | `NutritionProviderClient` interface, provider registry (manual → base_ingredients → openfoodfacts) |
| `src/lib/baseIngredientsData.ts` | Curated dataset of ~55 common Italian cooking ingredients |
| `src/lib/baseIngredientsProvider.ts` | `base_ingredients` provider implementation with safe alias matching |
| `src/lib/nutritionEnrichment.ts` | Multi-provider orchestrator with alias-query confidence boost |
| `src/lib/ingredientMatching.ts` | Ingredient name normalization, alias table, search query builder |
| `src/lib/nutritionTransparency.ts` | Derive estimated/excluded/sources/confidence from enrichment results |
| `src/lib/nutritionOverride.ts` | `parseGramsInput`, `applyGramsOverrides` for manual quantity editing |
| `src/types.ts` | Shared domain/import/storage/nutrition TypeScript types |
| `src/components/CookingModeView.vue` | Step-by-step cooking UI with per-step timer |
| `public/sw.js` | Cache-first service worker |
| `public/manifest.webmanifest` | PWA manifest |
| `css/style.css` | All app styles, organized with `/* ---- Section ---- */` markers |

## Non-negotiables

1. All user-facing strings must go through `t('key')` in `src/lib/i18n.js`
2. New i18n keys must be added to all five languages in `src/lib/i18nData.js`
3. No large refactors when the request is narrowly scoped
4. Maintain `localStorage` backward compatibility — existing saved data must survive upgrades
5. If a cached asset changes in a production deploy, bump `CACHE_NAME` in `public/sw.js`
6. Pinia stores own shared reactive state — do not introduce new module-level singleton refs for cross-view state

## Editing guidelines

- Prefer surgical, verifiable changes
- Use `storeToRefs(store)` when destructuring Pinia state in composables or setup
- If touching `storage.ts`, check whether existing saved data will survive (migration/normalization logic lives there)
- New UI should reuse existing CSS classes and design tokens (`var(--green)`, `var(--radius-md)`, etc.)
- When adding a new route, add it to `src/router/index.js` and add a tab entry in `App.vue`
- Keep `src/lib/` free of Vue imports — it holds pure logic only
- Use VueUse only when it replaces custom boilerplate with clear value
- All styles go in `css/style.css` — do not add `<style>` blocks to components
- Action icons in interactive card buttons must use inline SVG with `currentColor`, not Unicode glyphs
- `i18nData.js` string values must use straight JS quotes (`'...'`) as delimiters; curly apostrophes inside values are fine but must not be used as JS string delimiters

## Verification workflow

1. `npm run dev` to start the dev server
2. Exercise the affected flow end to end in the browser
3. If JS/CSS behavior seems stale: clear service workers and caches, reload, confirm fresh assets
4. Check browser console for errors
5. Run `npx vue-tsc --noEmit` when touching `.ts` files
6. Run `npm run build` to confirm the production build passes

## Common pitfalls

- **Stale service worker**: the cache-first SW can serve old JS/CSS in a deployed environment; always bump `CACHE_NAME` after changing cached assets in production
- **SW update toast only fires in production builds**: `initServiceWorkerUpdates` in `src/composables/useServiceWorker.ts` checks `import.meta.env.PROD` and explicitly unregisters all workers in dev mode. The "New version available — reload?" toast cannot appear during `npm run dev`. Use `npm run build && npm run preview` to exercise the full update flow. See **Service Worker update toast verification** in `README.md` for the step-by-step procedure.
- **Pinia ref unwrapping**: accessing `store.someRef` in script returns the unwrapped value; use `storeToRefs()` when you need the actual `Ref<T>` object
- **localStorage schema**: saved recipes may be in legacy Italian shape (`nome`, `cat`, `fonte`) or v3 English shape; `normalizeStoredRecipe()` in `storage.ts` handles this — do not bypass it
- **Storage adapter seam**: `src/lib/storage.ts` is now the public persistence facade over an active synchronous `StorageAdapter`. Keep stores importing the facade, not a concrete backend implementation, so a future IndexedDB/Dexie adapter can be introduced without rewiring store call sites.
- **Storage write errors**: `saveRecipeBook` and `saveShoppingList` throw `StorageWriteError` (exported from `storage.ts`) on quota-exceeded or any write failure. Both Pinia stores catch this in every mutation method. Do not add storage try/catch above the store layer. When adding a new write path in a store, wrap with try/catch, call the local `onWriteError(e)` helper, then call `refresh()`.
- **HMR and Pinia**: during HMR, stale Pinia instances can produce momentary errors — these clear on full reload and are not real bugs
- **Timer lifecycle**: `useTimers.js` owns the singleton interval, page-visibility catch-up, and HMR/test cleanup. Preserve that explicit cleanup model when changing timers.
- **Website import failures**: some sites block fetch or have variable page structure; check `src/lib/import/web.ts` and the relevant file in `src/lib/import/adapters/` before adding site-specific hacks
- **i18n curly quotes**: the Edit tool can silently convert straight JS quote delimiters to curly typographic quotes when replacing French/Italian text. Always verify `i18nData.js` builds cleanly after editing that file

## When adding a feature

- Add i18n strings (all 5 languages)
- Add UI using existing CSS patterns and design tokens
- Wire persistence if needed (via Pinia store → `src/lib/storage.ts`)
- Verify touch/tablet behavior
- Verify console is clean
- Run `npx vue-tsc --noEmit` when touching TS modules
- Run `npm run build`
- Update docs if introducing a new functional area

## When working on website import

- Normalize the domain via `normalizeSourceDomain()` in `src/lib/import/core.ts`
- Prefer a dedicated adapter file in `src/lib/import/adapters/` for supported domains; register it in `adapters/index.ts`
- Keep generic fallback behavior honest — do not over-claim coverage
- Persist `source`, `sourceDomain`, and `preparationType` consistently
- Do not break existing working adapters when adding new ones
- Run `import-quality-auditor` before merging

## When working on nutrition

The nutrition feature follows the same lib/store/view separation as the rest of the app.

**Key files**:

| File | Role |
|---|---|
| `src/lib/nutrition.ts` | Pure logic: `parseIngredientAmount`, `estimateGrams`, `calculateRecipeNutrition`, `scaleNutritionBlock` |
| `src/lib/nutritionProviders.ts` | `NutritionProviderClient` interface, provider registry `NUTRITION_PROVIDERS` (manual → base_ingredients → openfoodfacts) |
| `src/lib/baseIngredientsData.ts` | Curated dataset of ~55 common Italian cooking ingredients (`BaseIngredientNutritionEntry[]`) — values from CREA/USDA food composition tables |
| `src/lib/baseIngredientsProvider.ts` | `base_ingredients` provider: exact-alias, starts-with, and safe-contains matching with "di X" compound safety guard |
| `src/lib/nutritionEnrichment.ts` | Multi-provider orchestrator: `enrichRecipeNutritionWithProviders(recipe, providers, options?)` — tries providers in order, alias queries with confidence boost |
| `src/lib/ingredientMatching.ts` | `normalizeIngredientName`, `getIngredientAliases` (alias table for olio/farina/riso/pasta/zucchero/uova variants), `buildNutritionSearchQueries` |
| `src/lib/nutritionTransparency.ts` | `deriveEstimatedIngredients`, `deriveExcludedIngredients`, `deriveProviderNames`, `deriveConfidenceLabel` |
| `src/lib/nutritionOverride.ts` | `parseGramsInput` (comma/dot decimal, rejects zero/negative), `applyGramsOverrides` (immutable update, forces `status: 'manual'`) |
| `src/types.ts` | `NutritionPer100g`, `IngredientNutrition`, `RecipeNutrition` (incl. `ingredientsFingerprint`), `ParsedIngredientAmount` |
| `src/lib/storage.ts` | `normalizeRecipeNutrition`, `normalizeIngredientNutritionArray` — called in `normalizeStoredRecipe()` |
| `src/stores/recipeBook.ts` | `cloneRecipe` deep-clones `nutrition` and `ingredientNutrition` |
| `src/components/RecipeDetailView.vue` | Nutrition UI: badge, macro donut, nutrient grid, loading spinner, transparency panel, staleness warning, manual gram editor |
| `css/style.css` | CSS custom properties for badge and macro theming (`--nutrition-*`) |

**Architecture rules**:
- All nutrition logic lives in `src/lib/` — no API calls, no Vue imports, fully unit-testable.
- Adding a new provider means implementing `NutritionProviderClient` and appending to `NUTRITION_PROVIDERS` in `nutritionProviders.ts`. No changes to the enrichment orchestrator or UI are needed.
- The enrichment orchestrator tries providers in array order. Within each provider it tries queries in the order returned by `buildNutritionSearchQueries`: primary normalized name first, then alias bases. A confidence boost of +0.05 (clamped to 1.0) is applied to alias-query matches because alias mappings are explicit and reliable.
- `enrichRecipeNutritionWithProviders` never mutates its input recipe. Callers must call `recipeBookStore.update(id, { ingredientNutrition, nutrition })` to persist.
- `applyGramsOverrides` never mutates its inputs. It always sets `status: 'manual'` on the returned `RecipeNutrition` regardless of what the inputs said.
- `normalizeRecipeNutrition` and `normalizeIngredientNutritionArray` must be called in `normalizeStoredRecipe()` to ensure stored nutrition survives app upgrades. If adding a new field to `RecipeNutrition`, add its preservation to `normalizeRecipeNutrition` at the same time.
- `ingredientsFingerprint` is `recipe.ingredients.join('|')` stored on `RecipeNutrition` at calculation time. The UI compares it on render to detect staleness. Always write the fingerprint when calling `recipeBookStore.update` after a nutrition calculation or override.
- Badge theming uses CSS custom properties defined in all 4 theme contexts (`:root`, `[data-theme="light"]`, `[data-theme="dark"]`, `@media prefers-color-scheme: dark`).
- All user-facing nutrition strings use `t('key')` — 20+ nutrition-specific keys are defined in `i18nData.js` across IT/EN/DE/FR/ES.

**Base ingredients dataset rules** (`src/lib/baseIngredientsData.ts`):
- **Never add broad unsafe fallbacks.** "farina di mandorle" must NOT match the wheat flour entry; "latte di soia" must NOT match cow milk. The "di X" compound guard in `baseIngredientsProvider.ts` enforces this at runtime, but aliases must also be precise.
- **Every new entry requires: unique `id`, `canonicalName`, non-empty `aliases` array, and at least one matching unit test in `tests/unit/baseIngredientsProvider.test.ts`.**
- **Prefer missing data over wrong data.** Do not invent values. If you don't have a reliable reference (CREA/USDA), leave the ingredient out.
- **Values are generic estimates, not medical or dietetic advice.** The data file header comment must always say so.
- When adding a liquid ingredient, consider whether it also needs a density entry in `LIQUID_DENSITIES` in `src/lib/nutrition.ts` and an `estimateGrams` test in `tests/unit/estimateGrams.test.ts`.

**When extending the alias table** (`src/lib/ingredientMatching.ts`):
- Add entries to `ALIAS_RULES` only — no other file needs changing.
- The rule format is `{ trigger: 'full normalized name', base: 'shorter lookup term' }`.
- Triggers must be normalized (lowercase, trimmed, single-space). Add a test case in `tests/unit/ingredientMatching.test.ts` for each new rule.

**Test files**:
- `tests/unit/nutrition.test.ts` — calculation engine and gram estimation
- `tests/unit/estimateGrams.test.ts` — `estimateGrams` unit conversions including ml/l density
- `tests/unit/nutritionProviders.test.ts` — provider matching and confidence scoring
- `tests/unit/baseIngredientsProvider.test.ts` — exact/starts-with/contains/safety/ordering for base_ingredients
- `tests/unit/baseIngredientsEnrichment.test.ts` — enrichment integration with base_ingredients + density + priority
- `tests/unit/nutritionEnrichment.test.ts` — multi-provider fallback and alias-query behavior
- `tests/unit/ingredientMatching.test.ts` — normalizer, alias table, query builder (40 tests)
- `tests/unit/nutritionOverride.test.ts` — `parseGramsInput` and `applyGramsOverrides` (20 tests)
- `tests/unit/store-nutrition.test.ts` — Pinia store integration
- `tests/e2e/nutrition.spec.ts` — complete/partial/missing/estimated/not-included/manual-override/porridge E2E flows

## Bimby icon policy freeze

The Bimby step-icon action set is intentionally closed to:
- `reverse`, `knead`, `scissors`, `cup`, `open`, `lock`

Do not add generic actions (e.g., `simmer`, `tare`) or broaden matching rules. False positives are worse than missing icons. Any action-set expansion requires explicit product review plus updates to `tests/unit/bimby-action-icons.test.ts`.

---

## Specialized subagents

Three repo-specific subagents are registered in `.claude/agents/`. They are read-only auditors that produce structured findings reports — they do not make code changes.

### `import-quality-auditor`

**File**: `.claude/agents/import-quality-auditor.md`

**Purpose**: Audits the URL import pipeline for adapter coverage, field normalization correctness, fixture quality, text normalization, and error handling robustness.

**Invoke when**:
- Adding or modifying an import adapter in `src/lib/import/adapters/`
- A site import regression is reported
- Touching `src/lib/import/web.ts` or `src/lib/import/core.ts`
- Before merging any `src/lib/import/` change

**Expected output**: Structured report covering each adapter, field normalization per adapter, fixture coverage gaps, and a merge-ready / needs-fixes recommendation.

**Maintenance**: When adding a new adapter, verify the auditor's fixture-coverage check still applies (it reads `tests/unit/import-adapters.test.ts` and `tests/fixtures/`). If new fixture conventions are adopted, update the "Files to audit" list in the agent definition.

---

### `cooking-ux-reviewer`

**File**: `.claude/agents/cooking-ux-reviewer.md`

**Purpose**: Reviews cooking mode UX — timer visibility, edit affordance, mobile input quality, step navigation, accessibility, wake lock behavior, layout consistency, and i18n completeness for cooking-related keys.

**Invoke when**:
- Changing `src/components/CookingModeView.vue`
- Modifying the step timer or `src/composables/useTimerAlerts.js`
- Touching `src/composables/useCookingPreferences.js`
- Adding or changing CSS in the `/* ---- Cooking mode ---- */` section of `css/style.css`

**Expected output**: Structured review covering each dimension (timer, navigation, accessibility, i18n), with specific file and line references, and a ship-ready / needs-fixes recommendation.

**Maintenance**: If new cooking-mode i18n keys are added, update the "i18n completeness" checklist in the agent definition. If new major features are added to cooking mode (e.g., multi-step sub-timers), update the agent's scope section accordingly.

---

### `ui-consistency-enforcer`

**File**: `.claude/agents/ui-consistency-enforcer.md`

**Purpose**: Enforces UI consistency across all views and components — i18n completeness in all 5 languages, touch target sizing, light/dark theme coverage, inline SVG icon usage, button and card markup patterns, CSS organization, and Pinia reactivity patterns.

**Invoke when**:
- Adding a new view (`src/views/`) or shared component (`src/components/`)
- Making visual/CSS changes that affect more than one component
- Verifying i18n completeness after adding several new keys
- After a UX pass that touches buttons, cards, or action icons

**Expected output**: Structured report covering each consistency dimension with file:line references, and a consistent / needs-fixes recommendation.

**Maintenance**: When new design tokens are added to `:root` in `css/style.css`, verify the agent's "Theme coverage" check still correctly identifies which tokens are canonical. If new button variants are established, update the "Button and card patterns" section in the agent definition.

---

## Agent maintenance rules

- Agent definitions live in `.claude/agents/` as Markdown files with YAML frontmatter
- Agents are read-only auditors by convention — they should not be given write tools (`Edit`, `Write`, `Bash`) unless explicitly extending their scope
- When a new functional area is added to the app, assess whether an existing agent's scope should be extended or a new agent is warranted
- Keep agent `description` fields specific — they are used by the routing layer to decide whether to delegate a task to the agent
- Do not duplicate audit logic across agents; each agent owns a distinct quality surface
