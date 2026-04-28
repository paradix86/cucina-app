# Testing Guide

## Test suites

| Suite | Command | Speed | Network | CI role |
|---|---|---|---|---|
| Unit tests | `npm run test:unit` | Fast (~1s) | None | Blocking PR gate |
| Unit watch | `npm run test:watch` | Fast (HMR) | None | Development |
| Smoke tests | `npm run test:smoke` | ~2–3 min | Jina API | Weekly / on-demand |
| E2E tests | `npm run test:e2e` | Moderate | None (local) | On-demand / CI |
| E2E UI | `npm run test:e2e:ui` | Moderate | None | Development |

---

## Unit tests

Framework: **Vitest** (`vitest.config.ts`)

### Test files

| File | What it covers |
|---|---|
| `tests/unit/storage.test.ts` | Recipe normalization, ingredient parsing, shopping list grouping, section assignment |
| `tests/unit/import-adapters.test.ts` | Adapter selection, URL routing, text normalization, `canHandle()` fallback |
| `tests/unit/import-core.test.ts` | Domain normalization, source type detection |
| `tests/unit/import-structured-data.test.ts` | JSON-LD / Schema.org parsing, WPRM extraction, malformed data handling |
| `tests/unit/duemme-pack.test.ts` | Markdown → Recipe conversion for the built-in Duemme collection |
| `tests/unit/nutrition.test.ts` | Calculation engine, gram estimation, `scaleNutritionBlock` |
| `tests/unit/estimateGrams.test.ts` | `estimateGrams` unit conversions including ml/l density |
| `tests/unit/nutritionProviders.test.ts` | Provider matching and confidence scoring |
| `tests/unit/baseIngredientsProvider.test.ts` | Exact / starts-with / contains / safety / ordering for `base_ingredients` |
| `tests/unit/baseIngredientsEnrichment.test.ts` | Enrichment integration: base_ingredients + density + provider priority |
| `tests/unit/nutritionEnrichment.test.ts` | Multi-provider fallback and alias-query confidence boost |
| `tests/unit/ingredientMatching.test.ts` | `normalizeIngredientName`, alias table, `buildNutritionSearchQueries` |
| `tests/unit/nutritionOverride.test.ts` | `parseGramsInput` and `applyGramsOverrides` |
| `tests/unit/store-nutrition.test.ts` | Pinia store integration for nutrition data |
| `tests/unit/bimby-action-icons.test.ts` | Bimby closed icon set — guards against accidental expansion |

### Running

```bash
npm run test:unit          # single run (CI)
npm run test:watch         # watch mode (development)
npm run test:unit -- --ui  # optional Vitest UI
```

---

## Smoke tests

Runs the full import pipeline against real live URLs via Jina Reader.

**Config**: `vitest.smoke.config.ts`

```bash
npm run test:smoke
```

Requires internet access. Each test has a 30 s timeout. Expect ~2–3 min total.

**Do not run in a normal commit cycle** — it is too slow and network-dependent. Run it before/after touching the import pipeline or when a site import regression is reported.

### Sites covered

| Site | Import path | Last validated |
|---|---|---|
| `misya.info` | JSON-LD | 2026-04-17 |
| `fattoincasadabenedetta.it` | JSON-LD / WPRM | 2026-04-17 |
| `cucchiaio.it` | JSON-LD + control-char sanitization | 2026-04-17 |
| `vegolosi.it` | Named adapter | 2026-04-17 |
| `giallozafferano.it` | Named adapter | 2026-04-17 |

`ricetteperbimby.it` has a named adapter but is not in the suite — a stable recipe URL must be confirmed before adding it.

### CI

`.github/workflows/smoke.yml` runs every Monday at 07:00 UTC and can be triggered on demand. Uses `continue-on-error: true` — failures are visible in Actions but do not block PRs or deploys.

### Interpreting failures

| Error | Likely cause |
|---|---|
| `WEB_FETCH_404` | Recipe URL no longer exists — update the URL in the smoke file |
| `GZ_INGREDIENTS_NOT_FOUND` | GialloZafferano changed page layout |
| `VEGOLOSI_PARSE_INCOMPLETE` | Vegolosi changed heading structure |
| `JSONLD_NO_INGREDIENTS` | Site removed Schema.org markup |
| `UNSUPPORTED_WEB_IMPORT` | No adapter and no structured data found |
| Jina timeout / 5xx | Transient Jina proxy issue — re-run before investigating |

---

## E2E tests

Framework: **Playwright** (`playwright.config.ts`)

```bash
npm run test:e2e       # headless run
npm run test:e2e:ui    # interactive UI mode
```

### Test files

| File | What it covers |
|---|---|
| `tests/e2e/nutrition.spec.ts` | Complete / partial / missing / estimated / not-included / manual-override / porridge nutrition flows |

---

## Parser regression fixture policy

When a real recipe import bug requires parser logic changes, the fix must include:

1. The parser change
2. A minimal fixture that reproduces the failing structure
3. A test that prevents regression

**Exceptions** — no fixture required when failure is caused only by:
- Wrong or stale URL
- External site outage (404/500/down)
- Proxy/infrastructure outage unrelated to parser logic

**Fixture conventions:**
- Use compact inline fixtures for small logic cases
- Use dedicated fixture files only when they improve clarity or reuse
- Do not commit giant raw pages — keep only the minimal failing snippet

---

## Bimby icon closed-set rule

The Bimby step-icon action set is intentionally frozen:
`reverse`, `knead`, `scissors`, `cup`, `open`, `lock`

`tests/unit/bimby-action-icons.test.ts` is expected to fail if this set is widened without explicit product review and test updates.

---

## What is intentionally not unit-tested

- Vue component rendering — covered by Playwright E2E
- Full async import flows end-to-end — covered by smoke suite
- localStorage mock integration tests — covered by app-level flows
- Real file I/O (export/import) — needs full browser environment
