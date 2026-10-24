// Service worker and PWA shell e2e (owner: Shell and PWA). Run with `npm run test:e2e:sw`.
// Separate from /tests (QA) and from the root config so neither is touched.
import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const port = Number(process.env.PAGENEST_SW_PORT ?? 4392);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  outputDir: resolve(root, 'test-results', 'sw'),
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, serviceWorkers: 'allow', ...devices['Pixel 7'] },
  webServer: {
    command: `npm run build && node src/sw/e2e/server.mjs dist ${port}`,
    cwd: root,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
