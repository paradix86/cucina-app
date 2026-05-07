// One-time idempotent migration that decodes HTML entities left over in
// recipe text fields by older versions of the import pipeline. The decoder
// itself was incomplete pre-v0.12.x (handled only 5 entities), and most
// adapters never called it on name/ingredients/steps. After the v0.12.x fix
// at the buildImportedRecipe chokepoint, new imports are clean — this
// migration cleans up records that were saved before that fix landed.
//
// Forward-only: idempotent because a recipe with no entity markers is
// returned unchanged, and a recipe whose entities have been decoded once no
// longer matches the entity regex on the next run.
import { decodeImportEntities } from './import/adapters/utils';
import type { Recipe } from '../types';

const ENTITY_RX = /&[#a-zA-Z][^;\s]*;/;

export interface EntityMigrationResult {
  recipes: Recipe[];
  migratedCount: number;
}

export function migrateRecipeEntities(input: Recipe[]): EntityMigrationResult {
  let migratedCount = 0;
  const recipes = input.map(recipe => {
    const nameNeeds = ENTITY_RX.test(recipe.name || '');
    const ingredients = recipe.ingredients || [];
    const steps = recipe.steps || [];
    const ingsNeeds = ingredients.some(i => ENTITY_RX.test(i));
    const stepsNeeds = steps.some(s => ENTITY_RX.test(s));
    if (!nameNeeds && !ingsNeeds && !stepsNeeds) return recipe;
    migratedCount += 1;
    return {
      ...recipe,
      name: nameNeeds ? decodeImportEntities(recipe.name) : recipe.name,
      ingredients: ingsNeeds ? ingredients.map(decodeImportEntities) : ingredients,
      steps: stepsNeeds ? steps.map(decodeImportEntities) : steps,
    };
  });
  return { recipes, migratedCount };
}
