/**
 * storage.js — Gestione ricettario personale con localStorage
 */

const STORAGE_KEY = 'cucina_ricettario_v2';

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveToStorage(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn('localStorage non disponibile:', e);
    alert('Impossibile salvare: localStorage non disponibile in questo browser.');
  }
}

function addToSaved(ricetta) {
  const arr = loadSaved();
  if (arr.find(r => r.id === ricetta.id)) {
    alert('Questa ricetta è già nel tuo ricettario!');
    return false;
  }
  arr.unshift(ricetta);
  saveToStorage(arr);
  return true;
}

function deleteFromSaved(id) {
  const arr = loadSaved().filter(r => r.id !== id);
  saveToStorage(arr);
}

function exportRicettario() {
  const arr = loadSaved();
  const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ricettario_backup.json';
  a.click();
}

function importRicettario(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const arr = JSON.parse(e.target.result);
        if (!Array.isArray(arr)) throw new Error('Formato non valido');
        const existing = loadSaved();
        const merged = [...arr, ...existing.filter(r => !arr.find(a => a.id === r.id))];
        saveToStorage(merged);
        resolve(merged.length);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
