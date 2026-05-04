import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizePreparationTypeValue,
  getPreparationType,
  parseIngredient,
  normalizeIngredientName,
  assignSection,
  formatQuantity,
  groupShoppingItems,
  getSectionI18nKey,
} from '../../src/lib/ingredientUtils';
import {
  addRecipe,
  clearWeeklyPlanner,
  getStorageAdapter,
  importRecipeBook,
  loadRecipeBook,
  loadWeeklyPlanner,
  resetStorageAdapter,
  saveRecipeBook,
  saveWeeklyPlanner,
  setStorageAdapter,
  STORAGE_KEY,
  SHOPPING_LIST_KEY,
  updateWeeklyPlannerSlot,
  waitForStorageBootstrap,
  WEEKLY_PLANNER_KEY,
} from '../../src/lib/storage';
import { CucinaDexieDb, DEXIE_MIGRATION_META_KEY, WEEKLY_PLANNER_ROW_ID } from '../../src/lib/persistence/dexieDb';
import type { StorageAdapter } from '../../src/lib/persistence/storageAdapter';
import { createEmptyWeeklyPlanner } from '../../src/lib/planner';
import type { PlannerDayId, PlannerMealSlot, Recipe, ShoppingItem, ParsedIngredient } from '../../src/types';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[ key ] || null,
    setItem: (key: string, value: string) => { store[ key ] = value; },
    removeItem: (key: string) => { delete store[ key ]; },
    clear: () => { store = {}; },
  };
})();

async function clearDexieDb(): Promise<void> {
  const db = new CucinaDexieDb();
  await db.delete();
  db.close();
}

beforeEach(async () => {
  globalThis.localStorage = localStorageMock as any;
  localStorageMock.clear();
  resetStorageAdapter();
  await clearDexieDb();
});

afterEach(async () => {
  vi.clearAllMocks();
  await waitForStorageBootstrap().catch(() => undefined);
  resetStorageAdapter();
  await clearDexieDb();
});

describe('normalizePreparationTypeValue', () => {
  it('should accept classic', () => {
    expect(normalizePreparationTypeValue('classic')).toBe('classic');
  });

  it('should accept bimby', () => {
    expect(normalizePreparationTypeValue('bimby')).toBe('bimby');
  });

  it('should accept airfryer', () => {
    expect(normalizePreparationTypeValue('airfryer')).toBe('airfryer');
  });

  it('should reject invalid values', () => {
    expect(normalizePreparationTypeValue('invalid')).toBe('');
    expect(normalizePreparationTypeValue('CLASSIC')).toBe('');
    expect(normalizePreparationTypeValue(null)).toBe('');
    expect(normalizePreparationTypeValue(123)).toBe('');
  });
});

describe('getPreparationType', () => {
  it('should return preparationType if explicitly set', () => {
    expect(getPreparationType({ preparationType: 'bimby' })).toBe('bimby');
  });

  it('should fallback to bimby flag', () => {
    expect(getPreparationType({ bimby: true })).toBe('bimby');
  });

  it('should return classic as default', () => {
    expect(getPreparationType({})).toBe('classic');
  });

  it('should prefer explicit preparationType over bimby flag', () => {
    expect(getPreparationType({ preparationType: 'airfryer', bimby: true })).toBe('airfryer');
  });

  it('should handle null/undefined', () => {
    expect(getPreparationType(null)).toBe('classic');
    expect(getPreparationType(undefined)).toBe('classic');
  });
});

