import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveE2ePort, isE2ePortExplicit } from '../scripts/e2e/resolve-port.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Target selection (first match wins):
 *   PAGENEST_BASE_URL=https://host/path/  test an already running or deployed build (no server started)
 *   PAGENEST_TARGET=fixture               serve tests/fixtures/reference-app (harness self-check only)
 *   PAGENEST_NO_SERVER=1                  start no server (the browser-less unit project)
 *   default                               build the real app from the repo root and run `vite preview`
 *
 * Build policy (the app is built exactly once per run):
 *   locally (CI unset)   Playwright's webServer runs `npm run build` and then `vite preview`.
 *   in CI (CI=true)      the CI "Build" step already ran, so the webServer only runs `vite preview` and fails fast
 *                        if dist/ is missing. PAGENEST_SKIP_BUILD=1 forces this mode, PAGENEST_SKIP_BUILD=0 forces a build.
 *
 * Projects: webkit-iphone is skipped in CI unless PAGENEST_WEBKIT=1, because the CI job installs Chromium only.
 *
 * Service workers only run in production builds, so the real app is always built, never run with `vite dev`.
 */
const PORT = await resolveE2ePort('PAGENEST_PORT');
const external = process.env.PAGENEST_BASE_URL;
const useFixture = process.env.PAGENEST_TARGET === 'fixture';
const repoRoot = resolve(here, '..');
const skipBuild = process.env.PAGENEST_SKIP_BUILD ? process.env.PAGENEST_SKIP_BUILD === '1' : !!process.env.CI;
const includeWebkit = !process.env.CI || process.env.PAGENEST_WEBKIT === '1';

const rawBase = external ?? `http://127.0.0.1:${PORT}/`;
export const baseURL = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

if (!external && !useFixture && process.env.PAGENEST_NO_SERVER !== '1' && skipBuild && !existsSync(resolve(repoRoot, 'dist/index.html'))) {
  throw new Error('PAGENEST_SKIP_BUILD is active (or CI is set) but dist/index.html does not exist. Run `npm run build` at the repo root first.');
}

const webServer = external || process.env.PAGENEST_NO_SERVER === '1'
  ? undefined
  : useFixture
    ? {
        command: `node fixtures/serve.mjs fixtures/reference-app ${PORT}`,
        cwd: here,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      }
    : {
        command: `${skipBuild ? '' : 'VITE_PN_SEED_AUDIO=1 npm run build && '}node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${PORT}${isE2ePortExplicit('PAGENEST_PORT') ? ' --strictPort' : ''}`,
        cwd: repoRoot,
        url: baseURL,
        reuseExistingServer: false, // never test a stale server from another run (it could serve an old build): the port must be free
        timeout: 300_000,
      };

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'unit/**/*.spec.ts', 'perf/**/*.spec.ts', 'excellence/**/*.spec.ts'],
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'allow',
    actionTimeout: 8_000,
  },
  projects: [
    // Pure logic tests (no browser, no app): contrast maths and blueprint palette.
    { name: 'unit', testMatch: 'unit/**/*.spec.ts' },
    { name: 'chromium-desktop', testMatch: 'e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', testMatch: 'e2e/**/*.spec.ts', use: { ...devices['Pixel 7'] } },
    // Performance gates (budgets in perf/budgets.ts): Chromium mobile profile, CPU slowed to a mid-range phone.
    // Run alone for the steadiest numbers: `npm run test:perf` (one worker).
    { name: 'perf-chromium-mobile', testMatch: 'perf/**/*.spec.ts', fullyParallel: false, use: { ...devices['Pixel 7'] } },
    // Product excellence gates per screen (perf/budgets.ts "excellence"): Chromium phone profile (CLS needs Chromium).
    { name: 'excellence-chromium-mobile', testMatch: 'excellence/**/*.spec.ts', use: { ...devices['Pixel 7'] } },
    // WebKit stands in for Safari on iPhone. It is a proxy, not a replacement for the real-device checklist.
    ...(includeWebkit
      ? [{ name: 'webkit-iphone', testMatch: 'e2e/**/*.spec.ts', use: { ...devices['iPhone 14'] } }]
      : []),
  ],
  webServer,
});
