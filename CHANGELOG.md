# Changelog

All notable changes to this project will be documented in this file.

## [0.10.5] — 2026-04-29

### Added
- Meal Composer: "Add to weekly plan" panel — distribute selected recipes across breakfast/lunch/dinner slots for any day
- Nutrition goals: macro progress bars with % vs daily target
- Meal insights: high-protein, carb-heavy, high-fiber, balanced meal badges
- Skip-to-content link for keyboard navigation (all 5 languages)
- `apple-mobile-web-app-title` meta tag
- `og:title` and `og:description` Open Graph meta tags
- `<meta name="description">` for SEO
- PWA manifest: `lang`, `categories` fields; updated name and description

### Changed
- `index.html` `lang` attribute: `it` → `en` (runtime `initLanguage()` corrects to user preference immediately)
- PWA service worker cache bumped: `cucina-vue-v13` → `cucina-vue-v14`
- `package.json` version: `0.10.4` → `0.10.5`
- `@playwright/test` moved from `dependencies` to `devDependencies`
- Manifest app name: `Cucina Planner` → `Cucina App`

### Fixed
- `ConfirmDialog`: focus trap (Tab/Shift+Tab stays within dialog), Escape closes dialog, focus moves to first button on open, `aria-describedby` links dialog to message text
- `<main>` element now has `id="main-content"` as skip-link target

## [0.10.4] — 2026-04-28

### Added
- Meal Composer view: combine recipes and check total nutrition
- Nutrition goals: daily macro targets with progress bars
- Nutrition score upgrade UI

## [0.10.3] — 2026-04-27

### Changed
- Router migrated to TypeScript
- Recipe utilities migrated to TypeScript
