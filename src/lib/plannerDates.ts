import { PLANNER_DAYS } from './planner';
import type { PlannerDayId } from '../types';

export function getMondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayIndex = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayIndex);
  return d;
}

export function getWeekDates(anchor: Date): Record<PlannerDayId, Date> {
  const monday = getMondayOf(anchor);
  const result = {} as Record<PlannerDayId, Date>;
  PLANNER_DAYS.forEach((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result[day] = d;
  });
  return result;
}

export function formatDayShort(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatWeekRange(start: Date, end: Date, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (typeof fmt.formatRange === 'function') {
    return fmt.formatRange(start, end);
  }
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