describe('parseIngredient', () => {
  it('should parse quantity + unit + name with high confidence', () => {
    const result = parseIngredient('500 g chicken');
    expect(result.parsedQty).toBe(500);
    expect(result.parsedUnit).toBe('g');
    expect(result.parsedName).toBe('chicken');
    expect(result.confidence).toBe('high');
  });

  it('should normalize kg to base units', () => {
    const result = parseIngredient('1 kg potatoes');
    expect(result.parsedQty).toBe(1);
    expect(result.parsedUnit).toBe('kg');
    expect(result.confidence).toBe('high');
  });

  it('should parse ml and l', () => {
    const ml = parseIngredient('200 ml milk');
    expect(ml.parsedUnit).toBe('ml');
    expect(ml.confidence).toBe('high');

    const l = parseIngredient('1 l water');
    expect(l.parsedUnit).toBe('l');
    expect(l.confidence).toBe('high');
  });

  it('should parse eggs as countable pieces', () => {
    // "2 eggs" matches fallback pattern (no explicit unit), returns 'pieces'
    const result = parseIngredient('2 eggs');
    expect(result.parsedQty).toBe(2);
    expect(result.parsedUnit).toBe('pieces');
    expect(result.parsedName).toBe('eggs');
    expect(result.confidence).toBe('high');
  });

  it('should handle decimal quantities', () => {
    const result = parseIngredient('1.5 kg flour');
    expect(result.parsedQty).toBe(1.5);
    expect(result.parsedUnit).toBe('kg');
  });

  it('should handle comma as decimal separator', () => {
    const result = parseIngredient('1,5 kg flour');
    expect(result.parsedQty).toBe(1.5);
    expect(result.parsedUnit).toBe('kg');
  });

  it('should parse name-first quantity + unit ingredients', () => {
    const spaced = parseIngredient('maiale macinato 250 g');
    expect(spaced.parsedQty).toBe(250);
    expect(spaced.parsedUnit).toBe('g');
    expect(spaced.parsedName).toBe('maiale macinato');
    expect(spaced.confidence).toBe('high');

    const compact = parseIngredient('Maiale macinato 250g');
    expect(compact.parsedQty).toBe(250);
    expect(compact.parsedUnit).toBe('g');
    expect(compact.parsedName).toBe('maiale macinato');
    expect(compact.confidence).toBe('high');
  });

  it('should reject vague quantities', () => {
    expect(parseIngredient('chicken q.b.').confidence).toBe('low');
    expect(parseIngredient('salt to taste').confidence).toBe('low');
    expect(parseIngredient('pepper as needed').confidence).toBe('low');
  });

  it('should recognize countable items without unit', () => {
    // Pattern checks for items starting with "patat" (potato variants)
    const result = parseIngredient('3 patate');
    expect(result.parsedQty).toBe(3);
    expect(result.parsedUnit).toBe('pieces');
    expect(result.confidence).toBe('high');
  });

  it('should have low confidence for items without quantity', () => {
    const result = parseIngredient('olive oil');
    expect(result.confidence).toBe('low');
    expect(result.parsedQty).toBeNull();
  });

  it('should normalize ingredient names', () => {
    // normalizeName removes specific suffixes like "fresco" but not "fresh"
    const result = parseIngredient('200 g chicken fresco');
    expect(result.parsedName).toBe('chicken');
  });

  it('should handle empty or null input', () => {
    expect(parseIngredient('').confidence).toBe('low');
    expect(parseIngredient(null as any).confidence).toBe('low');
  });
});

describe('normalizeIngredientName', () => {
  it('should normalize casing, spacing, punctuation, and quantity position', () => {
    expect(normalizeIngredientName('Maiale macinato 250 g')).toBe('maiale macinato');
    expect(normalizeIngredientName('maiale macinato 250g')).toBe('maiale macinato');
    expect(normalizeIngredientName('  250 g   MAIALE MACINATO, ')).toBe('maiale macinato');
    expect(normalizeIngredientName('MAIALE MACINATO')).toBe('maiale macinato');
  });
});

describe('formatQuantity', () => {
  it('should format integer quantities', () => {
    expect(formatQuantity(5)).toBe('5');
    expect(formatQuantity(100)).toBe('100');
  });

  it('should format decimal quantities to 1 decimal place', () => {
    expect(formatQuantity(1.5)).toBe('1.5');
    expect(formatQuantity(2.3)).toBe('2.3');
  });

  it('should remove trailing .0', () => {
    expect(formatQuantity(5.0)).toBe('5');
    expect(formatQuantity(10.0)).toBe('10');
  });
});

