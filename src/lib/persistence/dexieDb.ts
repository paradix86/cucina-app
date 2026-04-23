import Dexie, { type Table } from 'dexie';
import type { Recipe, ShoppingItem, WeeklyPlanner } from '../../types';

export const DEXIE_DB_NAME = 'cucina-db';
export const DEXIE_MIGRATION_META_KEY = 'dexie_migrated';
export const WEEKLY_PLANNER_ROW_ID = 'current';

export type WeeklyPlannerRecord = {
  id: typeof WEEKLY_PLANNER_ROW_ID;
  plan: WeeklyPlanner;
};

export type MetaRecord<T = unknown> = {
  key: string;
  value: T;
};

export class CucinaDexieDb extends Dexie {
  recipes!: Table<Recipe, string>;
  shoppingItems!: Table<ShoppingItem, string>;
  weeklyPlanner!: Table<WeeklyPlannerRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = DEXIE_DB_NAME) {
    super(name);
    this.version(1).stores({
      recipes: 'id',
      shoppingItems: 'id',
      weeklyPlanner: 'id',
      meta: 'key',
    });
  }
}

export function isIndexedDbSupported(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}
