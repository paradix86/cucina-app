import { test, expect } from '@playwright/test';

test.describe('Meal Composer Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:4173/cucina-app/');
    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('shows recipe in composer even without nutrition, with missing-nutrition badge', async ({ page }) => {
    // Seed a recipe without nutrition via localStorage
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

    await page.evaluate((recipeData) => {
      const recipes = JSON.parse(localStorage.getItem('cucina_recipebook_v3') || '[]');
      recipes.push(recipeData);
      localStorage.setItem('cucina_recipebook_v3', JSON.stringify(recipes));
    }, recipe);

    // Navigate to recipe book
    await page.goto('http://localhost:4173/cucina-app/#/recipe-book');
    await page.waitForLoadState('networkidle');

    // Wait for recipe to appear and click it
    await page.locator('text=' + recipe.name).first().click();
    await page.waitForLoadState('networkidle');

    // Click "Aggiungi al pasto" button
    const addToMealButton = page.locator('button:has-text("Aggiungi al pasto"), button:has-text("Add to meal")');
    await addToMealButton.click();
    await page.waitForLoadState('networkidle');

    // Should land on /meal-composer
    expect(page.url()).toContain('meal-composer');

    // Recipe should be visible by name in the dashboard/chips section
    await expect(page.locator('text=' + recipe.name)).toBeVisible();

    // Should see a badge or note about missing nutrition
    const missingNutritionText = await page.locator('text=/Valori nutrizionali mancanti|Nutrition data missing|Nährwertdaten fehlen|Données nutritionnelles manquantes|Faltan datos nutricionales/').isVisible();
    expect(missingNutritionText).toBeTruthy();
  });

  test('persists composer selection across navigation', async ({ page }) => {
    // Seed a recipe
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

    await page.evaluate((recipeData) => {
      const recipes = JSON.parse(localStorage.getItem('cucina_recipebook_v3') || '[]');
      recipes.push(recipeData);
      localStorage.setItem('cucina_recipebook_v3', JSON.stringify(recipes));
    }, recipe);

    // Go to meal composer
    await page.goto('http://localhost:4173/cucina-app/#/meal-composer');
    await page.waitForLoadState('networkidle');

    // Add recipe by clicking its checkbox in the picker
    await page.locator('button:has-text("' + recipe.name + '")').click();
    await page.waitForLoadState('networkidle');

    // Recipe should appear in dashboard
    await expect(page.locator('text=' + recipe.name)).toBeVisible();

    // Navigate to planner
    await page.goto('http://localhost:4173/cucina-app/#/planner');
    await page.waitForLoadState('networkidle');

    // Navigate back to meal composer
    await page.goto('http://localhost:4173/cucina-app/#/meal-composer');
    await page.waitForLoadState('networkidle');

    // Recipe should still be visible
    await expect(page.locator('text=' + recipe.name)).toBeVisible();
  });

  test('persists composer selection across hard reload', async ({ page }) => {
    // Seed a recipe
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

    await page.evaluate((recipeData) => {
      const recipes = JSON.parse(localStorage.getItem('cucina_recipebook_v3') || '[]');
      recipes.push(recipeData);
      localStorage.setItem('cucina_recipebook_v3', JSON.stringify(recipes));
    }, recipe);

    // Go to meal composer
    await page.goto('http://localhost:4173/cucina-app/#/meal-composer');
    await page.waitForLoadState('networkidle');

    // Add recipe
    await page.locator('button:has-text("' + recipe.name + '")').click();
    await page.waitForLoadState('networkidle');

    // Recipe should be visible
    await expect(page.locator('text=' + recipe.name)).toBeVisible();

    // Hard reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Recipe should still be visible after reload
    await expect(page.locator('text=' + recipe.name)).toBeVisible();
  });

  test('totals include only recipes with nutrition', async ({ page }) => {
    // Seed two recipes: one with nutrition, one without
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

    await page.evaluate((recipesData) => {
      const recipes = JSON.parse(localStorage.getItem('cucina_recipebook_v3') || '[]');
      recipes.push(...recipesData);
      localStorage.setItem('cucina_recipebook_v3', JSON.stringify(recipes));
    }, [recipeWithNutrition, recipeWithoutNutrition]);

    // Go to meal composer
    await page.goto('http://localhost:4173/cucina-app/#/meal-composer');
    await page.waitForLoadState('networkidle');

    // Add both recipes
    await page.locator('button:has-text("' + recipeWithNutrition.name + '")').click();
    await page.waitForLoadState('networkidle');

    // The one without nutrition should be in the empty state list or in the picker, click it
    // We need to click the "Add to meal" from recipe detail, so navigate there
    await page.locator('text=' + recipeWithoutNutrition.name).first().click();
    await page.waitForLoadState('networkidle');

    // Wait for the recipe detail to load and click add to meal
    const addToMealButton = page.locator('button:has-text("Aggiungi al pasto"), button:has-text("Add to meal")').first();
    await addToMealButton.click();
    await page.waitForLoadState('networkidle');

    // Should be on meal composer
    expect(page.url()).toContain('meal-composer');

    // Both recipes should be visible in the chips
    await expect(page.locator('text=' + recipeWithNutrition.name)).toBeVisible();
    await expect(page.locator('text=' + recipeWithoutNutrition.name)).toBeVisible();

    // Totals should show 500 (from recipe with nutrition only)
    const totalsText = await page.locator('.mc-kcal-number').textContent();
    expect(totalsText).toContain('500');

    // Should see the excluding note
    const excludingNote = page.locator('text=/Alcune ricette non hanno|Some recipes don|Einige Rezepte haben|Certaines recettes n|Algunas recetas no/');
    await expect(excludingNote).toBeVisible();
  });
});
