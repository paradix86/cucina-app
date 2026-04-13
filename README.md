# 🍳 Cucina App

A cooking web app designed for tablets and touchscreens (Lenovo Yoga C930 and similar devices).

No backend, no installation, and no build step: open `index.html` and you are ready to go.

## Features

| Section | What it does |
|---|---|
| 📚 **Recipe Book** | Your saved recipes, searchable and persistent through `localStorage` |
| ＋ **Import** | Paste a YouTube / TikTok / Instagram / recipe website link and extract a structured recipe |
| 🍝 **Recipes** | Built-in recipes, including classic and Bimby TM5 recipes |
| ⏱ **Timer** | Multiple parallel timers, also launchable from recipes |

## How to use it

### Option 1 — Run locally in the browser

```bash
git clone https://github.com/your-username/cucina-app.git
cd cucina-app
# Open index.html in your browser
# or serve it with a small static server / Live Server
```

### Option 2 — GitHub Pages

1. Go to **Settings → Pages** in your repository
2. Select **Branch: main / root**
3. The app will be available at:

```text
https://your-username.github.io/cucina-app/
```

## Project structure

```text
cucina-app/
├── index.html
├── README.md
├── PROJECT_PLAN.md
├── AGENTS.md
├── CONTRIBUTING.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── data.js
│   ├── i18n.js
│   ├── import.js
│   ├── import-web.js
│   ├── import-adapters.js
│   ├── storage.js
│   ├── timer.js
│   ├── toast.js
│   └── ui.js
└── sw.js
```

## Recipe import

The `+ Import` feature supports multiple import paths depending on the URL type.

### Social / AI-assisted import

YouTube, TikTok, Instagram, and other supported flows may use the existing import pipeline for structured extraction.

### Website import

Recipe websites are handled through a lightweight adapter-based architecture:
- dedicated adapters for supported domains
- generic fallback parsing for unsupported websites when possible

Currently supported website adapters include:
- `giallozafferano.it`
- `ricetteperbimby.it`

Imported recipes can persist metadata such as:
- `source`
- `sourceDomain`
- `preparationType`

### Browser-only architecture note

Because the app is static and browser-based, some websites may still be limited by:
- CORS restrictions
- remote anti-bot protections
- unreadable or inconsistent page structure

The app should fail honestly when a site cannot be imported reliably.

## Built-in recipes

The app includes built-in recipes across multiple preparation methods:
- Classic
- Bimby TM5
- Air Fryer support is implemented at model/UI/filter level, even if the built-in dataset may currently contain no air fryer recipes

## Preparation types

Recipes are classified with a first-class `preparationType` field:

- `classic`
- `bimby`
- `airfryer`

Backward compatibility is preserved with the older `bimby: true/false` flag.

## Adding built-in recipes

Edit `js/data.js` and add an object to the built-in recipes array.

Example:

```js
{
  id: 'my-recipe-1',
  name: 'My Recipe',
  category: 'First Courses',
  preparationType: 'classic', // 'classic' | 'bimby' | 'airfryer'
  bimby: false,               // legacy compatibility if still needed
  emoji: '🍝',
  time: '30 min',
  servings: '4',
  source: 'classica',
  ingredients: ['200 g pasta', '...'],
  steps: ['Step 1...', 'Step 2...'],
  timerMinutes: 10,
}
```

For Bimby recipes, robot settings can still use the structured step format:

```text
"Vel. 5 · 3 sec — Step description"
"Temp. 100° · Vel. 1 · 10 min — Step description"
```

## Offline / PWA behavior

The app is served as a static PWA with a cache-first service worker.

Important development note:
- if a cached static asset changes, update `CACHE_NAME` in `sw.js`

## Compatibility

Tested in modern browsers such as:
- Chrome
- Firefox
- Safari
- Edge

Optimized for:
- tablets
- touchscreens
- tent/tablet usage
- light and dark themes

## License

MIT — free for personal and commercial use.
