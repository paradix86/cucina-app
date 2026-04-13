# Cucina App Project Plan

This file serves as an operational backlog and quick reference for both human development and agent-assisted work.

## Goals

- Make the app more useful during real cooking sessions on tablets and touchscreens
- Improve UX, local persistence, and offline reliability
- Add organizational features without introducing dependencies or a build step

## Constraints

- Vanilla JS, HTML, CSS
- No external dependencies
- No build step
- All user-facing strings must go through `t('key')` in `js/i18n.js`
- If a cached static asset changes, update `CACHE_NAME` in `sw.js`
- Persistence should remain `localStorage`-only unless there is an explicit decision to change it

## Release Order

### Milestone 1 — Cooking Core
- [x] `Step-by-step cooking mode` — `M`
- [x] `Toast notifications` — `S`
- [x] `Manual dark mode toggle` — `S`

### Milestone 2 — Personal Recipe Book
- [x] `Personal notes on recipes` — `S`
- [x] `Export / Import backup JSON (UI)` — `S`
- [ ] `Manual import (form)` — `M`

### Milestone 3 — Planning
- [ ] `Shopping list` — `M`
- [ ] `Weekly planner` — `L`

### Milestone 4 — Project Hygiene
- [x] `AGENTS.md` — `S`
- [ ] `CONTRIBUTING.md` — `S`

### Milestone 5 — Smart Features
- [ ] `Favorites` — `S`
- [ ] `Custom tags` — `M`
- [ ] `Recent recipes` — `S`
- [ ] `Advanced filters` — `M`
- [ ] `Meal prep / batch cooking` — `M`
- [ ] `Pantry suggestions` — `L`

## Prioritized Backlog

### P0
1. Manual import (form)
2. Shopping list
3. Weekly planner
4. Favorites
5. Recent recipes

### P1
1. Custom tags
2. Advanced filters
3. Pantry
4. Meal prep
5. CONTRIBUTING.md

### P2
1. Site filter in Recipe Book
2. Recipe collections
3. Ingredient checklist in cooking mode
4. Recipe duplication
5. JSON recipe sharing

## Current Product Directions

### 1. Import architecture
The app now uses a lightweight adapter-based import structure for supported recipe websites.

Current supported website adapters:
- `giallozafferano.it`
- `ricetteperbimby.it`

The architecture should continue evolving as:
- core import flow
- domain normalization
- adapter selection
- site-specific parsing
- generic fallback parser

### 2. Recipe metadata richness
The recipe model has evolved beyond the original MVP and now supports richer metadata, including:
- `source`
- `sourceDomain`
- `preparationType`
- `notes`

This metadata should continue to power:
- filtering
- saved recipe detail views
- future organizational features

### 3. Preparation type as a first-class concept
Recipes should continue being distinguished by cooking/preparation method:

- `classic`
- `bimby`
- `airfryer`

This should remain consistent across:
- cards
- filters
- detail views
- imports
- saved recipes

## Feature Specs

### 1. Manual Import
Outcome:
- Create a recipe without using a URL

Suggested MVP fields:
- name
- category
- servings
- optional emoji
- time
- dynamic ingredients
- dynamic steps
- optional main timer
- preparation type

Files likely involved:
- `index.html`
- `js/ui.js`
- `js/storage.js`
- `js/i18n.js`

Acceptance criteria:
- validated form
- saved into Recipe Book
- no backend required

### 2. Shopping List
Outcome:
- Extract ingredients from one or more recipes into a persistent list

Suggested MVP:
- add ingredients from recipe detail
- mark items as completed
- remove item
- clear list

Suggested v2:
- deduplicate similar ingredients
- grouping by category

Files likely involved:
- `js/storage.js`
- `js/ui.js`
- `index.html`
- `css/style.css`
- `js/i18n.js`

Acceptance criteria:
- persistent list
- easy ingredient addition from recipe detail

### 3. Weekly Planner
Outcome:
- Assign recipes to week/day slots

Suggested MVP:
- Monday–Sunday view
- lunch/dinner slots
- recipe selection from planner

Suggested v2:
- generate shopping list from the week
- drag and drop

Files likely involved:
- `js/storage.js`
- `js/ui.js`
- `index.html`
- `css/style.css`
- `js/i18n.js`

Acceptance criteria:
- persistent plan
- simple add/remove workflow

### 4. Favorites
Outcome:
- Allow users to quickly mark and revisit preferred recipes

Suggested model:
- `recipe.favorite = boolean`

Acceptance criteria:
- can toggle favorite
- visible in Recipe Book and/or filters
- persists after reload

### 5. Custom Tags
Outcome:
- Allow users to organize recipes with personal labels

Suggested model:
- `recipe.tags = string[]`

Acceptance criteria:
- add/remove tags
- persist after reload
- usable in future filtering

### 6. Recent Recipes
Outcome:
- Surface recently viewed or used recipes

Suggested model:
- `recipe.updatedAt`
- `recipe.lastViewedAt`

Acceptance criteria:
- recent ordering works
- remains backward-compatible with older saved data

### 7. Site Filter
Outcome:
- Filter saved imported recipes by source website/domain

Suggested basis:
- `recipe.sourceDomain`

Acceptance criteria:
- imported recipes can be grouped or filtered by site
- missing domains do not break old recipes

## Useful Additional Features

- Favorites
- Custom tags
- Recent recipes
- Include/exclude ingredient search
- Diet or allergen filters
- Ingredient checklist during cooking mode
- Pantry ingredient tracking
- Meal prep / batch cooking
- Recipe sharing via JSON
- Recipe duplication

## Competitive Features Seen In Apps Like Mr. Cook

- Guided cooking mode
- Meal planner
- Automatic shopping list
- Search by ingredient
- Favorites / collections
- Import from web/social
- Contextual timers
- Pantry suggestions
- Meal prep

## Suggested Data Model Extensions

Keep all additions backward-compatible with current local storage objects.

```js
{
  id: '...',
  name: '...',
  category: '...',
  preparationType: 'classic',
  bimby: false,
  emoji: '...',
  time: '20 min',
  servings: '4',
  source: 'classica',
  sourceDomain: '',
  ingredients: ['...'],
  steps: ['...'],
  timerMinutes: 10,
  notes: '',
  favorite: false,
  tags: [],
  updatedAt: 0,
  createdAt: 0
}
```

## Technical Notes For Codex

- Prefer small, verifiable changes
- Always consider whether the service worker may be serving stale JS
- When changing testable UI flows, rerun a targeted Playwright verification
- Avoid large refactors mixed with new feature work
- Reuse the existing English naming already present in `v3` storage where possible
- If a new feature requires a new tab, keep the design coherent with the existing tab structure

## Definition Of Done

A feature is considered complete when:

- it has working UI
- it has complete i18n strings
- it persists correctly when applicable
- it introduces no console errors
- it passes a targeted manual or Playwright verification
- it does not break offline/cache behavior