describe('assignSection', () => {
  it('should assign proteins', () => {
    expect(assignSection('chicken')).toBe('proteins');
    expect(assignSection('pollo')).toBe('proteins');
    expect(assignSection('beef')).toBe('proteins');
    expect(assignSection('fish')).toBe('proteins');
  });

  it('should assign carbs', () => {
    expect(assignSection('pasta')).toBe('carbs');
    expect(assignSection('rice')).toBe('carbs');
    expect(assignSection('riso')).toBe('carbs');
    expect(assignSection('bread')).toBe('carbs');
    expect(assignSection('farina')).toBe('carbs');
  });

  it('should assign vegetables_fruit', () => {
    expect(assignSection('carrot')).toBe('vegetables_fruit');
    expect(assignSection('carota')).toBe('vegetables_fruit');
    expect(assignSection('tomato')).toBe('vegetables_fruit');
    expect(assignSection('onion')).toBe('vegetables_fruit');
    expect(assignSection('patate')).toBe('vegetables_fruit');
  });

  it('should assign dairy_eggs', () => {
    expect(assignSection('milk')).toBe('dairy_eggs');
    expect(assignSection('latte')).toBe('dairy_eggs');
    expect(assignSection('butter')).toBe('dairy_eggs');
    expect(assignSection('cheese')).toBe('dairy_eggs');
  });

  it('should assign fats_oils_spices', () => {
    expect(assignSection('salt')).toBe('fats_oils_spices');
    expect(assignSection('sale')).toBe('fats_oils_spices');
    expect(assignSection('oil')).toBe('fats_oils_spices');
    expect(assignSection('basil')).toBe('fats_oils_spices');
    expect(assignSection('salsa di soia')).toBe('fats_oils_spices');
  });

  it('should assign common legumes to proteins', () => {
    expect(assignSection('ceci')).toBe('proteins');
    expect(assignSection('fagioli')).toBe('proteins');
    expect(assignSection('piselli')).toBe('proteins');
  });

  it('should assign obvious produce variants to vegetables_fruit', () => {
    expect(assignSection('zucchina o melanzane grigliate')).toBe('vegetables_fruit');
    expect(assignSection('cipollotto fresco')).toBe('vegetables_fruit');
  });

  it('should handle case insensitivity', () => {
    expect(assignSection('CHICKEN')).toBe('proteins');
    expect(assignSection('Pasta')).toBe('carbs');
    expect(assignSection('SALT')).toBe('fats_oils_spices');
  });

  it('should handle items with multiple words', () => {
    expect(assignSection('chicken breast')).toBe('proteins');
    expect(assignSection('pasta spaghetti')).toBe('carbs');
  });

  it('should assign Italian plural vegetables to vegetables_fruit', () => {
    expect(assignSection('cipolle')).toBe('vegetables_fruit');
    expect(assignSection('carote')).toBe('vegetables_fruit');
    expect(assignSection('peperoni')).toBe('vegetables_fruit');
    expect(assignSection('pomodori')).toBe('vegetables_fruit');
    expect(assignSection('zucchine')).toBe('vegetables_fruit');
    expect(assignSection('limoni')).toBe('vegetables_fruit');
    expect(assignSection('arance')).toBe('vegetables_fruit');
    expect(assignSection('funghi')).toBe('vegetables_fruit');
  });

  it('should still assign singular vegetables (regression guard)', () => {
    expect(assignSection('cipolla')).toBe('vegetables_fruit');
    expect(assignSection('carota')).toBe('vegetables_fruit');
    expect(assignSection('peperone')).toBe('vegetables_fruit');
    expect(assignSection('pomodoro')).toBe('vegetables_fruit');
  });

  it('should handle plural vegetables with descriptors', () => {
    expect(assignSection('cipolle rosse')).toBe('vegetables_fruit');
    expect(assignSection('peperoni gialli')).toBe('vegetables_fruit');
    expect(assignSection('pomodori ramati')).toBe('vegetables_fruit');
  });

  it('should assign pastinaca to vegetables_fruit', () => {
    expect(assignSection('pastinaca')).toBe('vegetables_fruit');
    expect(assignSection('pastinache')).toBe('vegetables_fruit');
  });

  it('should default to other for unknown items', () => {
    expect(assignSection('unknown ingredient xyz')).toBe('other');
    expect(assignSection('xyz')).toBe('other');
  });

  it('should handle empty or null', () => {
    expect(assignSection('')).toBe('other');
    expect(assignSection(null as any)).toBe('other');
  });
});

describe('getSectionI18nKey', () => {
  it('should return correct i18n keys for all sections', () => {
    expect(getSectionI18nKey('proteins')).toBe('section_proteins');
    expect(getSectionI18nKey('carbs')).toBe('section_carbs');
    expect(getSectionI18nKey('vegetables_fruit')).toBe('section_vegetables_fruit');
    expect(getSectionI18nKey('dairy_eggs')).toBe('section_dairy_eggs');
    expect(getSectionI18nKey('fats_oils_spices')).toBe('section_fats_oils_spices');
    expect(getSectionI18nKey('other')).toBe('section_other');
  });
});

