# CLAUDE.md

Primary guidance for Claude Code sessions in this repository.
For extended reference (stack snapshot, key files, editing guidelines, nutrition, import, agents) see `AGENTS.md`.

---

## Commands

```bash
npm run dev               # Dev server (localhost:4173)
npm run build             # Production build → dist/
npm run preview           # Serve built dist/ locally
npm run test:unit         # Run unit tests once (CI)
npm run test:watch        # Unit tests in watch mode
npm run test:smoke        # Live website import smoke tests (hits real sites)
npm run test:e2e          # Playwright E2E tests
npm run test:e2e:ui       # Playwright E2E with interactive UI
npm run build:duemme-pack # Build Duemme built-in recipe pack
npx vue-tsc --noEmit      # TypeScript check (run when touching .ts files)
```

---

## Architecture

**Cucina App** is an offline-first PWA cooking app — no backend, Dexie-first persistence with localStorage fallback, deployable to static hosting.

### Layer separation (critical)

* `src/lib/` — Pure logic, **no Vue imports**, fully unit-testable
* `src/stores/` — Pinia shared state
* `src/composables/` — Vue composition logic
* `src/views/` — Route views
* `src/components/` — Shared UI

---

## Decision rules

* Prefer simple solutions over complex abstractions
* Fix root causes, not symptoms
* Reuse existing modules before creating new ones
* Avoid duplication, especially in parsing and adapters
* Prefer missing data over incorrect data
* Every change must preserve existing user data
* Do not overengineer: prefer incremental improvements

---

## Workflow

Before editing:

1. Read `AGENTS.md`
2. Identify the affected area:

   * import
   * nutrition
   * nutrition goals
   * cooking mode
   * UI
   * storage
   * PWA
   * weekly planner
3. Check existing patterns before adding new ones
4. Make the smallest coherent change

After editing:

1. Run `npx vue-tsc --noEmit` (if TS touched)
2. Run `npm run build`
3. Validate manually in browser
4. Check console for errors
5. Validate a full recipe flow:

   * import → view → reload → persistence → cooking mode
6. If production assets changed → consider `CACHE_NAME` bump

---

## Non-negotiables

1. **i18n**: All user-facing strings go through `t('key')`
2. All new keys must exist in **IT/EN/DE/FR/ES**
3. **localStorage compatibility must never break**
4. **Pinia owns shared state**
5. **Service worker cache must be managed correctly**
6. **No large refactors for scoped tasks**
7. **No overengineering or unnecessary abstractions**

---

## When adding a feature

* Add i18n (5 languages)
* Wire persistence via store → `storage.ts`
* Reuse existing UI patterns
* Verify mobile behavior
* Validate full recipe flow end-to-end
* Run typecheck + build

---

## When working on website import

* Normalize domain via `normalizeSourceDomain()`
* Use adapter in `src/lib/import/adapters/`
* Do NOT break existing adapters
* Keep fallback honest
* Run `import-quality-auditor` before merge

---

## Bimby icon policy

Allowed keys:
`reverse`, `knead`, `scissors`, `cup`, `open`, `lock`

Do not extend without explicit approval + test updates.

---

## Common pitfalls

* **Stale service worker** → bump `CACHE_NAME`
* **Pinia ref unwrapping** → use `storeToRefs`
* **Storage writes** → handled at store level
* **HMR issues** → ignore, reload fixes
* **Import failures** → check adapters before hacking
* **i18n quotes** → must use `'...'` (no curly delimiters)

---

## E2E test conventions

E2E specs **must** import `test` and `expect` from `./fixtures`, not from
`@playwright/test`. The fixture installs default route handlers (currently a
stub for `**/world.openfoodfacts.org/**` that returns an empty product list)
on every `page`, so any spec that exercises the calculate flow is
automatically protected from live-network flakiness. Individual tests can
override a default by calling `page.route(...)` again — Playwright matches
handlers LIFO, so the per-test handler wins.

```ts
// Correct
import { expect, test } from './fixtures';

// Wrong — bypasses the fixture
import { expect, test } from '@playwright/test';
```

Type-only imports such as `type Page` should still come from
`@playwright/test`.

---

## Visual bug diagnosis with Playwright MCP

Visual layout bugs ("looks off", "not centered", "wrong size") are notoriously
hard to debug from screenshots alone. The screenshot tells you *what* looks
wrong; it rarely tells you *why*. Before guessing at CSS fixes, measure.

### Standard procedure

1. **Reproduce in Playwright** at the affected viewport(s). Mobile bugs often
   don't repro on desktop and vice versa — always test at least 375px and
   1024px.

2. **Screenshot the broken state** (full page + scoped to the affected element)
   for later comparison.

3. **Walk the DOM tree** of the affected region. For each node from the outer
   container down to the leaf, dump:

   * `getBoundingClientRect()` — left, right, top, bottom, width, height
   * Computed styles relevant to the symptom (for centering: `display`,
     `margin`, `padding`, `justify-content`, `text-align`, `transform`; for
     sizing: `width`, `height`, `box-sizing`, `overflow`; for stacking:
     `position`, `z-index`, `transform`)

4. **Locate the asymmetry.** For each parent/child pair, check whether the
   child is symmetric within the parent (`child.left - parent.left` should
   roughly equal `parent.right - child.right`). The first level where
   symmetry breaks is the culprit.

5. **Diagnose before fixing.** State which element is off, by how many pixels,
   which CSS property is responsible, and *why* that property has its current
   value. Only then write the fix.

### Why this beats DevTools

DevTools is faster for one-off inspection but worse for:

* Comparing measurements across viewports
* Capturing a reproducible diagnostic record in the PR
* Catching bugs where the visible portion is correct but the element overflows
  invisibly (the QR-clipping case — visually it looked off-center, in reality
  it was rendering at 480px inside a 288px container with `overflow: hidden`)

### Past examples

* **Share Recipe QR centering** (`RecipeDetailView.vue`): SVG injected via
  `v-html` rendered at intrinsic 480×480, clipped to top-left quarter by the
  288px container's `overflow: hidden`. Bounding-rect measurement at two
  viewports revealed the size mismatch immediately; the apparent off-centering
  was a symptom, not the cause.

---

## Specialized agents

Use repo-specific auditors when relevant:

* `import-quality-auditor`
* `cooking-ux-reviewer`
* `ui-consistency-enforcer`

Always run the relevant auditor before considering a change complete.

See `AGENTS.md` for full details.
