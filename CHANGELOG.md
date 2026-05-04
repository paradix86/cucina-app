# Changelog

All notable changes to cucina-app are documented in this file.

This file is **automatically generated** from `src/lib/changelog.ts` —
do not edit by hand. To add a new release, update the TypeScript file
and run `npm run changelog`.

The format follows [Keep a Changelog](https://keepachangelog.com/) —
conventions adapted to the project's flat-string entry shape.

## [v0.10.13] - 2026-05-02

- Recipe import from GialloZafferano blog posts now works correctly (e.g. blog.giallozafferano.it/<author>/...)
- Empty placeholder steps are now filtered out from imported recipes

## [v0.10.12] - 2026-05-01

- Show a banner when the app goes offline, so you always know your connection status
- Disable import and nutrition buttons while offline, with an explanation tooltip
- App shortcuts added to the home screen icon (Shopping List, Weekly Planner, My Recipes)
- PWA manifest updated with W3C fields for better installability on Android and desktop
- Disabled buttons are now visually dimmer for clearer affordance
- Service worker now automatically precaches all hashed JS/CSS bundles at install time

## [v0.10.11] - 2026-04-30

- Timer slider accent color now uses the app green for a consistent look across browsers
- Cooking mode timer: Min/Sec labels visible on mobile for easier time entry
- Meal Composer hidden-recipes link is now actionable copy in all 5 languages
- Dev toolchain: commitlint + husky enforce Conventional Commits on every commit; npm run commit launches an interactive helper

## [v0.10.10] - 2026-04-30

- Obiettivi nutrizionali: nuova sezione dedicata per impostare i tuoi target giornalieri di calorie, proteine, carboidrati, grassi e fibre — raggiungila dal menu "Altro"
- Libro ricette — filtro per tag: seleziona uno o più tag per trovare solo le ricette che ti servono; la selezione è inclusiva (OR) per non perdere nessuna variante
- Libro ricette — ordinamento: ordina per nome, tempo di cottura crescente o visualizzate di recente
- Lista della spesa: aggiungi voci libere manualmente, senza dover aprire una ricetta
- Modalità cottura: il progresso degli step e il segno di spunta degli ingredienti vengono salvati automaticamente — se esci per sbaglio o cambi app ritrovi tutto dove l'avevi lasciato (persiste 48 ore)
- Timer: nuovo pulsante "+2 min" sugli avvisi dei timer scaduti per prorogare il conto senza riavviare da zero

## [v0.10.9] - 2026-04-29

- Navigation overhauled: sidebar on desktop (≥1280 px) with icons and labels; bottom bar on mobile retains the 4 primary tabs plus a "More" panel for secondary sections
- New "More" panel slides up from the bottom nav to reach Import, Guides, and Meal Composer without crowding the main bar
- Nav icons added to all tabs — each section now has a dedicated SVG icon for faster recognition
- nav_more i18n key added in all 5 languages (IT/EN/DE/FR/ES)
- Service worker: update toast now shows an action button; controller-change auto-reload is guarded against duplicate reloads
- Service worker cache bumped to cucina-vue-v18

## [v0.10.8] - 2026-04-29

- Timer alerts now open a dedicated modal instead of a toast — harder to miss on mobile
- All timer sounds tuned louder and cleaner; oscillator types revised for better clarity
- Cooking mode timer reset now correctly stops the interval before resetting the display
- Cooking mode timer face shows a dash when no timer is set, and dims when inactive
- Timer inputs use numeric keyboard on mobile (inputmode="numeric")
- Timer alert modal: proper aria-labelledby / aria-describedby for screen readers
- Cooking step "ready" status badge now uses a neutral style distinct from the running (green) state
- CSS: cooking timer button specificity fixed — removed stray !important overrides
- "You can edit the timer whenever needed" hint updated in all 5 languages

## [v0.10.7] - 2026-04-29

- Meal Composer: recipes without nutrition data can now be added to a meal — shown with a warning badge and a direct link to calculate their nutrition
- Meal Composer draft selection now persists across page reloads (moved from sessionStorage to localStorage)
- Recipe detail view: "Add to meal" and "Add to planner" buttons promoted to a dedicated planning row above other actions
- Import: typed error classes replace string-coded errors for more reliable failure stage detection
- New i18n keys in all 5 languages: meal_composer_calc_nutrition, meal_composer_excluding_note, nutrition_missing_label

## [v0.10.6] - 2026-04-29

- Nutrition enrichment now passes the active UI language to each provider for more accurate ingredient matching

## [v0.10.5] - 2026-04-29

- Meal Composer: add selected recipes to the weekly planner in one tap
- Accessibility: skip-to-content link, ConfirmDialog focus trap, aria-describedby on modal message
- PWA: manifest updated with lang, categories, English description; service worker cache bumped to v14
- SEO: meta description, og:title, og:description, apple-mobile-web-app-title added to index.html
- html lang attribute now reflects user language selection on startup

## [v0.10.4] - 2026-04-28

- Editable daily nutrition goals (kcal, protein, carbs, fat, fiber) saved locally to your device
- Per-serving nutrition comparison against your daily goals with visual progress bars
- Goal progress bars highlight over-goal nutrients in a distinct color
- Nutrition goals persist across sessions and page reloads

## [v0.10.3] - 2026-04-28

- TypeScript migration: bimbyIcons, builtinData, duemmeVettedPack, ninjaVettedPack, useTheme, i18n, i18nData, and main entry point converted from .js to .ts
- All import paths updated to extension-free form for full TypeScript resolver compatibility
- vue-tsc reports zero errors across the entire codebase

## [v0.10.2] - 2026-04-27

- Nutrition summary extracted into its own component — smoother animation, reduced view complexity
- Nutrition editor now shows all recipe ingredients (including unmatched ones) so manual values can be filled in for every ingredient
- Manual per-100g overrides for unmatched ingredients now generate new nutrition entries and update totals correctly
- New CSS design tokens: --color-warn, --color-warn-bg, --color-accent (consistent theming across light/dark/system)

## [v0.10.1] - 2026-04-27

- Base ingredients nutrition database covering 55 common Italian cooking ingredients (oats, milk, banana, honey, cinnamon, nuts, and more) — no internet required
- Volume-to-weight conversion for milk and water (ml → g) in nutrition calculations
- Macro donut ring animates on each calculation
- Manual nutrition quantity overrides persist and survive Recalculate

## [v0.10.0] - 2026-04-27

- Nutrition panel with macro donut chart (kcal, protein, fat, carbs) in recipe detail view
- Per-ingredient nutrition transparency: estimated grams, not-included list, manual overrides
- QR code sharing for recipes
