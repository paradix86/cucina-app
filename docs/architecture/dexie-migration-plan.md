# Dexie Migration Plan

This document captures a pragmatic migration plan from the current `localStorage`
backend in `src/lib/storage.ts` to a Dexie/IndexedDB-backed persistence layer.

It is intentionally planning-only. It does not authorize a runtime migration by
itself.

Status note: the codebase now has a synchronous `StorageAdapter` seam in
`src/lib/persistence/storageAdapter.ts`, with `src/lib/storage.ts` acting as the
public facade over the active adapter. `localStorage` remains the only concrete
backend in production.

## Current State

The app currently persists three separate aggregates in `localStorage`:

- `cucina_recipebook_v3`
- `cucina_shopping_list_v1`
- `cucina_weekly_planner_v1`

The storage layer already owns:

- normalization and legacy migration for recipe-book records
- shopping-list CRUD and ingredient scaling write paths
- weekly-planner CRUD
- backup export/import for the recipe book
- write-failure hardening via `StorageWriteError`

Pinia stores currently treat `src/lib/storage.ts` as a synchronous repository
facade. Each store mutates persistence first, then refreshes in-memory state
from the backend.

## Dexie Fit Assessment

Dexie is a strong fit if the app needs:

- higher storage ceilings than `localStorage`
- fewer quota-related write failures for larger recipe books
- room for future indexes and query-driven UI
- a cleaner path for multi-entity transactions
- a more robust offline-first PWA persistence substrate

Dexie is not automatically valuable for:

- current UI responsiveness alone
- sync across devices
- import parsing quality
- shopping-list grouping correctness
- backup/export semantics

The main tradeoff is complexity:

- the persistence API becomes async
- store actions that are currently sync become async or require queued hydration
- startup/hydration sequencing becomes more important
- migration and rollback paths need explicit design

## Recommendation

Dexie is a good medium-term direction for this app, but not as a direct
"swap the backend" change. The right path is a staged migration that first
creates a storage adapter boundary, then introduces async hydration, then adds a
Dexie implementation, and only after that migrates user data.

## Target Architecture

Introduce a storage adapter boundary that sits below the Pinia stores and above
the concrete backend.

Suggested shape:

- `src/lib/persistence/types.ts`
- `src/lib/persistence/storageAdapter.ts`
- `src/lib/persistence/localStorageAdapter.ts`
- `src/lib/persistence/dexieAdapter.ts`
- `src/lib/persistence/index.ts`

Suggested adapter responsibilities:

- recipe book CRUD
- shopping-list CRUD
- weekly-planner CRUD
- recipe-book backup import/export
- one-time bootstrap migration from legacy sources

Suggested adapter contract:

- async reads and writes from day one
- normalized domain objects at the boundary
- no Vue imports
- backend-specific errors mapped to app-level storage errors

## Proposed Dexie Schema

Keep schema simple and aligned with existing aggregates.

Suggested tables:

- `recipes`: primary key `id`
- `shoppingItems`: primary key `id`, index on `sourceRecipeId`, `createdAt`
- `weeklyPlanner`: single-row table keyed by fixed id like `current`
- `meta`: migration state / bootstrap flags

Notes:

- `weeklyPlanner` should remain a single aggregate row initially; no need to
  normalize planner slots into a relational table yet.
- Shopping grouping should remain derived at read-time, not precomputed in DB.
- Recipe backup/export should continue to serialize normalized recipe objects so
  current backup semantics are preserved.

## Migration Sequence

### Phase 0: Preparation

- Extract storage adapter interface from `storage.ts`
- Make store hydration semantics explicit
- Add tests around current repository behavior before changing backend
- Separate browser-only export/import helpers from pure persistence logic where useful

### Phase 1: Async-Compatible Store Boundary

- Convert store persistence calls to async actions
- Add explicit app bootstrap hydration step
- Preserve current UX for write errors and refresh-on-failure behavior

This is the highest-risk architectural step because it affects how state is
loaded and refreshed throughout the app.

### Phase 2: LocalStorage Adapter Behind Interface

- Keep current behavior, but move implementation behind the new adapter
- Validate that the app still works without Dexie in the loop
- Freeze behavior with unit coverage

### Phase 3: Dexie Adapter Implementation

- Introduce Dexie and IndexedDB schema
- Implement adapter methods with the same normalized domain contract
- Add translation from Dexie/IDB failures to `StorageWriteError`-style app errors

### Phase 4: Bootstrap Data Migration

- On first Dexie-backed launch:
  - read `localStorage` aggregates
  - normalize them
  - write them into Dexie in one bootstrap routine
  - mark migration complete in Dexie `meta`
- Keep `localStorage` untouched during the first successful rollout for rollback safety

### Phase 5: Rollout and Cleanup

- Ship with Dexie as primary, `localStorage` as migration source only
- Observe stability
- Only later consider removing old bootstrap paths

## Rollback Strategy

Do not delete legacy `localStorage` keys during initial rollout.

Rollback plan:

- if Dexie init fails, fall back to `localStorage` adapter
- if Dexie migration partially fails, do not flip the "migration complete" marker
- keep export/import independent of Dexie-specific formats

This makes rollback a runtime adapter decision rather than a data-recovery event.

## Test Strategy

Add coverage in layers:

- unit tests for adapter contract behavior
- unit tests for bootstrap migration from `localStorage` payloads
- store tests for async hydration and mutation flows
- regression tests for backup export/import
- smoke tests for planner/shopping/recipe-book persistence across reload

Key scenarios:

- empty first launch
- legacy v2 recipe migration still works
- large recipe book import
- quota / write failure behavior
- fallback when Dexie open or transaction fails

## Risks

Primary risks:

- async migration ripples through stores and app bootstrap
- accidental divergence between localStorage and Dexie normalization rules
- partial bootstrap migration causing duplicate or stale data
- browser-specific IndexedDB quirks in private mode / restricted environments
- backup/import regressions if serialization format drifts

## What To Do Before Migrating

- formalize a persistence adapter interface
- decide store hydration lifecycle explicitly
- isolate browser file export/import helpers from persistence core
- document normalized record shapes as the app-level persistence contract

## What Not To Do Yet

- do not introduce Dexie directly into existing stores
- do not mix sync and async persistence semantics ad hoc
- do not redesign the planner/shopping/recipe-book data model during the backend migration
- do not change backup format at the same time as the backend migration
