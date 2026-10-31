// Reader e2e (owner: Reader). Run with `npm run test:e2e:reader` (sets a free port per run).
// Runs the production build under the production CSP (see support/server.mjs).
import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveE2ePort } from '../../../../scripts/e2e/resolve-port.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const port = process.env.PN_READER_E2E_PORT
  ? Number(process.env.PN_READER_E2E_PORT)
  : await resolveE2ePort('PAGENEST_READER_PORT');
const baseURL = process.env.PN_READER_E2E_BASE_URL ?? `http://127.0.0.1:${port}/`;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  outputDir: resolve(root, 'test-results', 'reader'),
  timeout: 120_000,
  workers: 2,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL, serviceWorkers: 'allow', trace: 'retain-on-failure' },
  projects: [
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node src/features/reader/e2e/support/build-for-e2e.mjs && node src/features/reader/e2e/support/launch-server.mjs`,
    cwd: root,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 600_000,
  },
});
