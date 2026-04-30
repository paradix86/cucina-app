import { describe, it, expect } from 'vitest';
import { parseCookingProgress, COOKING_PERSIST_TTL_MS } from '../../src/lib/cookingPersistence';

const STEP_COUNT = 5;
const NOW = 1_746_000_000_000;
const FRESH = NOW - 1000;
const STALE = NOW - COOKING_PERSIST_TTL_MS - 1;

function encode(obj: unknown) {
  return JSON.stringify(obj);
}

describe('parseCookingProgress', () => {
  it('returns null for null input', () => {
    expect(parseCookingProgress(null, STEP_COUNT, NOW)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCookingProgress('', STEP_COUNT, NOW)).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseCookingProgress('{bad json', STEP_COUNT, NOW)).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseCookingProgress(encode(42), STEP_COUNT, NOW)).toBeNull();
    expect(parseCookingProgress(encode('hello'), STEP_COUNT, NOW)).toBeNull();
    expect(parseCookingProgress(encode(null), STEP_COUNT, NOW)).toBeNull();
  });

  it('returns null when updatedAt is stale', () => {
    const raw = encode({ stepIndex: 1, checklist: {}, updatedAt: STALE });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)).toBeNull();
  });

  it('accepts entry exactly at TTL boundary (not yet stale)', () => {
    const raw = encode({ stepIndex: 1, checklist: {}, updatedAt: NOW - COOKING_PERSIST_TTL_MS });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)).not.toBeNull();
  });

  it('returns null 1ms past TTL boundary', () => {
    const raw = encode({ stepIndex: 1, checklist: {}, updatedAt: NOW - COOKING_PERSIST_TTL_MS - 1 });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)).toBeNull();
  });

  it('treats missing updatedAt as safe (no expiry check)', () => {
    const raw = encode({ stepIndex: 2, checklist: {} });
    const result = parseCookingProgress(raw, STEP_COUNT, NOW);
    expect(result).not.toBeNull();
    expect(result?.stepIndex).toBe(2);
  });

  it('treats non-number updatedAt as safe', () => {
    const raw = encode({ stepIndex: 1, checklist: {}, updatedAt: 'yesterday' });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)).not.toBeNull();
  });

  it('restores stepIndex within valid range', () => {
    const raw = encode({ stepIndex: 3, checklist: {}, updatedAt: FRESH });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)?.stepIndex).toBe(3);
  });

  it('ignores stepIndex equal to stepCount (out of bounds)', () => {
    const raw = encode({ stepIndex: 5, checklist: {}, updatedAt: FRESH });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)?.stepIndex).toBeUndefined();
  });

  it('ignores negative stepIndex', () => {
    const raw = encode({ stepIndex: -1, checklist: {}, updatedAt: FRESH });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)?.stepIndex).toBeUndefined();
  });

  it('ignores non-number stepIndex', () => {
    const raw = encode({ stepIndex: '2', checklist: {}, updatedAt: FRESH });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)?.stepIndex).toBeUndefined();
  });

  it('restores checklist object', () => {
    const checklist = { '0': true, '2': true };
    const raw = encode({ stepIndex: 1, checklist, updatedAt: FRESH });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)?.checklist).toEqual(checklist);
  });

  it('ignores array checklist', () => {
    const raw = encode({ stepIndex: 1, checklist: [true, false], updatedAt: FRESH });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)?.checklist).toBeUndefined();
  });

  it('ignores null checklist', () => {
    const raw = encode({ stepIndex: 1, checklist: null, updatedAt: FRESH });
    expect(parseCookingProgress(raw, STEP_COUNT, NOW)?.checklist).toBeUndefined();
  });

  it('returns non-null result for valid entry with no restorable fields', () => {
    const raw = encode({ updatedAt: FRESH });
    const result = parseCookingProgress(raw, STEP_COUNT, NOW);
    expect(result).not.toBeNull();
    expect(result?.stepIndex).toBeUndefined();
    expect(result?.checklist).toBeUndefined();
  });
});
