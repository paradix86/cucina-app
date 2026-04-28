import type { Recipe } from '../types';
import vettedSubset from '../content/duemme/vetted_subset.json';

export const DUEMME_VETTED_RECIPE_PACK = (Array.isArray(vettedSubset) ? vettedSubset : []) as Recipe[];
