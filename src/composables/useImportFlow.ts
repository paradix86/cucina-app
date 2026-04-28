import { computed, ref } from 'vue';
import { useRecipeBookStore } from '../stores/recipeBook';
import {
  ANTHROPIC_API_KEY,
  detectSource,
  normalizeSourceDomain,
  SOCIAL_IMPORT_ENABLED,
} from '../lib/import/core';
import {
  extractPageHeadingsHint,
  fetchReadableImportPage,
  inferImportFailureStage,
} from '../lib/import/web';
import {
  getImportAdapterForUrl,
  importWebsiteRecipeWithFallbacks,
  suggestImportTags,
} from '../lib/import/adapters';
import { normalizePreparationTypeValue } from '../lib/ingredientUtils';
import { t } from '../lib/i18n';
import type { ImportDiagnostic, ImportPreviewRecipe, ImportSource, PreparationType, StatusState } from '../types';

const sourceMap: Record<ImportSource, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  web: 'sito web',
};

export function useImportFlow() {
  const recipeBook = useRecipeBookStore();
  const url = ref('');
  const loading = ref(false);
  const status = ref<StatusState>({ message: '', type: '' });
  const diagnostic = ref<ImportDiagnostic | null>(null);
  const previewRecipe = ref<ImportPreviewRecipe | null>(null);

  const canSave = computed(() => !!previewRecipe.value);

  function setStatus(message: string, type: StatusState[ 'type' ] = ''): void {
    status.value = { message, type };
  }

  function clearPreview(): void {
    previewRecipe.value = null;
  }

  function clearDiagnostics(): void {
    diagnostic.value = null;
  }

  function normalizePreviewRecipe(recipe: ImportPreviewRecipe): ImportPreviewRecipe {
    const normalizeArray = (value: unknown): string[] => Array.isArray(value)
      ? value
        .map((item): string => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>;
            if (typeof record.text === 'string') {
              return record.text;
            }
            return Object.values(record).filter((v): v is string => typeof v === 'string').join(' ');
          }
          return '';
        })
        .map(item => item.trim())
        .filter(Boolean)
      : [];

    return {
      ...recipe,
      ingredients: normalizeArray(recipe.ingredients),
      steps: normalizeArray(recipe.steps),
      tags: normalizeArray(recipe.tags),
      mealOccasion: normalizeArray(recipe.mealOccasion),
    } as ImportPreviewRecipe;
  }

  function addTagValue(value: string): void {
    if (!previewRecipe.value || !value.trim()) return;
    const trimmed = value.trim();
    const existingLower = (previewRecipe.value.tags || []).map((t: string) => t.toLowerCase());
    if (existingLower.includes(trimmed.toLowerCase())) return;
    previewRecipe.value = { ...previewRecipe.value, tags: [ ...(previewRecipe.value.tags || []), trimmed ] };
  }

  function addTag(inputRef: any): void {
    const input = inputRef?.value;
    if (!input || !previewRecipe.value) return;
    const value = input.value.trim();
    if (!value) return;
    addTagValue(value);
    input.value = '';
    input.focus();
  }

  function removeTag(tag: string): void {
    if (!previewRecipe.value) return;
    previewRecipe.value = {
      ...previewRecipe.value,
      tags: (previewRecipe.value.tags || []).filter((item: string) => item !== tag),
    };
  }

  async function importRecipeFromUrl(): Promise<boolean> {
    const nextUrl = url.value.trim();
    if (!nextUrl) {
      setStatus(t('import_invalid_url'), 'err');
      clearDiagnostics();
      return false;
    }

    const source = detectSource(nextUrl);
    if (source !== 'web' && !SOCIAL_IMPORT_ENABLED) {
      setStatus(t('import_error_social_unavailable', { source: sourceMap[ source ] }), 'err');
      clearDiagnostics();
      return false;
    }

    const domain = normalizeSourceDomain(nextUrl);
    // getImportAdapterForUrl checks domain match first, then canHandle fallback
    const adapterObj = getImportAdapterForUrl(nextUrl);
    const adapterLabel = adapterObj ? adapterObj.domain : 'generic / json-ld fallback';

    loading.value = true;
    clearPreview();
    clearDiagnostics();
    setStatus(t('import_loading'), 'loading');

    let fetchedMarkdown: string | null = null;
    try {
      if (source === 'web') {
        fetchedMarkdown = await fetchReadableImportPage(nextUrl);
        const recipe = await importWebsiteRecipeWithFallbacks(fetchedMarkdown, nextUrl);
        if (!recipe.tags || !recipe.tags.length) {
          recipe.tags = suggestImportTags(
            recipe.sourceDomain,
            recipe.preparationType,
            recipe.category,
            recipe.name,
          );
        }
        previewRecipe.value = normalizePreviewRecipe(recipe);
        setStatus(t('import_success'), 'ok');
        return true;
      }

      const prompt = `Sei un assistente culinario esperto. Analizza questo URL: ${nextUrl}

Il link proviene da: ${sourceMap[ source ]}.

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

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (ANTHROPIC_API_KEY) {
        headers[ 'x-api-key' ] = ANTHROPIC_API_KEY;
        headers[ 'anthropic-version' ] = '2023-06-01';
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [ { role: 'user', content: prompt } ],
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as {
        content?: Array<{ text?: string }>;
      };
      const raw = (data.content || []).map(chunk => chunk.text || '').join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      const recipe = JSON.parse(clean) as Partial<ImportPreviewRecipe>;
      const prepType = normalizePreparationTypeValue(recipe.preparationType) || 'classic';

      previewRecipe.value = normalizePreviewRecipe({
        ...recipe,
        id: `imp_${Date.now()}`,
        source,
        url: nextUrl,
        sourceDomain: normalizeSourceDomain(nextUrl),
        preparationType: prepType as PreparationType,
        name: recipe.name || '',
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
        steps: Array.isArray(recipe.steps) ? recipe.steps : [],
      } as ImportPreviewRecipe);
      setStatus(t('import_success'), 'ok');
      return true;
    } catch (error: unknown) {
      const rawError = String((error as Error)?.message || error).trim();
      const isDeadPage = source === 'web'
        && (rawError.includes('GZ_PAGE_NOT_FOUND') || rawError.includes('WEB_FETCH_404'));
      const isWebImportLimit = source === 'web'
        && (rawError.includes('UNSUPPORTED_WEB_IMPORT') || rawError.includes('WEB_FETCH'));
      const isWebTimeout = source === 'web' && rawError.includes('WEB_TIMEOUT');
      if (source === 'web') {
        const stage = inferImportFailureStage(rawError);
        diagnostic.value = {
          domain: domain || nextUrl,
          adapter: adapterLabel,
          stage,
          reason: rawError || t('import_error'),
          hint: fetchedMarkdown && stage === 'parse-content' && !isDeadPage
            ? extractPageHeadingsHint(fetchedMarkdown)
            : null,
        };
      } else {
        clearDiagnostics();
      }
      setStatus(
        isDeadPage
          ? t('import_error_page_not_found')
          : isWebTimeout
            ? t('import_error_timeout')
          : isWebImportLimit
            ? t('import_error_web_blocked')
            : t('import_error'),
        'err',
      );
      return false;
    } finally {
      loading.value = false;
    }
  }

  function updatePreparationType(value: PreparationType): void {
    if (!previewRecipe.value) return;
    previewRecipe.value = {
      ...previewRecipe.value,
      preparationType: value,
      bimby: value === 'bimby',
    };
  }

  function togglePreviewMealOccasion(occasion: string): void {
    if (!previewRecipe.value) return;
    const valid = [ 'Colazione', 'Pranzo', 'Cena', 'Spuntino' ];
    if (!valid.includes(occasion)) return;
    const current = previewRecipe.value.mealOccasion || [];
    const updated = current.includes(occasion)
      ? current.filter(o => o !== occasion)
      : [ ...current, occasion ];
    previewRecipe.value = { ...previewRecipe.value, mealOccasion: updated };
  }

  function savePreviewedRecipe(): boolean {
    if (!previewRecipe.value) return false;
    const normalized = normalizePreviewRecipe(previewRecipe.value);
    const ok = recipeBook.add(normalized);
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
    addTagValue,
    removeTag,
    importRecipeFromUrl,
    updatePreparationType,
    togglePreviewMealOccasion,
    savePreviewedRecipe,
    discardPreview: clearPreview,
    clearDiagnostics,
    socialImportAvailable: SOCIAL_IMPORT_ENABLED,
  };
}
