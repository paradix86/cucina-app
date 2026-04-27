import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function safeGit(command) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const appVersion = String(packageJson.version || '0.0.0');
const appCommit = safeGit('git rev-parse --short HEAD') || 'dev';
const appBuildDate = safeGit('git show -s --format=%cd --date=format:%Y-%m-%d HEAD')
  || new Date().toISOString().slice(0, 10);
const appBuildId = `${appVersion}+${appCommit}`;

const swSource = readFileSync(new URL('./public/sw.js', import.meta.url), 'utf-8');
const cacheNameMatch = swSource.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
const swCacheName = cacheNameMatch ? cacheNameMatch[1] : 'cucina-vue-unknown';

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT__: JSON.stringify(appCommit),
    __APP_BUILD_DATE__: JSON.stringify(appBuildDate),
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
    __SW_CACHE_NAME__: JSON.stringify(swCacheName),
  },
  base: '/cucina-app/',
  server: {
    host: '0.0.0.0',
    port: 4173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
