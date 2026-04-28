import type { Recipe } from '../types';

let _cache: Recipe[] | null = null;

export async function getNinjaVettedPack(): Promise<Recipe[]> {
  if (_cache) return _cache;
  const mod = await import('../content/ninja/vetted_subset.json');
  _cache = Array.isArray(mod.default?.recipes) ? (mod.default.recipes as Recipe[]) : [];
  return _cache;
}
