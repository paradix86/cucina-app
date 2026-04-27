export type ChangelogEntry = {
  version: string;
  date: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
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
