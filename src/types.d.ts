/**
 * Shared TypeScript type definitions for cucina-app.
 * Gradual migration foundation — add types here as the codebase evolves.
 * JS files can reference these via JSDoc: @type {import('./types').Recipe}
 */

/** Preparation method for a recipe. */
export type PreparationType = 'classic' | 'bimby' | 'airfryer';

/** A single saved recipe. */
export interface Recipe {
  id: string;
  name: string;
  category?: string;
  emoji?: string;
  time?: string;
  servings?: string;
  difficolta?: string;
  source?: string;
  sourceDomain?: string;
  url?: string;
  preparationType?: PreparationType;
  /** Legacy field — derived from preparationType. */
  bimby?: boolean;
  ingredients: string[];
  steps: string[];
  timerMinutes?: number;
  favorite?: boolean;
  lastViewedAt?: number;
  notes?: string;
  tags?: string[];
}

/** A single item in the shopping list. */
export interface ShoppingItem {
  id: string;
  text: string;
  checked: boolean;
  sourceRecipeId?: string;
  sourceRecipeName?: string;
  createdAt: number;
}

/** A grouped set of shopping items (same ingredient, summable quantities). */
export interface ShoppingGroup {
  groupType: 'numeric' | 'exact';
  groupKey: string;
  baseName: string;
  displayName: string;
  unit: string;
  totalQty: number | null;
  displayQty: string;
  items: ShoppingItem[];
}

/** A shopping list section (proteins, carbs, …). */
export interface ShoppingSection {
  id: string;
  labelKey: string;
  grouped: ShoppingGroup[];
  ungrouped: ShoppingItem[];
}

/** Import preview before saving to the recipe book. */
export interface ImportPreviewRecipe extends Partial<Recipe> {
  id: string;
  name: string;
  ingredients: string[];
  steps: string[];
}
