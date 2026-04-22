import { normalizeSourceDomain } from '../core';
import type { ImportPreviewRecipe } from '../../../types';
import {
  normalizeImportText,
  stripImportMarkdownNoise,
  stripImportLinksAndImages,
  normalizeImportCategory,
  inferImportCategoryFromTitleAndText,
  inferImportEmoji,
  inferImportPreparationType,
  buildImportedRecipe,
} from './utils';

/**
 * Generic markdown heading-scanner fallback.
 * Attempts to extract recipe data from a Jina-readable markdown page using
 * standard heading patterns (## Ingredienti / ## Come preparare / etc.).
 * Returns null if the page structure doesn't match — callers should proceed
 * to the HTML/JSON-LD path in that case.
 */
export function parseGenericReadableRecipe(markdown: string, url: string): ImportPreviewRecipe | null {
  const md = normalizeImportText(markdown);
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const ingredientsMatch = md.match(/##\s*(?:Ingredienti|Ingredients)\s*\n([\s\S]*?)\n##\s*/i);
  const stepsSection = md.match(/##\s*(?:Come preparare|Procedimento|Instructions|Preparazione|Metodo|Directions)\s*\n([\s\S]*?)(?:\n##\s*|$)/i);
  if (!titleMatch || !ingredientsMatch || !stepsSection) return null;

  const ingredients = ingredientsMatch[ 1 ]
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*]/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  const numberedSteps = [ ...stepsSection[ 1 ].matchAll(/^\d+\.\s+(.*)$/gm) ].map(match => stripImportLinksAndImages(match[ 1 ]));
  const bulletSteps = stepsSection[ 1 ]
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*]/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim());
  const steps = numberedSteps.length ? numberedSteps : bulletSteps;
  if (!ingredients.length || !steps.length) return null;

  const domain = normalizeSourceDomain(url);
  const category = normalizeImportCategory(inferImportCategoryFromTitleAndText(titleMatch[ 1 ], stepsSection[ 1 ]));
  return buildImportedRecipe(url, {
    name: stripImportMarkdownNoise(titleMatch[ 1 ]).trim(),
    category,
    emoji: inferImportEmoji(category),
    ingredients,
    steps,
    preparationType: inferImportPreparationType(md, domain),
  });
}
