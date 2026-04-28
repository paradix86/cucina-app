/**
 * App metadata — source of truth is appMeta.js (build-time injected via vite.config.js).
 *
 * DO NOT add static version/date strings here.
 * The real values come from:
 *   - __APP_VERSION__    → package.json "version"
 *   - __APP_BUILD_DATE__ → git commit date (injected by vite.config.js at build time)
 *   - __APP_COMMIT__     → git short hash
 *   - __SW_CACHE_NAME__  → public/sw.js CACHE_NAME constant
 *
 * To release a new version:
 *   1. Bump "version" in package.json
 *   2. Prepend a new entry to src/lib/changelog.ts (version must match package.json)
 *   3. Bump CACHE_NAME in public/sw.js (triggers PWA update toast)
 *   4. Run: npm run build && npm run test:unit
 *
 * See src/lib/appMeta.js for the runtime module imported by components.
 */
