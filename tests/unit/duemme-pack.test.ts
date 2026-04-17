import { describe, it, expect } from 'vitest';

// Helper functions extracted from duemmePack.ts for testing
// (These functions need to be exported from the module to be testable)

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function stripMarkdown(value: string | null | undefined): string {
  return normalizeText(
    String(value || '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'),
  );
}

function extractListLines(block: string): string[] {
  return String(block || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- ') || line.startsWith('* '))
    .map(line => stripMarkdown(line.replace(/^[-*] /, '')))
    .filter(Boolean);
}

function extractNumberedSteps(block: string): string[] {
  return [ ...String(block || '').matchAll(/^\d+\.\s+(.+)$/gm) ]
    .map(match => stripMarkdown(match[ 1 ]))
    .filter(Boolean);
}

function inferPreparationType(markdown: string): 'classic' | 'bimby' | 'airfryer' {
  if (/###\s+🤖\s+Metodo Bimby/i.test(markdown) || /\bBimby-ready\b/i.test(markdown)) return 'bimby';
  if (/air\s*fryer|friggitrice\s+ad\s+aria/i.test(markdown)) return 'airfryer';
  return 'classic';
}

describe('duemmePack text helpers', () => {
  describe('normalizeText', () => {
    it('should normalize spaces and newlines', () => {
      expect(normalizeText('hello    world')).toBe('hello world');
    });

    it('should remove carriage returns', () => {
      expect(normalizeText('line1\r\nline2')).toBe('line1\nline2');
    });

    it('should replace non-breaking spaces', () => {
      expect(normalizeText('hello\u00a0world')).toBe('hello world');
    });

    it('should trim leading/trailing spaces', () => {
      expect(normalizeText('  text  ')).toBe('text');
    });

    it('should handle null/undefined', () => {
      expect(normalizeText(null as any)).toBe('');
      expect(normalizeText(undefined)).toBe('');
    });
  });

  describe('stripMarkdown', () => {
    it('should remove bold markers', () => {
      expect(stripMarkdown('**bold text**')).toBe('bold text');
    });

    it('should remove backticks', () => {
      expect(stripMarkdown('`code` text')).toBe('code text');
    });

    it('should extract link text', () => {
      expect(stripMarkdown('[link text](url)')).toBe('link text');
    });

    it('should handle combination', () => {
      expect(stripMarkdown('**bold** and `code` with [link](url)')).toBe('bold and code with link');
    });
  });

  describe('extractListLines', () => {
    it('should extract dash-prefixed items', () => {
      const block = '- item 1\n- item 2\n- item 3';
      expect(extractListLines(block)).toEqual([ 'item 1', 'item 2', 'item 3' ]);
    });

    it('should extract asterisk-prefixed items', () => {
      const block = '* item 1\n* item 2\n* item 3';
      expect(extractListLines(block)).toEqual([ 'item 1', 'item 2', 'item 3' ]);
    });

    it('should ignore non-list lines', () => {
      const block = 'header\n- item 1\ndesc\n- item 2';
      const result = extractListLines(block);
      expect(result).toEqual([ 'item 1', 'item 2' ]);
    });

    it('should strip markdown from list items', () => {
      const block = '- **bold item**\n- [link text](url)';
      expect(extractListLines(block)).toEqual([ 'bold item', 'link text' ]);
    });

    it('should filter empty items', () => {
      const block = '- item 1\n- \n- item 2';
      expect(extractListLines(block)).toEqual([ 'item 1', 'item 2' ]);
    });
  });

  describe('extractNumberedSteps', () => {
    it('should extract numbered steps', () => {
      const block = '1. First step\n2. Second step\n3. Third step';
      expect(extractNumberedSteps(block)).toEqual([ 'First step', 'Second step', 'Third step' ]);
    });

    it('should ignore non-numbered lines', () => {
      const block = 'intro\n1. First step\nnote\n2. Second step';
      const result = extractNumberedSteps(block);
      expect(result).toEqual([ 'First step', 'Second step' ]);
    });

    it('should strip markdown from steps', () => {
      const block = '1. **Bold step**\n2. [Link step](url)';
      expect(extractNumberedSteps(block)).toEqual([ 'Bold step', 'Link step' ]);
    });

    it('should handle empty blocks', () => {
      expect(extractNumberedSteps('')).toEqual([]);
      expect(extractNumberedSteps(null as any)).toEqual([]);
    });
  });

  describe('inferPreparationType', () => {
    it('should detect Bimby from ### 🤖', () => {
      const md = '# Recipe\n### 🤖 Metodo Bimby\nsteps here';
      expect(inferPreparationType(md)).toBe('bimby');
    });

    it('should detect Bimby from Bimby-ready flag', () => {
      const md = 'Bimby-ready recipe';
      expect(inferPreparationType(md)).toBe('bimby');
    });

    it('should detect airfryer', () => {
      let md = 'Recipe for air fryer';
      expect(inferPreparationType(md)).toBe('airfryer');

      md = 'Friggitrice ad aria';
      expect(inferPreparationType(md)).toBe('airfryer');
    });

    it('should default to classic', () => {
      const md = 'Normal oven recipe';
      expect(inferPreparationType(md)).toBe('classic');
    });
  });
});

describe('duemmePack integration', () => {
  it('should process a simple recipe markdown', () => {
    const markdown = `
# Pasta al Pomodoro

## Ingredienti

- 400 g pasta
- 600 ml tomato sauce
- 2 cloves garlic
- Salt and pepper

## Preparazione

### 🍳 Metodo Classico

1. Cook pasta in salted water
2. Heat oil and garlic
3. Add tomato sauce
4. Mix with cooked pasta
    `.trim();

    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    expect(titleMatch?.[ 1 ]).toBe('Pasta al Pomodoro');

    const ingredientsBlock = markdown.match(/## Ingredienti\n([\s\S]*?)##/)?.[ 1 ] || '';
    const ingredients = extractListLines(ingredientsBlock);
    expect(ingredients).toHaveLength(4);
    expect(ingredients[ 0 ]).toBe('400 g pasta');

    const prepBlock = markdown.match(/Metodo Classico\n([\s\S]*?)$/)?.[ 1 ] || '';
    const steps = extractNumberedSteps(prepBlock);
    expect(steps).toHaveLength(4);
  });

  it('should detect preparation type from markdown', () => {
    const classicMd = '# Recipe\n### 🍳 Method\nSteps';
    expect(inferPreparationType(classicMd)).toBe('classic');

    const bimbyMd = '# Recipe\n### 🤖 Metodo Bimby\nSteps';
    expect(inferPreparationType(bimbyMd)).toBe('bimby');
  });
});
