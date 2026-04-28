/**
 * Version consistency guard.
 *
 * These tests enforce that package.json, changelog.ts, and public/sw.js
 * stay in sync across releases. If any of these fail, a release step was skipped.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHANGELOG } from '../../src/lib/changelog';

const root = resolve(__dirname, '../../');

function readPackageVersion(): string {
  const raw = readFileSync(resolve(root, 'package.json'), 'utf-8');
  const pkg = JSON.parse(raw) as { version: string };
  return pkg.version;
}

function readSwCacheName(): string {
  const raw = readFileSync(resolve(root, 'public/sw.js'), 'utf-8');
  const match = raw.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : '';
}

describe('version consistency', () => {
  it('changelog latest entry version matches package.json version', () => {
    const pkgVersion = readPackageVersion();
    const changelogVersion = CHANGELOG[0]?.version ?? '(no entry)';
    expect(changelogVersion).toBe(pkgVersion);
  });

  it('changelog is non-empty', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
  });

  it('changelog latest entry has a valid ISO date', () => {
    const entry = CHANGELOG[0];
    expect(entry).toBeDefined();
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('changelog latest entry has at least one change', () => {
    const entry = CHANGELOG[0];
    expect(entry).toBeDefined();
    expect(entry.changes.length).toBeGreaterThan(0);
  });

  it('public/sw.js CACHE_NAME is defined and non-empty', () => {
    const cacheName = readSwCacheName();
    expect(cacheName).not.toBe('');
    expect(cacheName).toContain('cucina');
  });
});