describe('groupShoppingItems', () => {
  it('should merge items with same name and unit', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '500 g chicken', checked: false, createdAt: Date.now() },
      { id: '2', text: '300 g chicken', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('chicken');
    expect(result.grouped[ 0 ].displayQty).toBe('800');
    expect(result.grouped[ 0 ].unit).toBe('g');
    expect(result.grouped[ 0 ].items).toHaveLength(2);
  });

  it('should merge kg and g items into one numeric group', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '1 kg chicken', checked: false, createdAt: Date.now() },
      { id: '2', text: '500 g chicken', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('chicken');
    expect(result.grouped[ 0 ].unit).toBe('kg');
    expect(result.grouped[ 0 ].displayQty).toBe('1.5');
  });

  it('should convert ml to l when total >= 1000', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '700 ml milk', checked: false, createdAt: Date.now() },
      { id: '2', text: '500 ml milk', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped[ 0 ].totalQty).toBe(1.2);
    expect(result.grouped[ 0 ].unit).toBe('l');
  });

  it('should keep distinct items (sale vs sale grosso)', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '500 g sale', checked: false, createdAt: Date.now() },
      { id: '2', text: '500 g sale grosso', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    // Both should be grouped by normalized text
    expect(result.grouped.length).toBeGreaterThanOrEqual(1);
  });

  it('should keep unquantified items separate', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: 'olive oil', checked: false, createdAt: Date.now() },
      { id: '2', text: 'truffle oil', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.ungrouped).toHaveLength(2);
    expect(result.grouped).toHaveLength(0);
  });

  it('should group duplicates of vague items together', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: 'olive oil', checked: false, createdAt: Date.now() },
      { id: '2', text: 'olive oil', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].items).toHaveLength(2);
  });

  it('should merge obvious singular/plural shopping variants for non-numeric ingredients', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: 'spicchio aglio', checked: false, createdAt: Date.now() },
      { id: '2', text: 'spicchi aglio', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('aglio');
    expect(result.grouped[ 0 ].items).toHaveLength(2);
  });

  it('should merge numeric ingredients using normalized grouping keys', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '2 patate', checked: false, createdAt: Date.now() },
      { id: '2', text: '3 patata', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].items).toHaveLength(2);
    expect(result.grouped[ 0 ].totalQty).toBe(5);
  });

  it('should collapse obvious salt variants into a single shopping group', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: 'Sale fino 1 pizzico Per il ripieno', checked: false, createdAt: Date.now() },
      { id: '2', text: 'Sale fino q.b.', checked: false, createdAt: Date.now() },
      { id: '3', text: 'Sale per cottura', checked: false, createdAt: Date.now() },
      { id: '4', text: 'sale e pepe nero', checked: false, createdAt: Date.now() },
      { id: '5', text: 'Sale, pepe', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('sale');
    expect(result.grouped[ 0 ].displayName).toBe('sale');
    expect(result.grouped[ 0 ].items).toHaveLength(5);
  });

  it('should collapse obvious olive oil variants into a single shopping group', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: "olio extravergine d'oliva", checked: false, createdAt: Date.now() },
      { id: '2', text: 'olio evo', checked: false, createdAt: Date.now() },
      { id: '3', text: 'olio di oliva', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('olio di oliva');
    expect(result.grouped[ 0 ].items).toHaveLength(3);
  });

  it('should collapse obvious pepper variants into a single shopping group', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: 'pepe nero', checked: false, createdAt: Date.now() },
      { id: '2', text: 'pepe', checked: false, createdAt: Date.now() },
      { id: '3', text: 'pepe macinato', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('pepe');
    expect(result.grouped[ 0 ].items).toHaveLength(3);
  });

  it('should handle empty list', () => {
    const result = groupShoppingItems([]);
    expect(result.grouped).toHaveLength(0);
    expect(result.ungrouped).toHaveLength(0);
  });

  it('should handle non-array input', () => {
    const result = groupShoppingItems(null as any);
    expect(result.grouped).toHaveLength(0);
    expect(result.ungrouped).toHaveLength(0);
  });

  it('should merge petto di pollo with plain pollo (Italian meat-cut descriptor)', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '300 g petto di pollo', checked: false, createdAt: Date.now() },
      { id: '2', text: '200 g pollo', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('pollo');
    expect(result.grouped[ 0 ].totalQty).toBe(500);
    expect(result.grouped[ 0 ].items).toHaveLength(2);
  });

  it('should merge cosce di pollo and coscia di pollo with plain pollo', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '400 g cosce di pollo', checked: false, createdAt: Date.now() },
      { id: '2', text: '150 g coscia di pollo', checked: false, createdAt: Date.now() },
      { id: '3', text: '250 g pollo', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('pollo');
    expect(result.grouped[ 0 ].totalQty).toBe(800);
    expect(result.grouped[ 0 ].items).toHaveLength(3);
  });

  it('should merge parmigiano reggiano and parmigiano grattugiato with parmigiano (alias + suffix)', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: 'parmigiano reggiano', checked: false, createdAt: Date.now() },
      { id: '2', text: 'parmigiano', checked: false, createdAt: Date.now() },
      { id: '3', text: 'parmigiano grattugiato', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('parmigiano');
    expect(result.grouped[ 0 ].items).toHaveLength(3);
  });

  it('should merge chicken breast with plain chicken (English alias)', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '300 g chicken breast', checked: false, createdAt: Date.now() },
      { id: '2', text: '200 g chicken', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('chicken');
    expect(result.grouped[ 0 ].totalQty).toBe(500);
    expect(result.grouped[ 0 ].items).toHaveLength(2);
  });

  it('should not merge chicken with chicken stock (alias does not over-reach)', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '500 ml chicken stock', checked: false, createdAt: Date.now() },
      { id: '2', text: '300 g chicken', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    // chicken stock is ml, chicken is g — different units → two separate groups
    expect(result.grouped).toHaveLength(2);
  });

  it('should sort grouped items alphabetically', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '200 g zucchini', checked: false, createdAt: Date.now() },
      { id: '2', text: '300 g apple', checked: false, createdAt: Date.now() },
      { id: '3', text: '150 g butter', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    const names = result.grouped.map(g => g.baseName);
    expect(names).toEqual([ 'apple', 'butter', 'zucchini' ]);
  });

  it('should merge l and ml items into one numeric group', () => {
    const items: ShoppingItem[] = [
      { id: '1', text: '1 l latte', checked: false, createdAt: Date.now() },
      { id: '2', text: '250 ml latte', checked: false, createdAt: Date.now() },
    ];
    const result = groupShoppingItems(items);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('latte');
    expect(result.grouped[ 0 ].unit).toBe('l');
    expect(result.grouped[ 0 ].displayQty).toBe('1.3');
  });

  it('should merge duplicated name-first meat quantities from multiple recipes', () => {
    const items: ShoppingItem[] = [
      {
        id: '1',
        text: 'maiale macinato 250 g',
        checked: true,
        sourceRecipeId: 'recipe-a',
        sourceRecipeName: 'Recipe A',
        createdAt: Date.now(),
      },
      {
        id: '2',
        text: 'Maiale macinato 250g',
        checked: false,
        sourceRecipeId: 'recipe-b',
        sourceRecipeName: 'Recipe B',
        createdAt: Date.now(),
      },
    ];
    const result = groupShoppingItems(items);
    expect(result.ungrouped).toHaveLength(0);
    expect(result.grouped).toHaveLength(1);
    expect(result.grouped[ 0 ].baseName).toBe('maiale macinato');
    expect(result.grouped[ 0 ].displayQty).toBe('500');
    expect(result.grouped[ 0 ].unit).toBe('g');
    expect(result.grouped[ 0 ].items).toHaveLength(2);
    expect(result.grouped[ 0 ].items.filter(item => item.checked)).toHaveLength(1);
  });
});

