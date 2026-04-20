#!/usr/bin/env node

/**
 * Offline pack-builder prototype for Ninja Test Kitchen search listings.
 *
 * Note:
 * This tool prepares draft data for editorial review.
 * It does NOT grant rights to reuse or redistribute third-party recipe content.
 *
 * Usage:
 *   node scripts/build-ninja-pack.mjs
 *   node scripts/build-ninja-pack.mjs --out tests/fixtures/ninja-urls.json
 *   node scripts/build-ninja-pack.mjs --with-details --limit 25 --out tmp/ninja-pack.json
 *   node scripts/build-ninja-pack.mjs --with-details --report-out tmp/ninja-pack.report.json
 */

const DEFAULT_LISTING_URL = 'https://ninjatestkitchen.eu/it/search/?_products=griglie-da-interno-ninja';
const DEFAULT_OUT = 'tmp/ninja-griglie-pack.json';
const DEFAULT_SOURCE_DOMAIN = 'ninjatestkitchen.eu';
const REVIEW_NOTICE = 'Draft extraction only. Review licensing/content rights before reuse or redistribution.';

function parseArgs(argv) {
  const args = {
    listingUrl: DEFAULT_LISTING_URL,
    out: DEFAULT_OUT,
    reportOut: '',
    withDetails: false,
    limit: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--listing-url' && argv[i + 1]) {
      args.listingUrl = argv[++i];
      continue;
    }
    if (token === '--out' && argv[i + 1]) {
      args.out = argv[++i];
      continue;
    }
    if (token === '--report-out' && argv[i + 1]) {
      args.reportOut = argv[++i];
      continue;
    }
    if (token === '--with-details') {
      args.withDetails = true;
      continue;
    }
    if (token === '--limit' && argv[i + 1]) {
      args.limit = Math.max(0, Number.parseInt(argv[++i], 10) || 0);
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log(`\nOffline Ninja pack-builder\n\nOptions:\n  --listing-url <url>   Search/filter listing URL (default: griglie listing)\n  --out <path>          Output JSON path (default: ${DEFAULT_OUT})\n  --report-out <path>   Report JSON path (default: <out>.report.json)\n  --with-details        Also fetch each recipe page and build draft recipe entries\n  --limit <n>           Limit number of URLs to process (0 = all)\n  --help                Show this help\n`);
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  return await res.text();
}

function extractFWPState(html) {
  const nonce = (html.match(/"nonce":"([a-f0-9]+)"/i) || [])[1] || '';
  const totalRows = Number((html.match(/"total_rows":(\d+)/) || [])[1] || 0);
  const totalPages = Number((html.match(/"total_pages":(\d+)/) || [])[1] || 1);

  if (!nonce || !totalPages) {
    throw new Error('Could not extract FacetWP nonce/pagination from listing HTML');
  }

  return { nonce, totalRows, totalPages };
}

function extractProductSlug(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('_products') || '';
  } catch {
    return '';
  }
}

