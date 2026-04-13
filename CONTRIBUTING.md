# CONTRIBUTING.md

Thanks for contributing to Cucina App.

This project is intentionally simple:
- static HTML / CSS / Vanilla JS
- no dependencies
- no bundler
- no build step

The goal is to keep the app lightweight, readable, and easy to run locally.

## Local setup

You can run the app in any of these ways:

### Option 1 — Open directly
Open `index.html` in your browser.

### Option 2 — Use a local static server
Any small static server is fine. Examples:

```bash
python -m http.server 3000
```

Then open:

```text
http://127.0.0.1:3000
```

Using a local server is preferred when testing:
- service worker behavior
- caching
- import flows
- Playwright checks

## Project structure

```text
index.html
css/style.css
js/app.js
js/data.js
js/i18n.js
js/import.js
js/import-web.js
js/import-adapters.js
js/storage.js
js/timer.js
js/toast.js
js/ui.js
sw.js
```

## Development rules

### 1. Keep it dependency-free
Do not add external libraries unless there is a very strong reason.

### 2. Keep it build-free
Do not introduce bundlers, transpilers, or framework tooling.

### 3. Keep changes small
Prefer focused, verifiable changes over broad refactors.

### 4. Respect i18n
All user-facing strings must go through `t('key')` in `js/i18n.js`.

### 5. Respect cached assets
If you change a static asset that is cached by the service worker, update `CACHE_NAME` in `sw.js`.

### 6. Preserve backward compatibility
Saved recipes may exist in:
- legacy Italian field shape
- newer English `v3` field shape

Do not break existing `localStorage` data.

### 7. Keep touch UX in mind
The app is designed for tablets and touchscreens. Avoid tiny controls or cramped layouts.

## Recipe model guidelines

Prefer the current English field shape for new work.

Example:

```js
{
  id: '...',
  name: '...',
  category: '...',
  preparationType: 'classic',
  bimby: false,
  emoji: '🍳',
  time: '20 min',
  servings: '4',
  source: 'web',
  sourceDomain: 'giallozafferano.it',
  ingredients: ['...'],
  steps: ['...'],
  timerMinutes: 0,
  notes: '',
  favorite: false,
  tags: []
}
```

## Website import guidelines

Website import uses a lightweight adapter-based architecture.

Current principles:
- normalize the domain first
- use a dedicated adapter for supported domains
- keep the generic fallback honest
- preserve `source`, `sourceDomain`, and `preparationType`
- do not break already working site adapters when adding a new one

Supported domain-specific adapters currently include:
- `giallozafferano.it`
- `ricetteperbimby.it`

## UI guidelines

- Reuse existing visual patterns and classes where possible
- Keep the design clean and touch-friendly
- Do not add visual noise
- When adding new UI sections, keep them consistent with the existing tab/card style

## CSS guidelines

- Keep CSS in `css/style.css`
- Use clearly commented sections
- Prefer extending the existing token/style system over adding disconnected styles
- Check both light and dark theme behavior

## Testing expectations

At minimum, for relevant changes:

1. run the app locally
2. test the affected flow manually
3. check browser console errors
4. if the change is UI/flow related, run a targeted Playwright verification
5. if caching behaves strangely, clear service workers and caches before re-testing

## Pull request checklist

Before opening a PR, verify that:

- [ ] the feature or fix works locally
- [ ] no obvious console errors were introduced
- [ ] all new UI strings are in `js/i18n.js`
- [ ] `CACHE_NAME` was updated in `sw.js` if needed
- [ ] backward compatibility with saved data was considered
- [ ] the change is scoped and does not include unnecessary refactors
- [ ] Playwright or a targeted manual verification was performed

## Documentation

If your change introduces:
- a new functional area
- a new workflow
- a new persistence model
- a new import adapter

update the relevant documentation:
- `README.md`
- `PROJECT_PLAN.md`
- `AGENTS.md`
- `CONTRIBUTING.md`
