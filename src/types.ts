export type PreparationType = 'classic' | 'bimby' | 'airfryer';
export type PlannerDayId = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type PlannerMealSlot = 'breakfast' | 'lunch' | 'dinner';
export type WeeklyPlanner = Record<PlannerDayId, Record<PlannerMealSlot, string | null>>;

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
  coverImageUrl?: string;
  preparationType?: PreparationType;
  bimby?: boolean;
  ingredients: string[];
  steps: string[];
  timerMinutes?: number;
  favorite?: boolean;
  lastViewedAt?: number;
  notes?: string;
  tags?: string[];
  mealOccasion?: string[];
}

export interface ShoppingItem {
  id: string;
  text: string;
  checked: boolean;
  sourceRecipeId?: string;
  sourceRecipeName?: string;
  createdAt: number;
}

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

export interface ShoppingSection {
  id: string;
  labelKey: string;
  grouped: ShoppingGroup[];
  ungrouped: ShoppingItem[];
}

export type ParsedIngredientConfidence = 'high' | 'low';
export type ParsedIngredientUnit = 'g' | 'kg' | 'ml' | 'l' | 'eggs' | 'pieces';
export type ShoppingSectionId =
  | 'proteins'
  | 'carbs'
  | 'vegetables_fruit'
  | 'dairy_eggs'
  | 'fats_oils_spices'
  | 'other';

export interface ParsedIngredient {
  raw: string;
  parsedQty: number | null;
  parsedUnit: ParsedIngredientUnit | null;
  parsedName: string | null;
  confidence: ParsedIngredientConfidence;
}

export interface GroupedShoppingItemsResult {
  grouped: ShoppingGroup[];
  ungrouped: ShoppingItem[];
}

export interface ImportDiagnostic {
  domain: string;
  adapter: string;
  stage: ImportFailureStage;
  reason: string;
  hint: string | null;
}

export interface StatusState {
  message: string;
  type: '' | 'loading' | 'ok' | 'err';
}

export interface ImportPreviewRecipe extends Partial<Recipe> {
  id: string;
  name: string;
  ingredients: string[];
  steps: string[];
  source: ImportSource;
  preparationType: PreparationType;
}

export type ImportSource = 'youtube' | 'tiktok' | 'instagram' | 'web';
export type ImportFailureStage = 'normalize-url' | 'fetch-readable-page' | 'select-adapter' | 'parse-content' | 'build-preview';

export interface WebsiteImportAdapter {
  domain: string;
  /** Optional: return true if this adapter can handle a URL that did not match by domain string alone. */
  canHandle?: (url: string) => boolean;
  parse: (markdown: string, url: string) => ImportPreviewRecipe;
}