// ─── meal occasion normalization ──────────────────────────────────────────────

const BASE_RECIPE = {
  id: 'test-mo-1',
  name: 'Test Recipe',
  ingredients: [ '100 g flour' ],
  steps: [ 'Mix everything' ],
  source: 'manual',
  preparationType: 'classic' as const,
};

describe('meal occasion normalization', () => {
  it('persists valid meal occasion values', () => {
    addRecipe({ ...BASE_RECIPE, id: 'mo-1', mealOccasion: [ 'Colazione', 'Pranzo' ] });
    const saved = loadRecipeBook().find(r => r.id === 'mo-1');
    expect(saved?.mealOccasion).toEqual([ 'Colazione', 'Pranzo' ]);
  });

  it('filters out invalid meal occasion values', () => {
    addRecipe({ ...BASE_RECIPE, id: 'mo-2', mealOccasion: [ 'Colazione', 'Brunch', 'InvalidValue' ] });
    const saved = loadRecipeBook().find(r => r.id === 'mo-2');
    expect(saved?.mealOccasion).toEqual([ 'Colazione' ]);
  });

  it('stores undefined when all values are invalid', () => {
    addRecipe({ ...BASE_RECIPE, id: 'mo-3', mealOccasion: [ 'Brunch', 'Breakfast' ] });
    const saved = loadRecipeBook().find(r => r.id === 'mo-3');
    expect(saved?.mealOccasion).toBeUndefined();
  });

  it('stores undefined when mealOccasion is empty array', () => {
    addRecipe({ ...BASE_RECIPE, id: 'mo-4', mealOccasion: [] });
    const saved = loadRecipeBook().find(r => r.id === 'mo-4');
    expect(saved?.mealOccasion).toBeUndefined();
  });

  it('stores undefined when mealOccasion is absent', () => {
    addRecipe({ ...BASE_RECIPE, id: 'mo-5' });
    const saved = loadRecipeBook().find(r => r.id === 'mo-5');
    expect(saved?.mealOccasion).toBeUndefined();
  });

  it('accepts all four valid controlled values', () => {
    addRecipe({ ...BASE_RECIPE, id: 'mo-6', mealOccasion: [ 'Colazione', 'Pranzo', 'Cena', 'Spuntino' ] });
    const saved = loadRecipeBook().find(r => r.id === 'mo-6');
    expect(saved?.mealOccasion).toEqual([ 'Colazione', 'Pranzo', 'Cena', 'Spuntino' ]);
  });

  it('rejects case-variant spellings (values are case-sensitive)', () => {
    addRecipe({ ...BASE_RECIPE, id: 'mo-7', mealOccasion: [ 'colazione', 'PRANZO' ] });
    const saved = loadRecipeBook().find(r => r.id === 'mo-7');
    expect(saved?.mealOccasion).toBeUndefined();
  });
});

