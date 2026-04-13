/**
 * storage.js — Personal recipe book management via localStorage
 */

const STORAGE_KEY    = 'cucina_recipebook_v3';
const STORAGE_KEY_V2 = 'cucina_ricettario_v2';

/**
 * One-time migration: v2 (Italian field names) → v3 (English field names).
 * Called once from app.js before any render.
 */
function migrateFromV2() {
  if (!localStorage.getItem(STORAGE_KEY_V2)) return;   // nothing to migrate
  if (localStorage.getItem(STORAGE_KEY))     return;   // v3 already exists

  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY_V2) || '[]');
    if (!Array.isArray(arr)) return;

    const migrated = arr.map(r => ({
      id:           r.id,
      name:         r.nome         || r.name         || '',
      category:     r.cat          || r.category      || '',
      bimby:        r.bimby        != null ? r.bimby  : false,
      emoji:        r.emoji        || '🍴',
      time:         r.tempo        || r.time          || '',
      servings:     r.porzioni     || r.servings       || '',
      source:       r.fonte        || r.source         || 'web',
      ingredients:  r.ingredienti  || r.ingredients    || [],
      steps:        r.steps        || [],
      timerMinutes: r.timerMin     !== undefined ? r.timerMin : (r.timerMinutes || 0),
      url:          r.url          || undefined,
      difficolta:   r.difficolta   || undefined,
    }));

    saveRecipeBook(migrated);
    localStorage.removeItem(STORAGE_KEY_V2);
  } catch (e) {
    console.warn('Migration v2→v3 failed:', e);
  }
}

function loadRecipeBook() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecipeBook(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
}

function addRecipe(recipe) {
  const arr = loadRecipeBook();
  if (arr.find(r => r.id === recipe.id)) return false;
  arr.unshift(recipe);
  saveRecipeBook(arr);
  return true;
}

function deleteRecipe(id) {
  saveRecipeBook(loadRecipeBook().filter(r => r.id !== id));
}

function updateRecipeNotes(id, notes) {
  const arr = loadRecipeBook();
  const idx = arr.findIndex(recipe => recipe.id === id);
  if (idx === -1) return false;
  arr[idx] = { ...arr[idx], notes: notes || '' };
  saveRecipeBook(arr);
  return true;
}

function exportRecipeBook() {
  const arr  = loadRecipeBook();
  const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  const url  = URL.createObjectURL(blob);
  a.href     = url;
  a.download = 'ricettario_backup.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return arr.length;
}

function importRecipeBook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const arr = JSON.parse(e.target.result);
        if (!Array.isArray(arr)) throw new Error('Invalid format');
        const existing = loadRecipeBook();
        const merged   = [...arr, ...existing.filter(r => !arr.find(a => a.id === r.id))];
        saveRecipeBook(merged);
        resolve(merged.length);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
