# AGENTS.md

This file helps agents such as Codex work consistently inside this repository.

## Project Snapshot

- Stack: HTML + CSS + Vanilla JS
- No dependencies
- No bundler
- No build step
- App served as a static website / PWA

## Important Files

- `index.html`: UI structure and tab panels
- `css/style.css`: all styles
- `js/app.js`: app bootstrap and app metadata
- `js/ui.js`: rendering and navigation
- `js/storage.js`: `localStorage`, normalization, migrations
- `js/data.js`: built-in recipes
- `js/timer.js`: global timers
- `js/i18n.js`: translations
- `js/import.js`: core import flow
- `js/import-web.js`: website import coordination
- `js/import-adapters.js`: website adapter registry and parsing helpers
- `js/toast.js`: toast notifications
- `sw.js`: cache-first service worker

## Non-Negotiables

1. All user-facing UI strings must go through `t('key')`
2. No external dependencies
3. No large refactors when the request is narrowly scoped
4. Maintain compatibility with existing `localStorage`
5. If a cached static asset changes, update `CACHE_NAME` in `sw.js`

## Editing Guidelines

- Prefer surgical fixes
- Reuse the English naming already present in `v3` models
- If storage is touched, consider legacy data and migration/normalization
- If new UI is added, reuse existing classes and visual patterns
- Keep controls touch-friendly

## Verification Workflow

For UI features:

1. Start a local static server if needed
2. Open the app in Playwright
3. Clear service workers and caches if JS/CSS may be stale
4. Reload and confirm the current assets/scripts are actually loaded
5. Test the requested flow
6. Check console errors

## Common Pitfalls

- The app uses a cache-first service worker, so stale JS/CSS can differ from the latest code and create false bugs
- `innerHTML` can break state or references if not restored carefully
- Recipes may exist in legacy Italian shape (`nome`, `cat`, `fonte`) or newer English `v3` shape
- Functions using global `document.querySelector()` can hit the wrong node when hidden views still exist
- Website import logic should remain isolated per domain whenever possible

## Service Worker Hygiene

- If a cached static asset changes, bump `CACHE_NAME` in `sw.js`
- Do not trust a manual reproduction until service workers/caches were cleared and the fresh runtime was reloaded
- Playwright checks should account for stale-runtime issues before validating behavior

## Preferred Implementation Style

- Small, readable functions
- Minimal module-level state
- No extra abstraction unless it provides immediate value
- Keep CSS in the global stylesheet, organized with commented sections
- Prefer lightweight adapter-based parsing over giant generic parsers for website imports

## When Adding A Feature

- add i18n
- add UI
- add persistence if needed
- verify basic accessibility
- verify mobile/touch behavior
- update project plan or documentation if the feature introduces a new functional area

## When Working On Website Import

- normalize the domain first
- prefer a dedicated adapter for supported domains
- keep generic fallback behavior honest
- persist `source`, `sourceDomain`, and `preparationType` consistently
- preserve working site-specific parsers when adding new ones
