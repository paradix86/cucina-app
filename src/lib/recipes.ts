import { getPreparationType } from './ingredientUtils';
import { t } from './i18n';
import { detectBimbyAction, renderBimbyActionIcon } from './bimbyIcons';
import type { PreparationType, Recipe } from '../types';

type SearchableRecipe = Partial<Recipe> & {
  nome?: string;
  cat?: string;
  ingredienti?: string[];
};

interface PreparationInfo {
  type: PreparationType;
  cls: string;
  txt: string;
  cardCls: string;
}

export function recipeMatchesQuery(recipe: SearchableRecipe, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const haystack = [
    recipe.name || recipe.nome || '',
    recipe.category || recipe.cat || '',
    ...(recipe.ingredients || recipe.ingredienti || []),
    ...(recipe.steps || []),
  ].join(' ').toLowerCase();
  return haystack.includes(q);
}

export function highlight(text: string | null | undefined, query: string): string {
  if (!query || !text) return text || '';
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

export function parseRecipeTime(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const hours = (timeStr.match(/(\d+)\s*h/) || [])[1] || '0';
  const minutes = (timeStr.match(/(\d+)\s*min/) || [])[1] || '0';
  return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
}

export function getSourceDomainLabel(domain: string | null | undefined): string {
  const normalized = String(domain || '').trim().toLowerCase();
  if (!normalized) return '';
  const pretty: Record<string, string> = {
    'giallozafferano.it': 'GialloZafferano',
    'ricetteperbimby.it': 'RicettePerBimby',
    'ricette-bimby.net': 'Ricette Bimby',
    'youtube.com': 'YouTube',
    'youtu.be': 'YouTube',
    'instagram.com': 'Instagram',
    'tiktok.com': 'TikTok',
    'cookidoo.it': 'Cookidoo',
    'allrecipes.com': 'Allrecipes',
  };
  return pretty[normalized] || normalized;
}

export function getPreparationInfo(recipe: Partial<Recipe> | null | undefined): PreparationInfo {
  const preparationType = getPreparationType(recipe);
  switch (preparationType) {
    case 'bimby':
      return { type: 'bimby', cls: 'badge-bimby', txt: t('prep_bimby'), cardCls: ' is-bimby' };
    case 'airfryer':
      return { type: 'airfryer', cls: 'badge-airfryer', txt: t('prep_airfryer'), cardCls: ' is-airfryer' };
    default:
      return { type: 'classic', cls: 'badge-classica', txt: t('prep_classic'), cardCls: '' };
  }
}

export function joinMetaParts(parts: Array<string | null | undefined | false> | null | undefined): string {
  return (parts || []).filter(Boolean).join(' · ');
}

export function getMealOccasionLabel(key: string): string {
  const map: Record<string, string> = {
    colazione: t('meal_occasion_colazione'),
    pranzo: t('meal_occasion_pranzo'),
    cena: t('meal_occasion_cena'),
    spuntino: t('meal_occasion_spuntino'),
  };
  return map[String(key).toLowerCase()] || key;
}

export const MEAL_OCCASION_OPTIONS: string[] = ['Colazione', 'Pranzo', 'Cena', 'Spuntino'];

export function suggestMealOccasions(recipe: Partial<Recipe>): string[] {
  const combined = ((recipe.name || '') + ' ' + (recipe.category || '')).toLowerCase();
  const suggestions = new Set<string>();
  if (/pancakes|colazione|breakfast|omelette|frittata|yogurt|porridge|uova|toast|shakshuka/.test(combined)) {
    suggestions.add('Colazione');
  }
  if (/snack|spuntino|ball|energy|appetizer|dip|hummus|nibble|quick/.test(combined)) {
    suggestions.add('Spuntino');
  }
  if (/pasta|risotto|pizza|burger|sandwich|insalata|salad|bowl/.test(combined)) {
    suggestions.add('Pranzo');
  }
  if (/pollo|chicken|salmone|salmon|carne|meat|steak|merluzzo|verdure|vegetables/.test(combined)) {
    suggestions.add('Cena');
  }
  return Array.from(suggestions);
}

export function scaleIngredients(
  ingredients: string[] | null | undefined,
  base: number,
  target: number,
): string[] | null | undefined {
  if (base === target) return ingredients;
  const factor = target / base;
  const FRAC: Record<string, string> = {
    '½': '0.5', '¼': '0.25', '¾': '0.75',
    '⅓': '0.333', '⅔': '0.667',
    '⅛': '0.125', '⅜': '0.375', '⅝': '0.625', '⅞': '0.875',
  };
  const FRAC_INV: Record<number, string> = { 0.5: '½', 0.25: '¼', 0.75: '¾' };

  return (ingredients || []).map(ing => {
    let s = ing;
    for (const [f, v] of Object.entries(FRAC)) s = s.split(f).join(v);
    s = s.replace(/\d+(?:[.,]\d+)?/g, m => {
      const n = parseFloat(m.replace(',', '.'));
      const scaled = n * factor;
      const r = Math.round(scaled * 10) / 10;
      if (FRAC_INV[r] !== undefined) return FRAC_INV[r];
      if (r === Math.floor(r)) return String(Math.floor(r));
      return r.toFixed(1);
    });
    return s;
  });
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildStepsHtml(steps: unknown[] | null | undefined, preparationType: PreparationType): string {
  const normalizedSteps = (steps || []).map(s => (typeof s === 'string' ? s : String(s)));
  return normalizedSteps.map((step, i) => {
    if (preparationType === 'bimby') {
      const sep = step.indexOf(' — ');
      if (sep !== -1) {
        const tags = step.slice(0, sep).split('·').map(tag => tag.trim()).filter(Boolean);
        const text = step.slice(sep + 3);
        const tagsHtml = tags.map(tag => `<span class="bimby-tag">${escapeHtml(tag)}</span>`).join('');
        const actionIcon = renderBimbyActionIcon(detectBimbyAction(step));
        const tagsRowContent = (actionIcon || tagsHtml) ? `<div class="bimby-step-tags">${actionIcon}${tagsHtml}</div>` : '';
        return `
          <div class="bimby-step">
            <span class="step-n">${i + 1}</span>
            <div class="bimby-step-body">
              ${tagsRowContent}
              <p class="step-txt">${escapeHtml(text)}</p>
            </div>
          </div>
        `;
      }
    }
    return `
      <div class="step-row">
        <span class="step-n">${i + 1}</span>
        <p class="step-txt">${escapeHtml(step)}</p>
      </div>
    `;
  }).join('');
}

export function extractStepSeconds(stepText: string): number {
  const minMatch = stepText.match(/(\d+)\s*min/i);
  const secMatch = stepText.match(/(\d+)\s*sec/i);
  const hourMatch = stepText.match(/(\d+)\s*h/i);
  if (!minMatch && !secMatch && !hourMatch) return 0;
  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;
  const seconds = secMatch ? parseInt(secMatch[1], 10) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatTimerLabel(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}${t('hours_short')} ${m} ${t('minutes_short')}` : `${h}${t('hours_short')}`;
  }
  return `${min} ${t('minutes_short')}`;
}

export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
