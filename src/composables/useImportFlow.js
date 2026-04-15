import { computed, ref } from 'vue';
import { useRecipeBook } from './useRecipeBook.js';
import {
  ANTHROPIC_API_KEY,
  detectSource,
  normalizeSourceDomain,
} from '../lib/import/core.js';
import {
  extractPageHeadingsHint,
  fetchReadableImportPage,
  inferImportFailureStage,
} from '../lib/import/web.js';
import {
  getImportAdapterForDomain,
  importWebsiteRecipeWithAdapters,
  suggestImportTags,
} from '../lib/import/adapters.js';
import { normalizePreparationTypeValue } from '../lib/storage.js';
import { t } from '../lib/i18n.js';

const sourceMap = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', web: 'sito web' };

export function useImportFlow() {
  const recipeBook = useRecipeBook();
  const url = ref('');
  const loading = ref(false);
  const status = ref({ message: '', type: '' });
  const diagnostic = ref(null);
  const previewRecipe = ref(null);

  const canSave = computed(() => !!previewRecipe.value);

  function setStatus(message, type = '') {
    status.value = { message, type };
  }

  function clearPreview() {
    previewRecipe.value = null;
  }

  function clearDiagnostics() {
    diagnostic.value = null;
  }

  function addTag() {
    const input = document.getElementById('preview-tag-input-vue');
    if (!input || !previewRecipe.value) return;
    const value = input.value.trim();
    if (!value) return;
    const tags = new Set(previewRecipe.value.tags || []);
    tags.add(value);
    previewRecipe.value = { ...previewRecipe.value, tags: [...tags] };
    input.value = '';
  }

  function removeTag(tag) {
    if (!previewRecipe.value) return;
    previewRecipe.value = {
      ...previewRecipe.value,
      tags: (previewRecipe.value.tags || []).filter(item => item !== tag),
    };
  }

  async function importRecipeFromUrl() {
    const nextUrl = url.value.trim();
    if (!nextUrl) {
      setStatus(t('import_invalid_url'), 'err');
      clearDiagnostics();
      return false;
    }

    const source = detectSource(nextUrl);
    const domain = normalizeSourceDomain(nextUrl);
    const adapterObj = getImportAdapterForDomain(domain);
    const adapterLabel = adapterObj ? adapterObj.domain : 'generic fallback';

    loading.value = true;
    clearPreview();
    clearDiagnostics();
    setStatus(t('import_loading'), 'loading');

    let fetchedMarkdown = null;
    try {
      if (source === 'web') {
        fetchedMarkdown = await fetchReadableImportPage(nextUrl);
        const recipe = importWebsiteRecipeWithAdapters(fetchedMarkdown, nextUrl);
        if (!recipe.tags || !recipe.tags.length) {
          recipe.tags = suggestImportTags(recipe.sourceDomain, recipe.preparationType, recipe.category, recipe.name);
        }
        previewRecipe.value = recipe;
        setStatus(t('import_success'), 'ok');
        return true;
      }

      const prompt = `Sei un assistente culinario esperto. Analizza questo URL: ${nextUrl}

Il link proviene da: ${sourceMap[source]}.

Basandoti sull'URL e su tutto ciò che puoi dedurre (titolo, canale, stile del contenuto), estrai o CREA una ricetta plausibile e dettagliata in italiano.
Se non riesci a ricavare la ricetta esatta, crea una ricetta realistica e gustosa ispirata al probabile contenuto del link.

Rispondi SOLO con un oggetto JSON valido, senza backtick, senza testo aggiuntivo prima o dopo:
{
  "name": "Nome della ricetta",
  "category": "Categoria (Primi/Secondi/Dolci/Antipasti/Zuppe/Sughi/Bevande)",
  "emoji": "emoji appropriata",
  "time": "es. 30 min",
  "servings": "es. 4",
  "difficolta": "Facile/Media/Difficile",
  "ingredients": ["ingrediente 1 con quantità", "ingrediente 2", "..."],
  "steps": ["passo 1 dettagliato", "passo 2", "..."],
  "timerMinutes": numero_minuti_cottura_principale
}`;

      const headers = { 'Content-Type': 'application/json' };
      if (ANTHROPIC_API_KEY) {
        headers['x-api-key'] = ANTHROPIC_API_KEY;
        headers['anthropic-version'] = '2023-06-01';
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const raw = data.content.map(chunk => chunk.text || '').join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      const recipe = JSON.parse(clean);
      previewRecipe.value = {
        ...recipe,
        id: `imp_${Date.now()}`,
        source,
        url: nextUrl,
        sourceDomain: normalizeSourceDomain(nextUrl),
        preparationType: normalizePreparationTypeValue(recipe.preparationType) || 'classic',
      };
      setStatus(t('import_success'), 'ok');
      return true;
    } catch (error) {
      const rawError = String(error?.message || error).trim();
      const isWebImportLimit = source === 'web' && (rawError.includes('UNSUPPORTED_WEB_IMPORT') || rawError.includes('WEB_FETCH'));
      if (source === 'web') {
        const stage = inferImportFailureStage(rawError);
        diagnostic.value = {
          domain: domain || nextUrl,
          adapter: adapterLabel,
          stage,
          reason: rawError || t('import_error'),
          hint: fetchedMarkdown && stage === 'parse-content' ? extractPageHeadingsHint(fetchedMarkdown) : null,
        };
      } else {
        clearDiagnostics();
      }
      setStatus(isWebImportLimit ? t('import_error_web_blocked') : t('import_error'), 'err');
      return false;
    } finally {
      loading.value = false;
    }
  }

  function updatePreparationType(value) {
    if (!previewRecipe.value) return;
    previewRecipe.value = {
      ...previewRecipe.value,
      preparationType: value,
      bimby: value === 'bimby',
    };
  }

  function savePreviewedRecipe() {
    if (!previewRecipe.value) return false;
    const ok = recipeBook.add(previewRecipe.value);
    if (ok) {
      url.value = '';
      clearPreview();
      setStatus(t('builtin_saved_ok'), 'ok');
      clearDiagnostics();
    }
    return ok;
  }

  return {
    url,
    loading,
    status,
    diagnostic,
    previewRecipe,
    canSave,
    addTag,
    removeTag,
    importRecipeFromUrl,
    updatePreparationType,
    savePreviewedRecipe,
    discardPreview: clearPreview,
    clearDiagnostics,
  };
}
