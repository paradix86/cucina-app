import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const APP_ROOT = 'http://127.0.0.1:4173/cucina-app/';
const STORAGE_KEY = 'cucina_recipebook_v3';

// Seed recipes so the Pinia store hydrates from them on the next render.
// The pattern mirrors `seedState` in rc-critical-flows.spec.ts: a first load
// lets the Dexie adapter bootstrap from empty localStorage and set its
// migration flag; we then write seed data into localStorage; a second load
// re-hydrates the store via Dexie's localStorage fallback.
async function seedRecipes(page: Page, recipes: unknown[]): Promise<void> {
  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();

  await page.evaluate(({ key, data }) => {
    localStorage.setItem(key, JSON.stringify(data));
  }, { key: STORAGE_KEY, data: recipes });

  await page.goto(APP_ROOT);
  await expect(page.locator('main.app')).toBeVisible();
  await expect(page.locator('main.app .panel.active').first()).toBeVisible();
}

test.describe('Meal Composer Flow', () => {
  test('shows recipe in composer even without nutrition, with missing-nutrition badge', async ({ page }) => {
    const recipe = {
      id: 'test-no-nutrition',
      name: 'Test Recipe No Nutrition',
      category: 'Primi',
      servings: '4',
      time: '30 min',
      source: 'manual',
      ingredients: ['pasta 200g', 'pomodoro 400g'],
      steps: ['Boil water', 'Cook pasta'],
      favorite: false,
    };

    await seedRecipes(page, [recipe]);

    await page.goto(APP_ROOT + '#/recipe-book');
    await expect(page.locator('main.app .panel.active').first()).toBeVisible();

    // Open the recipe detail by clicking its card
    await page.locator('text=' + recipe.name).first().click();
    await expect(page).toHaveURL(/#\/recipe-book\/test-no-nutrition$/);

    // Click "Add to meal" on the detail view (i18n-agnostic class)
    await page.locator('.detail-action-meal').click();
    await expect(page).toHaveURL(/#\/meal-composer/);

    // Recipe should be visible by name in the dashboard chips
    await expect(page.locator('.mc-chip-name', { hasText: recipe.name })).toBeVisible();

    // Should see a badge or note about missing nutrition
    const missingNutritionText = page.locator('text=/Valori nutrizionali mancanti|Nutrition data missing|Nährwertdaten fehlen|Données nutritionnelles manquantes|Faltan datos nutricionales/');
    await expect(missingNutritionText).toBeVisible();
  });

  test('persists composer selection across navigation', async ({ page }) => {
    const recipe = {
      id: 'test-persist-1',
      name: 'Persist Test Recipe',
      category: 'Primi',
      servings: '4',
      time: '30 min',
      source: 'manual',
      ingredients: ['pasta 200g'],
      steps: ['Cook'],
      nutrition: {
        perServing: { kcal: 250, proteinG: 10, carbsG: 50, fatG: 5, fiberG: 2 },
        perRecipe: { kcal: 1000, proteinG: 40, carbsG: 200, fatG: 20, fiberG: 8 },
        servingsUsed: 4,
      },
      favorite: false,
    };

    await seedRecipes(page, [recipe]);

    await page.goto(APP_ROOT + '#/meal-composer');
    await expect(page.locator('.mc-recipe-card', { hasText: recipe.name })).toBeVisible();

    // Add recipe by clicking its picker card
    await page.locator('.mc-recipe-card', { hasText: recipe.name }).click();
    await expect(page.locator('.mc-chip-name', { hasText: recipe.name })).toBeVisible();

    // Navigate to planner and back
    await page.goto(APP_ROOT + '#/planner');
    await expect(page).toHaveURL(/#\/planner/);
    await page.goto(APP_ROOT + '#/meal-composer');
    await expect(page).toHaveURL(/#\/meal-composer/);

    // Recipe should still be selected (chip visible)
    await expect(page.locator('.mc-chip-name', { hasText: recipe.name })).toBeVisible();
  });

  test('persists composer selection across hard reload', async ({ page }) => {
    const recipe = {
      id: 'test-reload',
      name: 'Reload Test Recipe',
      category: 'Primi',
      servings: '4',
      time: '30 min',
      source: 'manual',
      ingredients: ['pasta 200g'],
      steps: ['Cook'],
      nutrition: {
        perServing: { kcal: 250, proteinG: 10, carbsG: 50, fatG: 5, fiberG: 2 },
        perRecipe: { kcal: 1000, proteinG: 40, carbsG: 200, fatG: 20, fiberG: 8 },
        servingsUsed: 4,
      },
      favorite: false,
    };

    await seedRecipes(page, [recipe]);

    await page.goto(APP_ROOT + '#/meal-composer');
    await expect(page.locator('.mc-recipe-card', { hasText: recipe.name })).toBeVisible();

    // Add recipe
    await page.locator('.mc-recipe-card', { hasText: recipe.name }).click();
    await expect(page.locator('.mc-chip-name', { hasText: recipe.name })).toBeVisible();

    // Hard reload
    await page.reload();
    await expect(page.locator('.mc-chip-name', { hasText: recipe.name })).toBeVisible();
  });

  test('totals include only recipes with nutrition', async ({ page }) => {
    const recipeWithNutrition = {
      id: 'test-with-nutrition',
      name: 'Recipe With Nutrition',
      category: 'Primi',
      servings: '1',
      time: '30 min',
      source: 'manual',
      ingredients: ['pasta 200g'],
      steps: ['Cook'],
      nutrition: {
        perServing: { kcal: 500, proteinG: 20, carbsG: 70, fatG: 10, fiberG: 5 },
        perRecipe: { kcal: 500, proteinG: 20, carbsG: 70, fatG: 10, fiberG: 5 },
        servingsUsed: 1,
      },
      favorite: false,
    };

    const recipeWithoutNutrition = {
      id: 'test-without-nutrition',
      name: 'Recipe Without Nutrition',
      category: 'Primi',
      servings: '1',
      time: '30 min',
      source: 'manual',
      ingredients: ['rice 100g'],
      steps: ['Cook'],
      favorite: false,
    };

    await seedRecipes(page, [recipeWithNutrition, recipeWithoutNutrition]);

    // Add the recipe with nutrition via the meal-composer picker
    await page.goto(APP_ROOT + '#/meal-composer');
    await expect(page.locator('.mc-recipe-card', { hasText: recipeWithNutrition.name })).toBeVisible();
    await page.locator('.mc-recipe-card', { hasText: recipeWithNutrition.name }).click();
    await expect(page.locator('.mc-chip-name', { hasText: recipeWithNutrition.name })).toBeVisible();

    // The recipe without nutrition is filtered out of the picker — reach it via
    // recipe book → detail → "Add to meal" instead.
    await page.goto(APP_ROOT + '#/recipe-book');
    await page.locator('text=' + recipeWithoutNutrition.name).first().click();
    await expect(page).toHaveURL(/#\/recipe-book\/test-without-nutrition$/);
    await page.locator('.detail-action-meal').click();
    await expect(page).toHaveURL(/#\/meal-composer/);

    // Both recipes should be visible in the chips
    await expect(page.locator('.mc-chip-name', { hasText: recipeWithNutrition.name })).toBeVisible();
    await expect(page.locator('.mc-chip-name', { hasText: recipeWithoutNutrition.name })).toBeVisible();

    // Totals should show 500 (from recipe with nutrition only). The kcal display
    // animates up to its final value, so poll until it settles instead of reading once.
    await expect(page.locator('.mc-kcal-number')).toContainText('500');

    // Should see the excluding note
    const excludingNote = page.locator('text=/Alcune ricette non hanno|Some recipes don|Einige Rezepte haben|Certaines recettes n|Algunas recetas no/');
    await expect(excludingNote).toBeVisible();
  });
});