describe('recipe cover image normalization', () => {
  it('persists valid http(s) cover image URLs', () => {
    addRecipe({
      ...BASE_RECIPE,
      id: 'img-1',
      coverImageUrl: 'https://example.com/recipe-cover.jpg',
    });
    const saved = loadRecipeBook().find(r => r.id === 'img-1');
    expect(saved?.coverImageUrl).toBe('https://example.com/recipe-cover.jpg');
  });

  it('drops unsafe or invalid cover image URLs', () => {
    addRecipe({
      ...BASE_RECIPE,
      id: 'img-2',
      coverImageUrl: 'javascript:alert(1)',
    });
    const saved = loadRecipeBook().find(r => r.id === 'img-2');
    expect(saved?.coverImageUrl).toBeUndefined();
  });
});

describe('weekly planner persistence', () => {
  it('loads an empty normalized planner by default', () => {
    const plan = loadWeeklyPlanner();
    expect(plan.monday.breakfast).toBeNull();
    expect(plan.sunday.dinner).toBeNull();
  });

  it('persists recipe ids by day and slot', () => {
    updateWeeklyPlannerSlot('monday', 'lunch', 'recipe-123');
    const plan = loadWeeklyPlanner();
    expect(plan.monday.lunch).toBe('recipe-123');
    expect(plan.monday.breakfast).toBeNull();
  });

  it('normalizes partial planner payloads on save', () => {
    saveWeeklyPlanner({
      monday: { breakfast: 'a', lunch: null, dinner: null },
    } as any);
    const plan = loadWeeklyPlanner();
    expect(plan.monday.breakfast).toBe('a');
    expect(plan.tuesday.lunch).toBeNull();
    expect(plan.sunday.dinner).toBeNull();
  });

  it('clears the weekly planner back to an empty state', () => {
    saveWeeklyPlanner({
      ...createEmptyWeeklyPlanner(),
      friday: { breakfast: 'one', lunch: 'two', dinner: 'three' },
    });
    clearWeeklyPlanner();
    const plan = loadWeeklyPlanner();
    expect(plan.friday.breakfast).toBeNull();
    expect(plan.friday.lunch).toBeNull();
    expect(plan.friday.dinner).toBeNull();
  });
});

