# Storage Reference

Documents all persistence mechanisms used by Cucina App.

---

## Dexie (IndexedDB)

**Database name:** `cucina-db`

| Table | Key | Purpose |
|-------|-----|---------|
| `recipes` | `id` | Full recipe objects |
| `shoppingItems` | `id` | Shopping list items |
| `weeklyPlanner` | `id` | Weekly planner entries |
| `meta` | `key` | Internal migration flags |

**Meta key:** `dexie_migrated` — set after the one-time migration from the v3 localStorage recipe store.

Dexie is the source of truth for all collection data (recipes, shopping list, planner). Do not write collection data to localStorage.

---

## localStorage

All keys are exported from `src/lib/storageKeys.ts`. Never hardcode a key string at a call site.

| Constant | Key string | Owner | Purpose |
|----------|-----------|-------|---------|
| `STORAGE_KEY` | `cucina_recipebook_v3` | `storage.ts` | Legacy — used during migration to Dexie; checked on startup |
| `STORAGE_KEY_V2` | `cucina_ricettario_v2` | `storage.ts` | Legacy v2 key; read once for migration, then cleared |
| `SHOPPING_LIST_KEY` | `cucina_shopping_list_v1` | `stores/shoppingList.ts` | Fallback shopping list when Dexie is unavailable |
| `WEEKLY_PLANNER_KEY` | `cucina_weekly_planner_v1` | `stores/weeklyPlanner.ts` | Fallback weekly planner when Dexie is unavailable |
| `MEAL_COMPOSER_DRAFT_KEY` | `cucina_meal_composer_draft_v1` | `MealComposerView.vue` | Current meal composer draft |
| `MEAL_COMPOSER_LEGACY_DRAFT_KEY` | `cucina_meal_composer_draft` | `MealComposerView.vue` | Legacy draft key — read once on load, then migrated to v1 |
| `NUTRITION_GOALS_KEY` | `cucina_nutrition_goals_v1` | `nutritionGoals.ts` | User nutrition targets |
| `LANG_KEY` | `cucina_lang` | `i18n.ts` | Selected UI language |
| `GUIDE_CHECKS_KEY` | `cucina_guide_checks_v1` | `GuidesView.vue` | Meal prep guide checklist state |

### Dynamic cooking progress keys

Cooking progress uses a per-recipe key so each recipe's state is isolated:

```
cucina_cooking_<recipe.id>   (preferred — uses recipe id)
cucina_cooking_<recipe.name> (fallback — when id is absent)
cucina_cooking_default       (fallback — when both are absent)
```

Use `getCookingProgressKey(recipe)` from `src/lib/storageKeys.ts` to build this key. Never construct it inline.

---

## Rules for adding future keys

1. **Register in `storageKeys.ts` first.** Never write a key string directly at a call site.
2. **Use a versioned suffix** (`_v1`, `_v2`, …) for any key that stores structured data so a future schema change can introduce a new key without reading stale data.
3. **Settings and ephemeral state go to localStorage.** Collection data (lists, plans, recipes) belongs in Dexie.
4. **Never silently read a key that no longer exists.** Provide an explicit fallback or migration path.
5. **Document legacy keys.** If you retire a key, keep it in the table marked `(legacy)` until you are sure no existing client holds data in it.
6. **Keep migration logic in `storage.ts` or the relevant store.** Do not scatter migration reads across views.
7. **Changing a key string is a breaking change.** Old clients will lose their stored data. Prefer adding a new versioned key and migrating on load.
