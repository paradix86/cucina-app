# AGENTS.md

This file helps agents (Codex, Claude Code, etc.) work consistently inside this repository.

## Stack snapshot

- **Framework**: Vue 3 (`<script setup>` SFCs)
- **Build**: Vite 8
- **Router**: Vue Router 4, hash history (`/#/route`)
- **State**: Pinia 3 (setup stores)
- **Types**: TypeScript foundation via `tsconfig.json` with `allowJs: true` — gradual adoption, files remain `.js`
- **Persistence**: `localStorage` only, no backend
- **PWA**: cache-first service worker in `public/sw.js`

## Key source files

| File | Role |
|---|---|
| `src/main.js` | Bootstrap — mounts Vue with Pinia and Router |
| `src/App.vue` | Root layout, `<RouterView>`, global event wiring |
| `src/router/index.js` | Route definitions (hash history) |
| `src/stores/recipeBook.js` | Pinia store — recipe array, mutations, computed |
| `src/stores/shoppingList.js` | Pinia store — shopping items, grouping, mutations |
| `src/composables/useImportFlow.js` | Per-instance import state and logic |
| `src/composables/useTimers.js` | Global timer state |
| `src/lib/storage.js` | localStorage CRUD + shopping list parsing/grouping |
| `src/lib/i18n.js` | `t('key')` translation function |
| `src/lib/i18nData.js` | Translation strings (IT, EN, DE, FR, ES) |
| `src/lib/builtinData.js` | Built-in recipe dataset |
| `src/lib/import/core.js` | URL detection, source type, domain normalization |
| `src/lib/import/web.js` | Fetch readable page, failure inference |
| `src/lib/import/adapters.js` | Domain adapter registry, generic fallback parser |
| `src/types.d.ts` | Shared ambient type declarations |
| `public/sw.js` | Cache-first service worker |
| `public/manifest.json` | PWA manifest |

## Non-negotiables

1. All user-facing strings must go through `t('key')` in `src/lib/i18n.js`
2. New i18n keys must be added to all five languages in `src/lib/i18nData.js`
3. No large refactors when the request is narrowly scoped
4. Maintain `localStorage` backward compatibility — existing saved data must survive upgrades
5. If a cached asset changes in a production deploy, bump `CACHE_NAME` in `public/sw.js`
6. Pinia stores own shared reactive state — do not introduce new module-level singleton refs for cross-view state

## Editing guidelines

- Prefer surgical, verifiable changes
- Use `storeToRefs(store)` when destructuring Pinia state in composables or setup — Pinia's reactive proxy auto-unwraps refs, breaking `.value` usage otherwise
- If touching `storage.js`, check whether existing saved data will survive (migration/normalization logic lives there)
- New UI should reuse existing classes and patterns — keep it touch-friendly
- When adding a new route, add it to `src/router/index.js` and add a tab entry in `App.vue`
- Keep `src/lib/` free of Vue imports — it holds pure logic only

## Verification workflow

1. `npm run dev` to start the dev server
2. Open the app in Playwright or browser
3. If JS/CSS behavior seems stale: clear service workers and caches, reload, confirm fresh assets loaded
4. Test the requested flow end to end
5. Check browser console for errors
6. Run `npm run build` to confirm the production build still passes

## Common pitfalls

- **Stale service worker**: the cache-first SW can serve old JS/CSS in a deployed environment; always bump `CACHE_NAME` after changing cached assets in production
- **Pinia ref unwrapping**: accessing `store.someRef` in script returns the unwrapped value; use `storeToRefs()` when you need the actual `Ref<T>` object
- **localStorage schema**: saved recipes may be in legacy Italian shape (`nome`, `cat`, `fonte`) or v3 English shape; `normalizeStoredRecipe()` in `storage.js` handles this — do not bypass it
- **HMR and Pinia**: during HMR, stale Pinia instances can produce momentary errors — these clear on full reload and are not real bugs
- **Website import failures**: some sites block fetch or have variable page structure; check `src/lib/import/web.js` and `adapters.js` before adding site-specific hacks

## Preferred implementation style

- Small, readable functions
- Pinia setup stores (function body, not options API) for new shared state
- No abstraction layers for single-use logic
- CSS stays in `css/style.css`, organized with commented sections
- Import adapters stay isolated per domain in `src/lib/import/adapters.js`

## When adding a feature

- add i18n strings (all 5 languages)
- add UI using existing patterns
- wire persistence if needed (via Pinia store → `src/lib/storage.js`)
- verify touch/tablet behavior
- verify console is clean
- run `npm run build`
- update docs if introducing a new functional area

## When working on website import

- normalize the domain via `normalizeSourceDomain()` in `src/lib/import/core.js`
- prefer a dedicated adapter for supported domains (`src/lib/import/adapters.js`)
- keep generic fallback behavior honest — do not over-claim coverage
- persist `source`, `sourceDomain`, and `preparationType` consistently
- do not break existing working adapters when adding new ones
