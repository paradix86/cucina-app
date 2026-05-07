import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../../src/lib/urlNormalize';

describe('normalizeUrl', () => {
  it('returns empty string for empty / non-string input', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('   ')).toBe('');
    expect(normalizeUrl(null as unknown as string)).toBe('');
    expect(normalizeUrl(undefined as unknown as string)).toBe('');
  });

  it('drops a single trailing slash on the path but keeps "/" as the root', () => {
    expect(normalizeUrl('https://site.com/recipe/')).toBe('https://site.com/recipe');
    expect(normalizeUrl('https://site.com/recipe')).toBe('https://site.com/recipe');
    // root keeps its slash
    expect(normalizeUrl('https://site.com/')).toBe('https://site.com/');
  });

  it('lowercases host and protocol', () => {
    expect(normalizeUrl('HTTPS://Site.COM/Recipe')).toBe('https://site.com/Recipe');
  });

  it('strips the fragment', () => {
    expect(normalizeUrl('https://site.com/recipe#instructions'))
      .toBe('https://site.com/recipe');
  });

  it('strips a single tracking param while keeping path-meaningful params', () => {
    expect(normalizeUrl('https://site.com/recipe?utm_source=newsletter'))
      .toBe('https://site.com/recipe');
    expect(normalizeUrl('https://site.com/recipe?id=42'))
      .toBe('https://site.com/recipe?id=42');
    expect(normalizeUrl('https://site.com/recipe?id=42&utm_source=x&fbclid=abc'))
      .toBe('https://site.com/recipe?id=42');
  });

  it('strips every tracking param in the allowlist', () => {
    const messy =
      'https://site.com/recipe?utm_source=a&utm_medium=b&utm_campaign=c'
      + '&utm_term=d&utm_content=e&fbclid=f&gclid=g&gclsrc=h&msclkid=i'
      + '&mc_cid=j&mc_eid=k&igshid=l&_ga=m&ref=n&ref_src=o';
    expect(normalizeUrl(messy)).toBe('https://site.com/recipe');
  });

  it('sorts surviving query params so order does not change equality', () => {
    expect(normalizeUrl('https://site.com/recipe?b=2&a=1'))
      .toBe(normalizeUrl('https://site.com/recipe?a=1&b=2'));
  });

  it('treats trailing-slash, fragment, host case, and tracking-param variants as equal', () => {
    const base = 'https://www.giallozafferano.it/ricetta/spaghetti-alla-carbonara';
    expect(normalizeUrl(`${base}/`)).toBe(normalizeUrl(base));
    expect(normalizeUrl(`${base}#ingredients`)).toBe(normalizeUrl(base));
    expect(normalizeUrl(base.replace('giallo', 'GIALLO'))).toBe(normalizeUrl(base));
    expect(normalizeUrl(`${base}?utm_source=x&fbclid=y`)).toBe(normalizeUrl(base));
  });

  it('returns a defensive lowercased value for unparseable input', () => {
    expect(normalizeUrl('  not-a-url  ')).toBe('not-a-url');
    expect(normalizeUrl('foo bar')).toBe('foobar');
  });
});
