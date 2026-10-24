// Library e2e (owner: Library). Run with `npm run test:e2e:library`. Builds a test page with the real
// screens and workers, then serves it. Separate from /tests (QA) and from the root config.
import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const port = Number(process.env.PAGENEST_LIBRARY_PORT ?? 4393);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: resolve(root, 'test-results', 'library'),
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, ...devices['Pixel 7'] },
  webServer: {
    command: `npx vite build -c src/features/library/e2e/vite.config.mjs && node src/sw/e2e/server.mjs dist-library-e2e ${port}`,
    cwd: root,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
