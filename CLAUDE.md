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

## Specialized agents

Use repo-specific auditors when relevant:

* `import-quality-auditor`
* `cooking-ux-reviewer`
* `ui-consistency-enforcer`

Always run the relevant auditor before considering a change complete.

See `AGENTS.md` for full details.
