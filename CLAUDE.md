# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Cucina App** is an offline-first PWA cooking app — no backend, localStorage only, deployable to static hosting.

### Layer separation (critical)

- `src/lib/` — Pure logic, **no Vue imports**. Fully unit-testable. Covers storage, i18n, import pipeline, ingredient parsing.
- `src/stores/` — Pinia setup stores (shared reactive state). `recipeBook.ts`, `shoppingList.ts`.
- `src/composables/` — Vue composition functions wrapping stores/lib logic for views.
- `src/views/` — One component per route (hash-based: `/#/route`).
- `src/components/` — Shared UI components.

### Import pipeline

URL import flow: `useImportFlow.ts` → `src/lib/import/core.ts` (URL detection, domain normalization) → `src/lib/import/web.ts` (fetch via Jina Reader proxy) → `src/lib/import/adapters.ts` (domain-specific parsers + generic fallback). Unit tests live in `tests/unit/import-*.test.ts`.

### Storage & schema

`src/lib/storage.ts` handles all localStorage CRUD. Saved recipes may be in legacy Italian shape (`nome`, `cat`, `fonte`) or v3 English shape — `normalizeStoredRecipe()` bridges both. **Never bypass this normalization.**

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
- Add site-specific logic as a dedicated adapter in `src/lib/import/adapters.ts`
- Persist `source`, `sourceDomain`, and `preparationType` consistently
- Do not break existing adapters

## Bimby icon policy

Approved Bimby action keys are intentionally frozen: `reverse`, `knead`, `scissors`, `cup`, `open`, `lock`. Do not add new ones without explicit product review + updating `tests/unit/bimby-action-icons.test.ts`. False positives are worse than missing icons.

## Common pitfalls

- **Stale service worker**: cache-first SW can serve old JS/CSS; always bump `CACHE_NAME` after production asset changes.
- **Pinia ref unwrapping**: `store.someRef` returns unwrapped value; `storeToRefs()` gives you the actual `Ref<T>`.
- **HMR + Pinia**: momentary errors during hot reload are not real bugs — full reload clears them.
- **Website import failures**: some sites block fetch or vary structure; check `web.ts` and `adapters.ts` before adding hacks.
