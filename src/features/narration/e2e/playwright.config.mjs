import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveE2ePort } from '../../../../scripts/e2e/resolve-port.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
if (!process.env.PAGENEST_NARRATION_PORT) {
  process.env.PAGENEST_NARRATION_PORT = String(await resolveE2ePort('PAGENEST_NARRATION_PORT'));
}
const port = Number(process.env.PAGENEST_NARRATION_PORT);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  outputDir: resolve(root, 'test-results', 'narration'),
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `node src/features/narration/e2e/server.mjs ${port} dist`,
    cwd: root,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 600_000,
  },
});