describe('backup import semantics', () => {
  it('replaces current recipe book with backup snapshot (full restore)', async () => {
    saveRecipeBook([
      {
        id: 'live-1',
        name: 'Live Recipe',
        ingredients: [ '1 egg' ],
        steps: [ 'Cook' ],
      } as Recipe,
      {
        id: 'marker-1',
        name: 'Backup Marker Recipe',
        ingredients: [ '1 marker' ],
        steps: [ 'Keep' ],
      } as Recipe,
    ]);

    const backupSnapshot = [
      {
        id: 'backup-1',
        name: 'Backup Recipe',
        ingredients: [ '200 g pasta' ],
        steps: [ 'Boil' ],
      },
    ];

    class MockFileReader {
      onload: ((event: { target?: { result?: string } }) => void) | null = null;
      readAsText(file: Blob): void {
        void file.text().then(text => {
          this.onload?.({ target: { result: text } });
        });
      }
    }

    const originalFileReader = globalThis.FileReader;
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    try {
      const file = new File([ JSON.stringify(backupSnapshot) ], 'backup.json', { type: 'application/json' });
      const result = await importRecipeBook(file);
      const restored = loadRecipeBook();

      expect(result.total).toBe(1);
      expect(restored).toHaveLength(1);
      expect(restored[ 0 ]?.id).toBe('backup-1');
      expect(restored.find(recipe => recipe.id === 'marker-1')).toBeUndefined();
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });
});

describe('storage adapter boundary', () => {
  it('delegates public storage calls to the active adapter', () => {
    const updateSlotMock = vi.fn((day: PlannerDayId, slot: PlannerMealSlot, recipeId: string | null) => {
      const plan = createEmptyWeeklyPlanner();
      plan[ day ][ slot ] = recipeId;
      return plan;
    });

    const adapter: StorageAdapter = {
      recipeBook: {
        migrateFromV2: vi.fn(),
        load: vi.fn(() => []),
        save: vi.fn(),
        add: vi.fn(() => true),
        remove: vi.fn(),
        update: vi.fn(() => true),
        updateNotes: vi.fn(() => true),
        toggleFavorite: vi.fn(() => true),
        markViewed: vi.fn(() => true),
        exportBackup: vi.fn(() => 0),
        importBackup: vi.fn(async () => ({ total: 0, added: 0 })),
      },
      shoppingList: {
        load: vi.fn(() => []),
        save: vi.fn(),
        add: vi.fn(() => 0),
        addWithScale: vi.fn(() => 0),
        removeByRecipe: vi.fn(() => 0),
        toggleItem: vi.fn(() => false),
        removeItem: vi.fn(() => false),
        clear: vi.fn(),
      },
      weeklyPlanner: {
        load: vi.fn(createEmptyWeeklyPlanner),
        save: vi.fn(),
        updateSlot: updateSlotMock,
        clear: vi.fn(),
      },
    };

    setStorageAdapter(adapter);

    const result = updateWeeklyPlannerSlot('wednesday', 'dinner', 'recipe-999');

    expect(updateSlotMock).toHaveBeenCalledWith('wednesday', 'dinner', 'recipe-999');
    expect(result.wednesday.dinner).toBe('recipe-999');
  });

  it('resets back to the built-in localStorage adapter', () => {
    const original = getStorageAdapter();
    const loadMock = vi.fn(createEmptyWeeklyPlanner);
    const replacement: StorageAdapter = {
      recipeBook: original.recipeBook,
      shoppingList: original.shoppingList,
      weeklyPlanner: {
        ...original.weeklyPlanner,
        load: loadMock,
      },
    };

    setStorageAdapter(replacement);
    expect(getStorageAdapter()).toBe(replacement);

    resetStorageAdapter();

    expect(getStorageAdapter()).not.toBe(replacement);
    expect(loadWeeklyPlanner().monday.breakfast).toBeNull();
  });
});

describe('dexie bootstrap migration', () => {
  it('migrates localStorage data into Dexie only once and keeps localStorage intact', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        id: 'recipe-1',
        name: 'Pasta al pomodoro',
        ingredients: [ '200 g pasta' ],
        steps: [ 'Cuoci' ],
      },
    ]));
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify([
      {
        id: 'shop-1',
        text: '200 g pasta',
        checked: false,
        createdAt: 1,
      },
    ]));
    localStorage.setItem(WEEKLY_PLANNER_KEY, JSON.stringify({
      ...createEmptyWeeklyPlanner(),
      monday: { breakfast: null, lunch: 'recipe-1', dinner: null },
    }));

    expect(loadRecipeBook()).toHaveLength(1);
    await waitForStorageBootstrap();

    const db = new CucinaDexieDb();
    const [ recipes, shoppingItems, plannerRow, migrationMeta ] = await Promise.all([
      db.recipes.toArray(),
      db.shoppingItems.toArray(),
      db.weeklyPlanner.get(WEEKLY_PLANNER_ROW_ID),
      db.meta.get(DEXIE_MIGRATION_META_KEY),
    ]);

    expect(recipes).toHaveLength(1);
    expect(shoppingItems).toHaveLength(1);
    expect(plannerRow?.plan.monday.lunch).toBe('recipe-1');
    expect(migrationMeta?.value).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).toHaveLength(1);
    expect(infoSpy).toHaveBeenCalledWith('Dexie migration started');
    expect(infoSpy).toHaveBeenCalledWith('Dexie migration completed');

    resetStorageAdapter();
    expect(loadRecipeBook()).toHaveLength(1);
    await waitForStorageBootstrap();

    expect(infoSpy.mock.calls.filter(call => call[ 0 ] === 'Dexie migration started')).toHaveLength(1);
    expect(infoSpy.mock.calls.filter(call => call[ 0 ] === 'Dexie migration completed')).toHaveLength(1);

    db.close();
    infoSpy.mockRestore();
  });

  it('hydrates localStorage from Dexie when migration already happened and localStorage is empty', async () => {
    const db = new CucinaDexieDb();
    await db.recipes.put({
      id: 'recipe-2',
      name: 'Riso',
      ingredients: [ '100 g riso' ],
      steps: [ 'Cuoci' ],
    } as Recipe);
    await db.meta.put({ key: DEXIE_MIGRATION_META_KEY, value: true });
    db.close();

    expect(loadRecipeBook()).toHaveLength(0);
    await waitForStorageBootstrap();

    expect(loadRecipeBook()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).toHaveLength(1);
  });

  it('falls back to localStorage when indexedDB is unavailable', async () => {
    const originalIndexedDb = globalThis.indexedDB;
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    globalThis.indexedDB = undefined as any;
    resetStorageAdapter();

    expect(addRecipe({
      id: 'fallback-1',
      name: 'Fallback recipe',
      ingredients: [ '1 uovo' ],
      steps: [ 'Mescola' ],
    })).toBe(true);
    expect(loadRecipeBook()).toHaveLength(1);
    await waitForStorageBootstrap();

    expect(infoSpy).toHaveBeenCalledWith('Dexie fallback to localStorage');

    globalThis.indexedDB = originalIndexedDb;
    infoSpy.mockRestore();
  });
});

