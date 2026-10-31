// Reader e2e (owner: Reader). Run with `npm run test:e2e:reader`. Separate from /tests (QA) and the root config.
// Runs the production build under the production CSP (see support/server.mjs).
import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveE2ePort } from '../../../../scripts/e2e/resolve-port.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const port = await resolveE2ePort('PAGENEST_READER_PORT');

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  outputDir: resolve(root, 'test-results', 'reader'),
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, serviceWorkers: 'allow', trace: 'retain-on-failure' },
  projects: [
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && node src/features/reader/e2e/support/server.mjs dist ${port}`,
    cwd: root,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env['CI'],
    timeout: 600_000,
  },
});
