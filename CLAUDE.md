# CLAUDE.md

Primary guidance for Claude Code sessions in this repository. For extended reference (stack snapshot, key files, editing guidelines) see `AGENTS.md`.

## Commands

```bash
npm run dev           # Dev server (localhost:4173)
npm run build         # Production build → dist/
npm run preview       # Serve built dist/ locally
npm run test:unit     # Run unit tests once (CI)
npm run test:watch    # Unit tests in watch mode
npm run test:smoke    # Live website import smoke tests (hits real sites)
npx vue-tsc --noEmit  # TypeScript check (run when touching .ts files)
```

## Architecture

**Cucina App** is an offline-first PWA cooking app — no backend, Dexie-first persistence with localStorage fallback, deployable to static hosting.

### Layer separation (critical)

- `src/lib/` — Pure logic, **no Vue imports**. Fully unit-testable. Covers storage, i18n, import pipeline, ingredient parsing.
- `src/stores/` — Pinia setup stores (shared reactive state). `recipeBook.ts`, `shoppingList.ts`, `weeklyPlanner.ts`.
- `src/composables/` — Vue composition functions wrapping stores/lib logic for views.
- `src/views/` — One component per route (hash-based: `/#/route`).
- `src/components/` — Shared UI components.

### Import pipeline

URL import flow: `useImportFlow.ts` → `src/lib/import/core.ts` (URL detection, domain normalization) → `src/lib/import/web.ts` (fetch via Jina Reader proxy) → `src/lib/import/adapters/` (domain-specific parsers + generic fallback). Unit tests live in `tests/unit/import-*.test.ts`.

The adapters directory structure:
- `adapters/index.ts` — registry, dispatch, public exports (same surface as former `adapters.ts`)
- `adapters/utils.ts` — shared normalization, category, build helpers
- `adapters/giallozafferano.ts`, `ricetteperbimby.ts`, `ricettebimbynet.ts`, `vegolosi.ts` — named site adapters
- `adapters/jsonld.ts` — JSON-LD, WPRM, HTML meta extraction
- `adapters/generic.ts` — generic markdown heading-scanner fallback

### Storage & schema

`src/lib/storage.ts` is the public persistence facade. It currently delegates to an active synchronous `StorageAdapter`, with a built-in localStorage implementation as the default backend. The adapter contract lives in `src/lib/persistence/storageAdapter.ts`.

Saved recipes may be in legacy Italian shape (`nome`, `cat`, `fonte`) or v3 English shape — `normalizeStoredRecipe()` bridges both. **Never bypass this normalization.**

Write failures throw `StorageWriteError` (exported from `storage.ts`). Both Pinia stores catch this in every mutation method and show a `toast_storage_write_error` toast. Callers above the store layer do not need to handle storage errors — the store is the catch boundary.

The current adapter boundary is still synchronous for compatibility with the existing stores. A future Dexie/IndexedDB migration should enter through the adapter seam first, not by wiring IndexedDB calls directly into stores or views.

### Routing

Hash history (`/#/route`) for static hosting compatibility. Add new routes in `src/router/index.js` and a tab in `App.vue`.

## Non-negotiables

1. **i18n**: All user-facing strings go through `t('key')` (`src/lib/i18n.js`). New keys must be added to all 5 languages (IT/EN/DE/FR/ES) in `src/lib/i18nData.js`.
2. **localStorage backward compatibility**: Existing saved data must survive upgrades. Migrations live in `storage.ts`.
3. **Pinia for shared state**: Use `storeToRefs(store)` when destructuring Pinia state — direct destructuring breaks `.value` access.
4. **Service worker cache**: Bump `CACHE_NAME` in `public/sw.js` after changing any cached asset in a production deploy.
5. **Surgical changes**: No large refactors for narrowly scoped requests.

## When adding a feature

- Add i18n strings (all 5 languages)
- Wire persistence via Pinia store → `src/lib/storage.ts`
- Verify touch/tablet behavior
- Run `npx vue-tsc --noEmit` and `npm run build` before committing

## When working on website import

- Normalize domain via `normalizeSourceDomain()` in `src/lib/import/core.ts`
- Add site-specific logic as a dedicated adapter file in `src/lib/import/adapters/` and register it in `adapters/index.ts`
- Persist `source`, `sourceDomain`, and `preparationType` consistently
- Do not break existing adapters
- Run the `import-quality-auditor` agent before merging import changes

## Bimby icon policy

Approved Bimby action keys are intentionally frozen: `reverse`, `knead`, `scissors`, `cup`, `open`, `lock`. Do not add new ones without explicit product review + updating `tests/unit/bimby-action-icons.test.ts`. False positives are worse than missing icons.

## Common pitfalls

- **Stale service worker**: cache-first SW can serve old JS/CSS; always bump `CACHE_NAME` after production asset changes.
- **Pinia ref unwrapping**: `store.someRef` returns unwrapped value; `storeToRefs()` gives you the actual `Ref<T>`.
- **Storage write errors**: `saveRecipeBook` and `saveShoppingList` throw `StorageWriteError` on failure. Pinia stores catch this — do not add try/catch in views or composables above the store layer. If adding a new write path in a store, always wrap the save call with try/catch and call `onWriteError(e)` + `refresh()`.
- **HMR + Pinia**: momentary errors during hot reload are not real bugs — full reload clears them.
- **Timer lifecycle**: `useTimers.js` owns its singleton interval lifecycle, page-visibility catch-up, and HMR/test cleanup. Keep that explicit cleanup behavior when changing timers.
- **Website import failures**: some sites block fetch or vary structure; check `web.ts` and the relevant file in `adapters/` before adding hacks.
- **i18n curly quotes**: `i18nData.js` string values must use straight JS quotes (`'...'`) as delimiters. Curly typographic apostrophes (`'`) inside string values are fine; as delimiters they cause a parse error.

## Specialized agents

Three repo-specific subagents live in `.claude/agents/`. Invoke them when appropriate:

| Agent | Invoke when |
|---|---|
| `import-quality-auditor` | Adding/modifying an import adapter; investigating a site import regression; before merging `src/lib/import/` changes |
| `cooking-ux-reviewer` | Changing `CookingModeView.vue`, the step timer, timer composables, or cooking-related CSS |
| `ui-consistency-enforcer` | Adding new views, components, or visual CSS changes; verifying i18n completeness |

See `AGENTS.md` for full agent reference, including detailed trigger conditions and expected outputs.
