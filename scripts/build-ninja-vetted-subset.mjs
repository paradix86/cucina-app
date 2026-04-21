import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const inputPackPath = path.join(cwd, 'scripts/tmp/ninja-griglie-pack.json');
const inputReportPath = path.join(cwd, 'scripts/tmp/ninja-griglie-pack.report.json');
const outputSubsetPath = path.join(cwd, 'scripts/tmp/ninja-griglie-pack-vetted-subset.json');
const outputReportPath = path.join(cwd, 'scripts/tmp/ninja-griglie-pack-vetted-review.json');
const outputMarkdownPath = path.join(cwd, 'scripts/tmp/ninja-griglie-pack-vetted-review.md');

const pack = JSON.parse(fs.readFileSync(inputPackPath, 'utf8'));
const report = JSON.parse(fs.readFileSync(inputReportPath, 'utf8'));

const reportById = new Map((report.accepted || []).map(entry => [ entry.id, entry ]));

const htmlEntityRe = /&#\d+;|&#x[0-9a-f]+;|&amp;|&quot;|&#038;/i;
const englishStepRe = /\b(?:Add|Place|Insert|Remove|Cook|Meanwhile|Transfer|Mix|Use|Turn|Press|Select|Open|Close|When|Before|After|For the|Set the|Preheat|Spray|Brush|Drizzle|Slice|Serve|Stir|Blend)\b/;
const badTitleRe = /^(?:Protein Pancakes|Sweet Potato and Tomato Soup|Pane al lime|Polpettone al limone|Toast al formaggio|Classico stile Diner Burgers|Roast Beef e patate arrosto|Ultimate Steak Sandwich .*|Shortbread al cioccolato Matcha immerso nello zenzero Miso|Toad in the Hole|Coffin Pop Tarts con Dip al cioccolato nero|Harissa Lentil Veggie Burgers|Curry Chicken Skewers with Mint Dip|Airfryer Beetroot .*|Rose .* Honey Grilled Fruits .*|Cheesy Chicken Quesadilla Stacks|Halloumi Pigs in Blankets)$/i;

function getVisibleText(recipe) {
  return [
    recipe.name,
    recipe.category,
    recipe.time,
    ...(recipe.ingredients || []),
    ...(recipe.steps || []),
  ].join('\n');
}

function getExclusionReasons(recipe) {
  const reasons = [];
  const meta = reportById.get(recipe.id) || {};
  const warnings = meta.warnings || [];
  const visibleText = getVisibleText(recipe);
  const englishSteps = (recipe.steps || []).filter(step => englishStepRe.test(step));

  if (warnings.length) reasons.push(...warnings.map(warning => `warning:${warning}`));
  if (htmlEntityRe.test(visibleText)) reasons.push('html_entities');
  if (badTitleRe.test(recipe.name || '')) reasons.push('title_not_clean');
  if (englishSteps.length >= 2) reasons.push('english_step_leftovers');
  if ((recipe.ingredients || []).length < 4) reasons.push('ingredient_count_too_low_for_vetted');
  if ((recipe.steps || []).length < 3) reasons.push('step_count_too_low_for_vetted');

  return [ ...new Set(reasons) ];
}

function summarizeExclusions(excluded) {
  const reasonCounts = {};
  for (const recipe of excluded) {
    for (const reason of recipe.exclusionReasons) {
      reasonCounts[ reason ] = (reasonCounts[ reason ] || 0) + 1;
    }
  }
  return reasonCounts;
}

const analyzed = pack.recipes.map(recipe => {
  const meta = reportById.get(recipe.id) || {};
  return {
    ...recipe,
    warningCount: meta.warningCount || 0,
    warnings: meta.warnings || [],
    exclusionReasons: getExclusionReasons(recipe),
  };
});

