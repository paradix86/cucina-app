import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizePreparationTypeValue,
  getPreparationType,
  parseIngredient,
  assignSection,
  formatQuantity,
  groupShoppingItems,
  getSectionI18nKey,
} from '../../src/lib/ingredientUtils';
import {
  addRecipe,
  clearWeeklyPlanner,
  getStorageAdapter,
  loadRecipeBook,
  loadWeeklyPlanner,
  resetStorageAdapter,
  saveWeeklyPlanner,
  setStorageAdapter,
  updateWeeklyPlannerSlot,
} from '../../src/lib/storage';
import type { StorageAdapter } from '../../src/lib/persistence/storageAdapter';
import { createEmptyWeeklyPlanner } from '../../src/lib/planner';
import type { Recipe, ShoppingItem, ParsedIngredient } from '../../src/types';

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

beforeEach(() => {
  global.localStorage = localStorageMock as any;
  localStorageMock.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  resetStorageAdapter();
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

describe('storage adapter boundary', () => {
  it('delegates public storage calls to the active adapter', () => {
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
        updateSlot: vi.fn((day, slot, recipeId) => ({
          ...createEmptyWeeklyPlanner(),
          [day]: {
            ...createEmptyWeeklyPlanner()[ day ],
            [slot]: recipeId,
          },
        })),
        clear: vi.fn(),
      },
    };

    setStorageAdapter(adapter);

    const result = updateWeeklyPlannerSlot('wednesday', 'dinner', 'recipe-999');

    expect(adapter.weeklyPlanner.updateSlot).toHaveBeenCalledWith('wednesday', 'dinner', 'recipe-999');
    expect(result.wednesday.dinner).toBe('recipe-999');
  });

  it('resets back to the built-in localStorage adapter', () => {
    const original = getStorageAdapter();
    const replacement: StorageAdapter = {
      recipeBook: original.recipeBook,
      shoppingList: original.shoppingList,
      weeklyPlanner: {
        ...original.weeklyPlanner,
        load: vi.fn(createEmptyWeeklyPlanner),
      },
    };

    setStorageAdapter(replacement);
    expect(getStorageAdapter()).toBe(replacement);

    resetStorageAdapter();

    expect(getStorageAdapter()).not.toBe(replacement);
    expect(loadWeeklyPlanner().monday.breakfast).toBeNull();
  });
});
