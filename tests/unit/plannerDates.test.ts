import { describe, it, expect } from 'vitest';
import {
  getMondayOf,
  getWeekDates,
  formatDayShort,
  formatWeekRange,
} from '../../src/lib/plannerDates';

describe('getMondayOf', () => {
  it('returns the same day when input is a Monday', () => {
    const monday = new Date(2026, 4, 4); // 2026-05-04 (Mon)
    const result = getMondayOf(monday);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(4);
  });

  it('returns the previous Monday when input is a Sunday', () => {
    const sunday = new Date(2026, 4, 10); // 2026-05-10 (Sun)
    const result = getMondayOf(sunday);
    expect(result.getDate()).toBe(4);
    expect(result.getMonth()).toBe(4);
  });

  it('crosses a month boundary correctly', () => {
    const wed = new Date(2026, 4, 6); // 2026-05-06 (Wed) → Mon is 2026-05-04
    const result = getMondayOf(wed);
    expect(result.getDate()).toBe(4);
  });

  it('crosses a year boundary correctly', () => {
    const fri = new Date(2026, 0, 2); // 2026-01-02 (Fri) → Mon is 2025-12-29
    const result = getMondayOf(fri);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(29);
  });
});

describe('getWeekDates', () => {
  it('returns 7 dates Mon-Sun anchored on the Monday of the input week', () => {
    const wed = new Date(2026, 4, 6); // 2026-05-06 (Wed)
    const dates = getWeekDates(wed);
    expect(dates.monday.getDate()).toBe(4);
    expect(dates.tuesday.getDate()).toBe(5);
    expect(dates.wednesday.getDate()).toBe(6);
    expect(dates.thursday.getDate()).toBe(7);
    expect(dates.friday.getDate()).toBe(8);
    expect(dates.saturday.getDate()).toBe(9);
    expect(dates.sunday.getDate()).toBe(10);
  });
});

describe('formatDayShort', () => {
  it('formats day + short month for English', () => {
    const d = new Date(2026, 4, 4); // May 4, 2026
    const result = formatDayShort(d, 'en');
    expect(result).toMatch(/May/);
    expect(result).toMatch(/4/);
  });

  it('formats day + short month for Italian', () => {
    const d = new Date(2026, 4, 4);
    const result = formatDayShort(d, 'it');
    expect(result).toMatch(/mag/i);
    expect(result).toMatch(/4/);
  });
});

describe('formatWeekRange', () => {
  it('formats a same-month range', () => {
    const start = new Date(2026, 4, 4); // May 4
    const end = new Date(2026, 4, 10);  // May 10
    const result = formatWeekRange(start, end, 'en');
    expect(result).toMatch(/May/);
    expect(result).toMatch(/4/);
    expect(result).toMatch(/10/);
    expect(result).toMatch(/2026/);
  });

  it('formats a cross-month range with both months named', () => {
    const start = new Date(2026, 3, 27); // Apr 27
    const end = new Date(2026, 4, 3);    // May 3
    const result = formatWeekRange(start, end, 'en');
    expect(result).toMatch(/Apr/);
    expect(result).toMatch(/May/);
    expect(result).toMatch(/2026/);
  });

  it('formats a cross-year range with both years', () => {
    const start = new Date(2025, 11, 29); // Dec 29 2025
    const end = new Date(2026, 0, 4);     // Jan 4 2026
    const result = formatWeekRange(start, end, 'en');
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/2026/);
  });

  it('produces an Italian same-month range', () => {
    const start = new Date(2026, 4, 4);
    const end = new Date(2026, 4, 10);
    const result = formatWeekRange(start, end, 'it');
    expect(result).toMatch(/mag/i);
    expect(result).toMatch(/2026/);
  });
});