async function fetchListingPageViaFacetApi({ page, nonce, listingUrl, productSlug }) {
  const payload = {
    action: 'facetwp_refresh',
    data: {
      facets: {
        recipe_category: [],
        cuisine: [],
        dietary: [],
        products: productSlug ? [productSlug] : [],
        search_term: '',
      },
      frozen_facets: {},
      http_params: {
        get: {
          ...(productSlug ? { _products: productSlug } : {}),
          _paged: String(page),
        },
        uri: 'it/search',
        url_vars: productSlug ? { products: [productSlug] } : {},
      },
      template: 'site_search',
      extras: {
        pager: true,
        selections: true,
        sort: 'default',
      },
      soft_refresh: 1,
      is_bfcache: 1,
      first_load: 0,
      paged: String(page),
      nonce,
    },
  };

  const res = await fetch('https://ninjatestkitchen.eu/it/wp-json/facetwp/v1/refresh', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      referer: `${listingUrl}${listingUrl.includes('?') ? '&' : '?'}_paged=${page}`,
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Facet refresh failed ${res.status} on page ${page}`);
  }

  return await res.json();
}

function extractRecipeUrlsFromTemplate(template) {
  const decoded = String(template || '').replaceAll('\\/', '/');
  const rx = /href=\"(https:\/\/ninjatestkitchen\.eu\/it\/recipe\/[^"]+)\"/g;
  return Array.from(decoded.matchAll(rx))
    .map(match => match[1].replace(/\/$/, ''));
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '-')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#176;/g, '°')
    .replace(/&#215;/g, 'x')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpace(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function mapCategorySignalToAppCategory(text) {
  const normalized = slugify(text).replace(/-/g, ' ');
  if (!normalized) return '';
  if (/bevand|drink|cocktail|succo|granita|sorbett/.test(normalized)) return 'Bevande';
  if (/primi|primo|pasta|riso|risotto|gnocchi|lasagn|cannelloni/.test(normalized)) return 'Primi';
  if (/secondi|secondo|carne|pesce|pollo|burger|polpett|arrost/.test(normalized)) return 'Secondi';
  if (/dolci|dolce|dessert|tort|biscott|gelat|muffin|plumcake|brownie|cheesecake/.test(normalized)) return 'Dolci';
  if (/antipast|bruschett|crostini|hummus|sfizi/.test(normalized)) return 'Antipasti';
  if (/zuppa|minestra|vellutat/.test(normalized)) return 'Zuppe';
  if (/sughi|salsa|condiment|ragu|pesto|besciamella/.test(normalized)) return 'Sughi';
  return '';
}

function inferEmoji(category) {
  switch (category) {
    case 'Primi': return '🍝';
    case 'Secondi': return '🍽️';
    case 'Dolci': return '🍰';
    case 'Antipasti': return '🥗';
    case 'Zuppe': return '🥣';
    case 'Sughi': return '🍅';
    case 'Bevande': return '🥤';
    default: return '🍴';
  }
}

function inferPreparationType(text) {
  const lower = normalizeSpace(text).toLowerCase();
  if (/\bbimby\b|thermomix|varoma|\bvel\.?\s*\d/.test(lower)) return 'bimby';
  if (/air\s*fryer|friggitrice\s+ad\s+aria|cestello/.test(lower)) return 'airfryer';
  return 'classic';
}

function sanitizeList(items) {
  return Array.from(
    new Set(
      (items || [])
        .map(item => normalizeSpace(item))
        .filter(Boolean),
    ),
  );
}

function parseMinutes(timeText) {
  const text = normalizeSpace(timeText).toLowerCase();
  const h = text.match(/(\d+)\s*h/);
  const m = text.match(/(\d+)\s*min/);
  const hours = h ? Number.parseInt(h[1], 10) : 0;
  const mins = m ? Number.parseInt(m[1], 10) : 0;
  return (hours * 60) + mins;
}

function normalizeServings(value) {
  const cleaned = normalizeSpace(value).replace(/\s*porzioni?\b/i, '').trim();
  const numeric = cleaned.match(/\d+(?:[.,]\d+)?/);
  return numeric ? numeric[0].replace(',', '.') : (cleaned || '4');
}

function extractFirst(html, pattern) {
  const match = String(html).match(pattern);
  return match ? stripTags(match[1]) : '';
}

function extractFirstRaw(html, pattern) {
  const match = String(html).match(pattern);
  return match ? String(match[1]) : '';
}

function extractAll(html, pattern) {
  return Array.from(String(html).matchAll(pattern))
    .map(match => stripTags(match[1]))
    .filter(Boolean);
}

function buildDraftRecipeFromHtml({ url, html }) {
  const name = extractFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || extractFirst(html, /<title>([\s\S]*?)<\/title>/i);

  const time = extractFirst(html, /single-method-overview__total-time[^>]*>([\s\S]*?)<\/span>/i);

  const servings = extractFirst(
    html,
    /<span[^>]*class="single-method-overview__key[^>]*>\s*Porzioni\s*<\/span>[\s\S]*?<span[^>]*class="single-method-overview__value[^>]*>([\s\S]*?)<\/span>/i,
  );

  const metricGroup = extractFirstRaw(
    html,
    /<div[^>]*class="single-ingredients__group"[^>]*data-unit="metric"[^>]*>([\s\S]*?)<div[^>]*class="single-ingredients__group"[^>]*data-unit="imperial"/i,
  );

  const ingredients = extractAll(metricGroup || html, /<li[^>]*>([\s\S]*?)<\/li>/gi)
    .map(item => item.replace(/^[-•]\s*/, '').trim())
    .filter(item => item && !/^Passo\s+\d+/i.test(item));

  const methodBlock = extractFirstRaw(html, /<ul[^>]*class="single-method__method"[^>]*>([\s\S]*?)<\/ul>/i);
  const steps = sanitizeList(extractAll(methodBlock || html, /<li[^>]*>([\s\S]*?)<\/li>/gi));
  const cleanIngredients = sanitizeList(ingredients);
  const category = mapCategorySignalToAppCategory(name);
  const preparationType = inferPreparationType(`${name}\n${steps.join('\n')}`);
  const slug = slugify(url.split('/recipe/')[1] || url);
  const normalized = {
    id: `ninja-${slug || 'recipe'}`,
    name: normalizeSpace(name),
    category,
    emoji: inferEmoji(category),
    time: normalizeSpace(time || 'n.d.'),
    servings: normalizeServings(servings || ''),
    difficolta: '',
    ingredients: cleanIngredients,
    steps,
    timerMinutes: parseMinutes(time),
    source: 'web',
    sourceDomain: DEFAULT_SOURCE_DOMAIN,
    url,
    preparationType,
    tags: ['Ninja Test Kitchen', 'offline-pack-draft'],
  };

  return normalized;
}

function evaluateQuality(recipe) {
  const errors = [];
  const warnings = [];

  const title = normalizeSpace(recipe.name);
  if (!title || title.length < 4) errors.push('TITLE_MISSING_OR_TOO_SHORT');
  if (title.length > 160) warnings.push('TITLE_UNUSUALLY_LONG');
  if (/^(search|ricette?|recipe)$/i.test(title)) errors.push('TITLE_GENERIC');

  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 2) {
    errors.push('INGREDIENTS_TOO_FEW');
  } else if (recipe.ingredients.length < 4) {
    warnings.push('INGREDIENTS_LOW_COUNT');
  }

  if (!Array.isArray(recipe.steps) || recipe.steps.length < 2) {
    errors.push('STEPS_TOO_FEW');
  } else if (recipe.steps.length < 3) {
    warnings.push('STEPS_LOW_COUNT');
  }

  if (!recipe.time || recipe.time === 'n.d.') warnings.push('TIME_MISSING');
  if (!recipe.servings) warnings.push('SERVINGS_MISSING');
  if ((recipe.steps || []).some(step => step.length > 520)) warnings.push('STEP_TEXT_VERY_LONG');
  if ((recipe.ingredients || []).some(item => item.length > 220)) warnings.push('INGREDIENT_TEXT_VERY_LONG');

  return {
    accepted: errors.length === 0,
    errors,
    warnings,
  };
}

function deriveReportPaths(outPath, explicitReportOut) {
  if (explicitReportOut) {
    return {
      reportJsonPath: explicitReportOut,
      reviewMdPath: explicitReportOut.replace(/\.json$/i, '.md'),
    };
  }
  return {
    reportJsonPath: outPath.replace(/\.json$/i, '.report.json'),
    reviewMdPath: outPath.replace(/\.json$/i, '.review.md'),
  };
}

function buildMarkdownReview(summary, accepted, skipped, outPath) {
  const lines = [];
  lines.push('# Ninja Offline Pack Review');
  lines.push('');
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Source listing: ${summary.sourceListing}`);
  lines.push(`- Output pack: ${outPath}`);
  lines.push(`- Notice: ${REVIEW_NOTICE}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Candidate URLs: ${summary.candidateUrlCount}`);
  lines.push(`- Accepted recipes: ${summary.acceptedCount}`);
  lines.push(`- Skipped recipes: ${summary.skippedCount}`);
  lines.push(`- Recipes with warnings: ${summary.warningRecipeCount}`);
  lines.push('');
  lines.push('## Accepted With Warnings');
  lines.push('');
  const warned = accepted.filter(entry => (entry.warnings || []).length > 0).slice(0, 30);
  if (!warned.length) {
    lines.push('- none');
  } else {
    warned.forEach(entry => {
      lines.push(`- ${entry.recipe.id}: ${entry.recipe.name} | warnings: ${(entry.warnings || []).join(', ')}`);
    });
  }
  lines.push('');
  lines.push('## Skipped');
  lines.push('');
  if (!skipped.length) {
    lines.push('- none');
  } else {
    skipped.slice(0, 50).forEach(entry => {
      lines.push(`- ${entry.url} | errors: ${(entry.errors || []).join(', ')}${entry.warnings?.length ? ` | warnings: ${entry.warnings.join(', ')}` : ''}`);
    });
  }
  return `${lines.join('\n')}\n`;
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const listingHtml = await fetchText(args.listingUrl);
  const { nonce, totalRows, totalPages } = extractFWPState(listingHtml);
  const productSlug = extractProductSlug(args.listingUrl);

  console.log(`Listing: ${args.listingUrl}`);
  console.log(`Facet state: rows=${totalRows}, pages=${totalPages}, product=${productSlug || '(none)'}`);

  const collectedUrls = [];
  for (let page = 1; page <= totalPages; page += 1) {
    const data = await fetchListingPageViaFacetApi({
      page,
      nonce,
      listingUrl: args.listingUrl,
      productSlug,
    });
    const urls = extractRecipeUrlsFromTemplate(data?.template || '');
    console.log(`Page ${page}/${totalPages}: ${urls.length} URLs`);
    collectedUrls.push(...urls);
  }

  const uniqueUrls = [...new Set(collectedUrls)];
  const finalUrls = args.limit > 0 ? uniqueUrls.slice(0, args.limit) : uniqueUrls;

  const output = {
    generatedAt: new Date().toISOString(),
    sourceListing: args.listingUrl,
    sourceProductSlug: productSlug,
    reviewNotice: REVIEW_NOTICE,
    facetRowsHint: totalRows,
    totalPages,
    extractedUrlCount: collectedUrls.length,
    uniqueUrlCount: uniqueUrls.length,
    urls: finalUrls,
  };

  if (args.withDetails) {
    const accepted = [];
    const skipped = [];
    const qualityStats = {
      acceptedCount: 0,
      skippedCount: 0,
      warningRecipeCount: 0,
      errorCounts: {},
      warningCounts: {},
    };

    for (let i = 0; i < finalUrls.length; i += 1) {
      const url = finalUrls[i];
      try {
        const html = await fetchText(url);
        const recipe = buildDraftRecipeFromHtml({ url, html });
        const quality = evaluateQuality(recipe);
        quality.errors.forEach(code => { qualityStats.errorCounts[code] = (qualityStats.errorCounts[code] || 0) + 1; });
        quality.warnings.forEach(code => { qualityStats.warningCounts[code] = (qualityStats.warningCounts[code] || 0) + 1; });

        if (!quality.accepted) {
          qualityStats.skippedCount += 1;
          skipped.push({
            url,
            id: recipe.id,
            title: recipe.name,
            errors: quality.errors,
            warnings: quality.warnings,
          });
          console.log(`Recipe ${i + 1}/${finalUrls.length}: skipped - ${recipe.name || url} (${quality.errors.join(', ')})`);
        } else {
          qualityStats.acceptedCount += 1;
          if (quality.warnings.length) qualityStats.warningRecipeCount += 1;
          accepted.push({
            recipe,
            warnings: quality.warnings,
          });
          console.log(`Recipe ${i + 1}/${finalUrls.length}: accepted - ${recipe.name || url}${quality.warnings.length ? ` [warnings: ${quality.warnings.join(', ')}]` : ''}`);
        }
      } catch (err) {
        qualityStats.skippedCount += 1;
        qualityStats.errorCounts.FETCH_OR_PARSE_ERROR = (qualityStats.errorCounts.FETCH_OR_PARSE_ERROR || 0) + 1;
        skipped.push({ url, errors: ['FETCH_OR_PARSE_ERROR'], warnings: [], detail: String(err) });
        console.log(`Recipe ${i + 1}/${finalUrls.length}: error - ${url}`);
      }
      await sleep(120);
    }

    output.recipes = accepted.map(entry => entry.recipe);
    output.skipped = skipped;
    output.quality = {
      gateVersion: 'ninja-v1',
      candidateUrlCount: finalUrls.length,
      acceptedCount: qualityStats.acceptedCount,
      skippedCount: qualityStats.skippedCount,
      warningRecipeCount: qualityStats.warningRecipeCount,
      errorCounts: qualityStats.errorCounts,
      warningCounts: qualityStats.warningCounts,
    };

    const report = {
      generatedAt: output.generatedAt,
      sourceListing: output.sourceListing,
      sourceProductSlug: output.sourceProductSlug,
      reviewNotice: REVIEW_NOTICE,
      quality: output.quality,
      accepted: accepted.map(entry => ({
        id: entry.recipe.id,
        url: entry.recipe.url,
        title: entry.recipe.name,
        warningCount: entry.warnings.length,
        warnings: entry.warnings,
        ingredientCount: entry.recipe.ingredients.length,
        stepCount: entry.recipe.steps.length,
        preparationType: entry.recipe.preparationType,
      })),
      skipped,
    };

    output.report = {
      reportJson: args.reportOut || '(derived from --out)',
      reviewMarkdown: '(derived from --out)',
    };

    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const outPath = path.resolve(process.cwd(), args.out);
    const { reportJsonPath, reviewMdPath } = deriveReportPaths(
      outPath,
      args.reportOut ? path.resolve(process.cwd(), args.reportOut) : '',
    );

    output.report.reportJson = reportJsonPath;
    output.report.reviewMarkdown = reviewMdPath;

    await fs.mkdir(path.dirname(reportJsonPath), { recursive: true });
    await fs.writeFile(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
    await fs.writeFile(reviewMdPath, buildMarkdownReview({
      generatedAt: output.generatedAt,
      sourceListing: output.sourceListing,
      candidateUrlCount: output.quality.candidateUrlCount,
      acceptedCount: output.quality.acceptedCount,
      skippedCount: output.quality.skippedCount,
      warningRecipeCount: output.quality.warningRecipeCount,
    }, accepted, skipped, outPath), 'utf8');
    console.log(`Wrote ${reportJsonPath}`);
    console.log(`Wrote ${reviewMdPath}`);
  }

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const outPath = path.resolve(process.cwd(), args.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Wrote ${outPath}`);
  console.log(`Unique URLs: ${uniqueUrls.length}`);
}

main().catch(err => {
  console.error('[build-ninja-pack] failed:', err.message || err);
  process.exitCode = 1;
});
