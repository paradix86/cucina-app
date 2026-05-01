import { describe, it, expect } from 'vitest';
import { getCookingProgressKey } from '../../src/lib/storageKeys';

describe('getCookingProgressKey', () => {
  it('uses recipe id when present', () => {
    expect(getCookingProgressKey({ id: 'abc123', name: 'Pasta' })).toBe('cucina_cooking_abc123');
  });

  it('falls back to name when id is absent', () => {
    expect(getCookingProgressKey({ name: 'Risotto' })).toBe('cucina_cooking_Risotto');
  });

  it('falls back to "default" when both id and name are absent', () => {
    expect(getCookingProgressKey({})).toBe('cucina_cooking_default');
  });

  it('falls back to "default" when id is empty string', () => {
    expect(getCookingProgressKey({ id: '', name: '' })).toBe('cucina_cooking_default');
  });

  it('prefers id over name when both present', () => {
    expect(getCookingProgressKey({ id: 'x1', name: 'should-not-appear' })).toBe('cucina_cooking_x1');
  });
});
