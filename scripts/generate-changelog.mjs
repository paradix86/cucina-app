#!/usr/bin/env node
// Generate CHANGELOG.md from src/lib/changelog.ts (the single source of truth).
//
// Run with Node 22+ which can strip TypeScript types natively:
//   node --no-warnings --experimental-strip-types scripts/generate-changelog.mjs
//   node --no-warnings --experimental-strip-types scripts/generate-changelog.mjs --check
//
// The two npm aliases are `npm run changelog` and `npm run changelog:check`.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const SOURCE_REL = 'src/lib/changelog.ts';
const SOURCE_PATH = join(REPO_ROOT, SOURCE_REL);
const OUT_PATH = join(REPO_ROOT, 'CHANGELOG.md');

const sourceUrl = pathToFileURL(SOURCE_PATH).href;
const { CHANGELOG } = await import(sourceUrl);

if (!Array.isArray(CHANGELOG)) {
  process.stderr.write(`✗ ${SOURCE_REL} did not export CHANGELOG as an array\n`);
  process.exit(2);
}

const HEADER = `# Changelog

All notable changes to cucina-app are documented in this file.

This file is **automatically generated** from \`${SOURCE_REL}\` —
do not edit by hand. To add a new release, update the TypeScript file
and run \`npm run changelog\`.

The format follows [Keep a Changelog](https://keepachangelog.com/) —
conventions adapted to the project's flat-string entry shape.
`;

function renderEntry(entry) {
  const heading = `## [v${entry.version}] - ${entry.date}`;
  const bullets = (entry.changes ?? []).map(c => `- ${c}`).join('\n');
  return `${heading}\n\n${bullets}\n`;
}

function render(entries) {
  return `${HEADER}\n${entries.map(renderEntry).join('\n')}`;
}

const expected = render(CHANGELOG);
const checkMode = process.argv.includes('--check');
const outRel = relative(REPO_ROOT, OUT_PATH).replace(/\\/g, '/');

if (checkMode) {
  let actual = '';
  try {
    actual = readFileSync(OUT_PATH, 'utf-8');
  } catch {
    // missing file → treated as out of sync
  }
  if (actual === expected) {
    process.stdout.write(`✓ ${outRel} matches ${SOURCE_REL}\n`);
    process.exit(0);
  }
  process.stderr.write(`✗ ${outRel} is out of sync with ${SOURCE_REL}.\n`);
  process.stderr.write(`  Run "npm run changelog" to regenerate, then commit both files.\n`);
  process.exit(1);
}

writeFileSync(OUT_PATH, expected, 'utf-8');
process.stdout.write(`✓ Wrote ${outRel} (${CHANGELOG.length} entries from ${SOURCE_REL})\n`);
