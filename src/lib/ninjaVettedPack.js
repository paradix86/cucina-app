let _cache = null;

export async function getNinjaVettedPack() {
  if (_cache) return _cache;
  const mod = await import('../content/ninja/vetted_subset.json');
  _cache = Array.isArray(mod.default?.recipes) ? mod.default.recipes : [];
  return _cache;
}
