import { describe, it, expect } from 'vitest';
import {
  getImportAdapterForDomain,
  getImportAdapterForUrl,
  normalizeImportText,
  stripImportLinksAndImages,
  stripImportMarkdownNoise,
} from '../../src/lib/import/adapters';

describe('normalizeImportText', () => {
  it('should normalize carriage returns', () => {
    expect(normalizeImportText('hello\r\nworld')).toBe('hello\nworld');
  });

  it('should normalize non-breaking spaces', () => {
    expect(normalizeImportText('hello\u00a0world')).toBe('hello world');
  });

  it('should normalize multiple spaces', () => {
    expect(normalizeImportText('hello    world')).toBe('hello world');
  });

  it('should collapse multiple newlines to double newline', () => {
    expect(normalizeImportText('line1\n\n\n\nline2')).toBe('line1\n\nline2');
  });

  it('should trim whitespace', () => {
    expect(normalizeImportText('  hello  ')).toBe('hello');
  });

  it('should handle empty or null', () => {
    expect(normalizeImportText('')).toBe('');
    expect(normalizeImportText(null as any)).toBe('');
  });
});

describe('stripImportLinksAndImages', () => {
  it('should strip markdown image syntax', () => {
    expect(stripImportLinksAndImages('hello ![alt](url) world')).toContain('hello');
    expect(stripImportLinksAndImages('hello ![alt](url) world')).toContain('world');
  });

  it('should extract link text and discard URL', () => {
    const result = stripImportLinksAndImages('hello [link text](url) world');
    expect(result).toContain('link text');
    expect(result).not.toContain('url');
  });

  it('should handle multiple links', () => {
    const result = stripImportLinksAndImages('[text1](url1) and [text2](url2)');
    expect(result).toContain('text1');
    expect(result).toContain('text2');
  });
});

describe('stripImportMarkdownNoise', () => {
  it('should remove images and links', () => {
    const result = stripImportMarkdownNoise('hello ![alt](url) [link](url) world');
    expect(result).toContain('hello');
    expect(result).toContain('world');
    expect(result).not.toContain('](');
  });

  it('should remove noisy page numbers', () => {
    // Patterns like "1 2 3 4 5" (when length > 8)
    const withNoise = 'recipe text 1 2 3 4 5 more text';
    const result = stripImportMarkdownNoise(withNoise);
    expect(result).toContain('recipe');
    expect(result).toContain('more');
  });
});

describe('getImportAdapterForDomain', () => {
  it('should find giallozafferano adapter', () => {
    const adapter = getImportAdapterForDomain('giallozafferano.it');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('giallozafferano.it');
  });

  it('should find ricetteperbimby adapter', () => {
    const adapter = getImportAdapterForDomain('ricetteperbimby.it');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('ricetteperbimby.it');
  });

  it('should find ricette-bimby.net adapter', () => {
    const adapter = getImportAdapterForDomain('ricette-bimby.net');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('ricette-bimby.net');
  });

  it('should find vegolosi.it adapter', () => {
    const adapter = getImportAdapterForDomain('vegolosi.it');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('vegolosi.it');
  });

  it('should return null for unknown domain', () => {
    const adapter = getImportAdapterForDomain('unknown-domain.com');
    expect(adapter).toBeNull();
  });
});

describe('getImportAdapterForUrl', () => {
  it('should match giallozafferano.it from URL', () => {
    const adapter = getImportAdapterForUrl('https://www.giallozafferano.it/ricette/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('giallozafferano.it');
  });

  it('should handle giallozafferano.com via canHandle', () => {
    const adapter = getImportAdapterForUrl('https://www.giallozafferano.com/ricette/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('giallozafferano.it');
  });

  it('should match ricetteperbimby.it', () => {
    const adapter = getImportAdapterForUrl('https://ricetteperbimby.it/ricetta/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('ricetteperbimby.it');
  });

  it('should match ricette-bimby.net', () => {
    const adapter = getImportAdapterForUrl('https://ricette-bimby.net/ricetta/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('ricette-bimby.net');
  });

  it('should match vegolosi.it', () => {
    const adapter = getImportAdapterForUrl('https://www.vegolosi.it/ricette/');
    expect(adapter).not.toBeNull();
    expect(adapter?.domain).toBe('vegolosi.it');
  });

  it('should return null for unknown domain', () => {
    const adapter = getImportAdapterForUrl('https://unknown-domain.com/recipe/');
    expect(adapter).toBeNull();
  });

  it('should prefer exact domain match over canHandle', () => {
    // GialloZafferano has both exact match and canHandle
    const adapter = getImportAdapterForUrl('https://www.giallozafferano.it/ricette/');
    expect(adapter?.domain).toBe('giallozafferano.it');
  });

  it('should handle URLs with protocol variations', () => {
    const adapter1 = getImportAdapterForUrl('http://giallozafferano.it/ricette/');
    const adapter2 = getImportAdapterForUrl('https://giallozafferano.it/ricette/');
    expect(adapter1).not.toBeNull();
    expect(adapter2).not.toBeNull();
  });
});
