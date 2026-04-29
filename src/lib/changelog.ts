export type ChangelogEntry = {
  version: string;
  date: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.10.5',
    date: '2026-04-29',
    changes: [
      'Meal Composer: add selected recipes to the weekly planner in one tap',
      'Accessibility: skip-to-content link, ConfirmDialog focus trap, aria-describedby on modal message',
      'PWA: manifest updated with lang, categories, English description; service worker cache bumped to v14',
      'SEO: meta description, og:title, og:description, apple-mobile-web-app-title added to index.html',
      'html lang attribute now reflects user language selection on startup',
    ],
  },
  {
    version: '0.10.4',
    date: '2026-04-28',
    changes: [
      'Editable daily nutrition goals (kcal, protein, carbs, fat, fiber) saved locally to your device',
      'Per-serving nutrition comparison against your daily goals with visual progress bars',
      'Goal progress bars highlight over-goal nutrients in a distinct color',
      'Nutrition goals persist across sessions and page reloads',
    ],
  },
  {
    version: '0.10.3',
    date: '2026-04-28',
    changes: [
      'TypeScript migration: bimbyIcons, builtinData, duemmeVettedPack, ninjaVettedPack, useTheme, i18n, i18nData, and main entry point converted from .js to .ts',
      'All import paths updated to extension-free form for full TypeScript resolver compatibility',
      'vue-tsc reports zero errors across the entire codebase',
    ],
  },
  {
    version: '0.10.2',
    date: '2026-04-27',
    changes: [
      'Nutrition summary extracted into its own component — smoother animation, reduced view complexity',
      'Nutrition editor now shows all recipe ingredients (including unmatched ones) so manual values can be filled in for every ingredient',
      'Manual per-100g overrides for unmatched ingredients now generate new nutrition entries and update totals correctly',
      'New CSS design tokens: --color-warn, --color-warn-bg, --color-accent (consistent theming across light/dark/system)',
    ],
  },
  {
    version: '0.10.1',
    date: '2026-04-27',
    changes: [
      'Base ingredients nutrition database covering 55 common Italian cooking ingredients (oats, milk, banana, honey, cinnamon, nuts, and more) — no internet required',
      'Volume-to-weight conversion for milk and water (ml → g) in nutrition calculations',
      'Macro donut ring animates on each calculation',
      'Manual nutrition quantity overrides persist and survive Recalculate',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-04-27',
    changes: [
      'Nutrition panel with macro donut chart (kcal, protein, fat, carbs) in recipe detail view',
      'Per-ingredient nutrition transparency: estimated grams, not-included list, manual overrides',
      'QR code sharing for recipes',
    ],
  },
];