const vettedRecipes = analyzed
  .filter(recipe => recipe.exclusionReasons.length === 0)
  .map(({ exclusionReasons, warningCount, warnings, ...recipe }) => ({
    ...recipe,
    tags: Array.from(new Set([ ...(recipe.tags || []), 'offline-pack-vetted', 'Ninja Vetted Subset' ])),
  }));

const excludedRecipes = analyzed
  .filter(recipe => recipe.exclusionReasons.length > 0)
  .map(({ exclusionReasons, warningCount, warnings, ...recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    url: recipe.url,
    warningCount,
    warnings,
    ingredientCount: (recipe.ingredients || []).length,
    stepCount: (recipe.steps || []).length,
    exclusionReasons,
  }));

const summary = {
  generatedAt: new Date().toISOString(),
  sourcePack: inputPackPath,
  sourceListing: pack.sourceListing,
  sourceProductSlug: pack.sourceProductSlug,
  provenanceNotice: pack.reviewNotice,
  selectionPolicy: {
    description: 'Conservative vetted subset for app integration. Keep only recipes that look clean in-app without manual cleanup.',
    include: [
      'no warnings in the draft report',
      'no HTML entities in visible text',
      'clean title with no obvious English leftovers or mistranslations',
      'no repeated English imperative leftovers across steps',
      'at least 4 ingredients',
      'at least 3 steps',
    ],
    exclude: [
      'warning-bearing draft entries',
      'HTML entities in title/ingredients/steps',
      'obviously awkward or untranslated titles',
      'recipes with multiple English step leftovers',
      'very low-information recipes not ideal for app display',
    ],
  },
  counts: {
    sourceRecipes: pack.recipes.length,
    kept: vettedRecipes.length,
    excluded: excludedRecipes.length,
  },
  exclusionReasonCounts: summarizeExclusions(excludedRecipes),
  excludedExamples: excludedRecipes.slice(0, 25),
};

const subsetPayload = {
  generatedAt: summary.generatedAt,
  sourceListing: pack.sourceListing,
  sourceProductSlug: pack.sourceProductSlug,
  reviewNotice: pack.reviewNotice,
  subsetNotice: 'Vetted subset only. Selected for higher in-app display quality; still review provenance/content rights before redistribution.',
  selectionPolicy: summary.selectionPolicy,
  counts: summary.counts,
  recipes: vettedRecipes,
};

const markdown = [
  '# Ninja Vetted Subset Review',
  '',
  `- Generated: ${summary.generatedAt}`,
  `- Source listing: ${summary.sourceListing}`,
  `- Source recipes: ${summary.counts.sourceRecipes}`,
  `- Kept for vetted subset: ${summary.counts.kept}`,
  `- Excluded from vetted subset: ${summary.counts.excluded}`,
  `- Notice: ${pack.reviewNotice}`,
  '',
  '## Vetting Criteria',
  '',
  ...summary.selectionPolicy.include.map(item => `- Keep: ${item}`),
  ...summary.selectionPolicy.exclude.map(item => `- Exclude: ${item}`),
  '',
  '## Exclusion Reason Counts',
  '',
  ...Object.entries(summary.exclusionReasonCounts)
    .sort((a, b) => b[ 1 ] - a[ 1 ])
    .map(([ reason, count ]) => `- ${reason}: ${count}`),
  '',
  '## Example Exclusions',
  '',
  ...summary.excludedExamples.map(item => `- ${item.id}: ${item.name} | reasons: ${item.exclusionReasons.join(', ')}`),
  '',
].join('\n');

fs.writeFileSync(outputSubsetPath, JSON.stringify(subsetPayload, null, 2));
fs.writeFileSync(outputReportPath, JSON.stringify(summary, null, 2));
fs.writeFileSync(outputMarkdownPath, `${markdown}\n`);

console.log(JSON.stringify({
  outputSubsetPath,
  outputReportPath,
  outputMarkdownPath,
  counts: summary.counts,
  exclusionReasonCounts: summary.exclusionReasonCounts,
}, null, 2));
