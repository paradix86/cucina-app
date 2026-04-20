#!/usr/bin/env node
/**
 * Offline Duemme pack review builder.
 *
 * Source: https://github.com/duemme/piano_alimentare (MIT at time of integration).
 * This script is for offline/admin review and subset preparation before importing
 * into the app recipe book. Reuse/redistribution of third-party content should
 * still be reviewed for your distribution context.
 *
 * Usage:
 *   node scripts/build-duemme-pack.mjs
 *   node scripts/build-duemme-pack.mjs --out tmp/duemme-pack-draft.json
 *   node scripts/build-duemme-pack.mjs --subset-out tmp/duemme-pack-vetted-subset.json
 *   node scripts/build-duemme-pack.mjs --report-out tmp/duemme-pack-review.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SOURCE_DIR = 'src/content/duemme/ricette';
const DEFAULT_OUT = 'tmp/duemme-pack-draft.json';
const DEFAULT_SUBSET_OUT = 'tmp/duemme-pack-vetted-subset.json';
const DEFAULT_REPORT_OUT = 'tmp/duemme-pack-review.json';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--source-dir') args.sourceDir = argv[++i];
    else if (token === '--out') args.out = argv[++i];
    else if (token === '--subset-out') args.subsetOut = argv[++i];
    else if (token === '--report-out') args.reportOut = argv[++i];
    else if (token === '--limit') args.limit = Number(argv[++i] || 0);
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function printHelp() {
  console.log(`Duemme offline pack builder

Options:
  --source-dir <path>  Source markdown root (default: ${DEFAULT_SOURCE_DIR})
  --out <path>         Draft pack output path (default: ${DEFAULT_OUT})
  --subset-out <path>  Vetted subset output path (default: ${DEFAULT_SUBSET_OUT})
  --report-out <path>  Review report output path (default: ${DEFAULT_REPORT_OUT})
  --limit <n>          Limit processed markdown files (0 = all)
  --help               Show this help
`);
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function stripMarkdown(value) {
  return normalizeText(
    String(value || '')
      .replace(/!\[[^\]]*]\([^)]*\)/g, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/^#+\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'),
  );
}

function parseBlock(markdown, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`(?:^|\\n)##\\s+${escaped}(?:[^\\n]*)\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i'));
  return match ? match[1].trim() : '';
}

function extractListLines(block) {
  return String(block || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
    .map(line => stripMarkdown(line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '')))
    .filter(Boolean);
}

function extractNumberedSteps(block) {
  const lines = String(block || '').split('\n');
  const steps = [];
  let current = '';
  lines.forEach(rawLine => {
    const line = rawLine.replace(/\r/g, '').trim();
    if (!line) return;
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      if (current) steps.push(stripMarkdown(current));
      current = numbered[1];
      return;
    }
    if (!current) return;
    if (/^###\s+/.test(line)) return;
    if (/^[-*•]\s+/.test(line)) {
      current += ` ${line.replace(/^[-*•]\s+/, '')}`;
      return;
    }
    if (/^[A-Za-zÀ-ÿ0-9]/.test(line)) current += ` ${line}`;
  });
  if (current) steps.push(stripMarkdown(current));
  return steps.filter(Boolean);
}

function inferPreparationType(markdown) {
  if (/\*\*Compatibilit[aà]\*\*:\s*.*(?:🤖|bimby)/i.test(markdown)) return 'bimby';
  if (/###\s+.*(?:🤖|bimby|tm31|tm5|tm6)/i.test(markdown) || /\bBimby-ready\b/i.test(markdown)) return 'bimby';
  if (/air\s*fryer|friggitrice\s+ad\s+aria/i.test(markdown)) return 'airfryer';
  return 'classic';
}

function extractPreparationSection(preparationBlock, type) {
  const pattern = type === 'bimby'
    ? /###\s+.*(?:🤖|bimby|tm31|tm5|tm6)[\s\S]*?(?=\n###\s+|$)/i
    : /###\s+.*(?:🍳|tradizionale|classico|classica|forno|padella)[\s\S]*?(?=\n###\s+|$)/i;
  return (preparationBlock.match(pattern) || [])[0] || '';
}

function normalizeBimbyStep(step) {
  const raw = stripMarkdown(step);
  const strongTag = raw.match(/^([^:]+):\s*(\d+\s*(?:sec|min))\s*\/\s*vel(?:ocit[àa])?\s*([0-9]+(?:\.[0-9]+)?)\s*$/i);
  if (strongTag) return `Vel. ${strongTag[3]} · ${strongTag[2]} — ${strongTag[1]}`;

  const timeMatch = raw.match(/(\d+\s*(?:sec|min))/i);
  const speedMatch = raw.match(/\bvel(?:ocit[àa])?\.?\s*([0-9]+(?:\.[0-9]+)?)/i);
  const tempMatch = raw.match(/(\d{2,3})\s*°\s*c?/i);
  if (!timeMatch && !speedMatch && !tempMatch) return raw;

  const tags = [];
  if (tempMatch) tags.push(`Temp. ${tempMatch[1]}°`);
  if (speedMatch) tags.push(`Vel. ${speedMatch[1]}`);
  if (timeMatch) tags.push(timeMatch[1].replace(/\s+/g, ' ').trim());

  const instruction = raw
    .replace(/\d+\s*(?:sec|min)/i, '')
    .replace(/\bvel(?:ocit[àa])?\.?\s*[0-9]+(?:\.[0-9]+)?/i, '')
    .replace(/\d{2,3}\s*°\s*c?/i, '')
    .replace(/^[,;:\-\s]+/, '')
    .trim();
  return instruction ? `${tags.join(' · ')} — ${instruction}` : raw;
}

function parseDuemmeRecipe(filePath, markdown) {
  const rel = filePath.replace(/\\/g, '/');
  const pathMatch = rel.match(/ricette\/([^/]+)\/([^/]+)\.md$/);
  if (!pathMatch) return null;

  const folder = pathMatch[1];
  const slug = pathMatch[2];
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (!titleMatch) return null;

  const categoryMatch = markdown.match(/\*\*Categoria\*\*:\s*([^\n]+)/i);
  const timeMatch = markdown.match(/\*\*Tempo preparazione\*\*:\s*([^\n]+)/i);
  const servingsMatch = markdown.match(/\*\*Porzioni\*\*:\s*([^\n]+)/i);
  const difficultyMatch = markdown.match(/\*\*Difficoltà\*\*:\s*([^\n]+)/i);

  const ingredientsBlock = parseBlock(markdown, 'Ingredienti');
  const preparationBlock = parseBlock(markdown, 'Preparazione');
  const bimbySection = extractPreparationSection(preparationBlock, 'bimby');
  const classicSection = extractPreparationSection(preparationBlock, 'classic');
  const preparationType = inferPreparationType(markdown);
  const ingredients = extractListLines(ingredientsBlock);

  let sectionUsed = 'full';
  let stepSource = preparationBlock;
  if (preparationType === 'bimby' && bimbySection) {
    sectionUsed = 'bimby';
    stepSource = bimbySection;
  } else if (classicSection) {
    sectionUsed = 'classic';
    stepSource = classicSection;
  } else if (bimbySection) {
    sectionUsed = 'bimby';
    stepSource = bimbySection;
  }

  const rawSteps = extractNumberedSteps(stepSource);
  const steps = (preparationType === 'bimby' ? rawSteps.map(normalizeBimbyStep) : rawSteps).filter(Boolean);

  const warnings = [];
  if (sectionUsed === 'full') warnings.push('DUEMME_FALLBACK_SECTION_USED');
  if (!ingredients.length) warnings.push('DUEMME_INGREDIENTS_MISSING');
  if (!steps.length) warnings.push('DUEMME_STEPS_MISSING');
  if (ingredients.length > 0 && ingredients.length < 4) warnings.push('DUEMME_LOW_INGREDIENT_COUNT');
  if (steps.length > 0 && steps.length < 3) warnings.push('DUEMME_LOW_STEP_COUNT');

  const scoreDeductions = {
    DUEMME_FALLBACK_SECTION_USED: 8,
    DUEMME_INGREDIENTS_MISSING: 35,
    DUEMME_STEPS_MISSING: 35,
    DUEMME_LOW_INGREDIENT_COUNT: 10,
    DUEMME_LOW_STEP_COUNT: 10,
  };
  const score = Math.max(0, warnings.reduce((acc, warning) => acc - (scoreDeductions[warning] || 0), 100));
  const accepted = Boolean(titleMatch && ingredients.length >= 3 && steps.length >= 2);
  const subsetCandidate = accepted
    && score >= 82
    && !warnings.includes('DUEMME_FALLBACK_SECTION_USED')
    && !warnings.includes('DUEMME_LOW_INGREDIENT_COUNT')
    && !warnings.includes('DUEMME_LOW_STEP_COUNT');

  const timerMatch = String(timeMatch?.[1] || '').match(/(\d+)\s*min/i);
  const folderTagMap = {
    colazioni: 'Colazioni',
    pranzi: 'Pranzi',
    cene: 'Cene',
    spuntini: 'Spuntini',
  };
  const folderMealOccasionMap = {
    colazioni: ['Colazione'],
    pranzi: ['Pranzo'],
    cene: ['Cena'],
    spuntini: ['Spuntino'],
  };

  const recipe = {
    id: `duemme-${folder}-${slug}`,
    name: stripMarkdown(titleMatch[1]),
    category: stripMarkdown(categoryMatch?.[1] || folderTagMap[folder] || ''),
    emoji: preparationType === 'bimby' ? '🤖' : '🍴',
    time: stripMarkdown(timeMatch?.[1] || ''),
    servings: stripMarkdown(servingsMatch?.[1] || '1').replace(/\s*\(.+\)\s*$/, '').trim(),
    difficolta: stripMarkdown(difficultyMatch?.[1] || ''),
    ingredients,
    steps,
    timerMinutes: timerMatch ? Number(timerMatch[1]) : 0,
    source: 'web',
    sourceDomain: 'github.com',
    preparationType,
    bimby: preparationType === 'bimby',
    tags: Array.from(new Set([
      'Piano Alimentare',
      'duemme/piano_alimentare',
      folderTagMap[folder] || folder,
      preparationType === 'bimby' ? 'Bimby' : (preparationType === 'airfryer' ? 'Air Fryer' : 'Classiche'),
    ])),
    mealOccasion: folderMealOccasionMap[folder] || [],
  };

  return {
    filePath: rel,
    accepted,
    subsetCandidate,
    score,
    warnings,
    sectionUsed,
    recipe,
  };
}

async function walkMarkdown(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(full)));
      continue;
    }
    if (entry.isFile() && full.endsWith('.md')) files.push(full);
  }
  return files.sort();
}

async function ensureDirFor(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  const sourceDir = args.sourceDir || DEFAULT_SOURCE_DIR;
  const outPath = args.out || DEFAULT_OUT;
  const subsetOutPath = args.subsetOut || DEFAULT_SUBSET_OUT;
  const reportOutPath = args.reportOut || DEFAULT_REPORT_OUT;
  const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 0;

  const markdownFiles = await walkMarkdown(sourceDir);
  const inputFiles = limit ? markdownFiles.slice(0, limit) : markdownFiles;
  const rows = [];
  for (const filePath of inputFiles) {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = parseDuemmeRecipe(filePath, raw);
    if (parsed) rows.push(parsed);
  }

  const acceptedRows = rows.filter(row => row.accepted);
  const subsetRows = acceptedRows.filter(row => row.subsetCandidate);
  const skippedRows = rows.filter(row => !row.accepted);

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceDir,
    totalMarkdownFiles: markdownFiles.length,
    processedMarkdownFiles: inputFiles.length,
    acceptedRecipes: acceptedRows.length,
    vettedSubsetCandidates: subsetRows.length,
    skippedRecipes: skippedRows.length,
    totalWarnings: rows.reduce((acc, row) => acc + row.warnings.length, 0),
    warningCounts: rows.flatMap(row => row.warnings).reduce((acc, warning) => {
      acc[warning] = (acc[warning] || 0) + 1;
      return acc;
    }, {}),
  };

  const draftPack = acceptedRows.map(row => row.recipe);
  const vettedSubset = subsetRows.map(row => row.recipe);
  const reviewReport = {
    summary,
    accepted: acceptedRows.map(row => ({
      id: row.recipe.id,
      name: row.recipe.name,
      score: row.score,
      sectionUsed: row.sectionUsed,
      warnings: row.warnings,
      filePath: row.filePath,
    })),
    skipped: skippedRows.map(row => ({
      filePath: row.filePath,
      score: row.score,
      warnings: row.warnings,
    })),
    subsetCandidates: subsetRows.map(row => ({
      id: row.recipe.id,
      name: row.recipe.name,
      score: row.score,
      filePath: row.filePath,
    })),
  };

  await ensureDirFor(outPath);
  await ensureDirFor(subsetOutPath);
  await ensureDirFor(reportOutPath);
  await fs.writeFile(outPath, `${JSON.stringify(draftPack, null, 2)}\n`);
  await fs.writeFile(subsetOutPath, `${JSON.stringify(vettedSubset, null, 2)}\n`);
  await fs.writeFile(reportOutPath, `${JSON.stringify(reviewReport, null, 2)}\n`);

  console.log('Duemme pack hardening run complete');
  console.log(`- processed: ${summary.processedMarkdownFiles}`);
  console.log(`- accepted: ${summary.acceptedRecipes}`);
  console.log(`- subset candidates: ${summary.vettedSubsetCandidates}`);
  console.log(`- skipped: ${summary.skippedRecipes}`);
  console.log(`- draft pack: ${outPath}`);
  console.log(`- vetted subset: ${subsetOutPath}`);
  console.log(`- report: ${reportOutPath}`);
}

main().catch(err => {
  console.error('[build-duemme-pack] failed:', err?.message || err);
  process.exit(1);
});
