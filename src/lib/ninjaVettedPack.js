import vettedSubset from '../content/ninja/vetted_subset.json';

export const NINJA_VETTED_RECIPE_PACK = Array.isArray(vettedSubset?.recipes)
  ? vettedSubset.recipes
  : [];