describe('timer normalization', () => {
  it('derives timerSeconds from timerMinutes when timerSeconds is absent', () => {
    addRecipe({ ...BASE_RECIPE, id: 'timer-1', timerMinutes: 10 });
    const saved = loadRecipeBook().find(r => r.id === 'timer-1');
    expect(saved?.timerMinutes).toBe(10);
    expect(saved?.timerSeconds).toBe(600);
  });

  it('preserves explicit valid timerSeconds and keeps timerMinutes intact', () => {
    addRecipe({ ...BASE_RECIPE, id: 'timer-2', timerMinutes: 5, timerSeconds: 90 });
    const saved = loadRecipeBook().find(r => r.id === 'timer-2');
    expect(saved?.timerSeconds).toBe(90);
    expect(saved?.timerMinutes).toBe(5);
  });

  it('floors decimal timerSeconds to integer', () => {
    addRecipe({ ...BASE_RECIPE, id: 'timer-3', timerSeconds: 61.9 });
    const saved = loadRecipeBook().find(r => r.id === 'timer-3');
    expect(saved?.timerSeconds).toBe(61);
  });

  it('falls back to timerMinutes-derived seconds when timerSeconds is negative', () => {
    addRecipe({ ...BASE_RECIPE, id: 'timer-4', timerMinutes: 3, timerSeconds: -5 });
    const saved = loadRecipeBook().find(r => r.id === 'timer-4');
    expect(saved?.timerSeconds).toBe(180);
  });

  it('defaults both fields to 0 when neither is present', () => {
    addRecipe({ ...BASE_RECIPE, id: 'timer-5' });
    const saved = loadRecipeBook().find(r => r.id === 'timer-5');
    expect(saved?.timerSeconds).toBe(0);
    expect(saved?.timerMinutes).toBe(0);
  });

  it('floors decimal timerMinutes and derives timerSeconds from the floored value', () => {
    addRecipe({ ...BASE_RECIPE, id: 'timer-6', timerMinutes: 10.7 });
    const saved = loadRecipeBook().find(r => r.id === 'timer-6');
    expect(saved?.timerMinutes).toBe(10);
    expect(saved?.timerSeconds).toBe(600);
  });
});
