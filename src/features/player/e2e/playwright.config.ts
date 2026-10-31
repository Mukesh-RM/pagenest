import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveE2ePort, isE2ePortExplicit } from '@pagenest/e2e-port';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = await resolveE2ePort('PAGENEST_PLAYER_PORT');
const harnessPath = '/src/features/player/e2e/index.html';

export default defineConfig({
  testDir: here,
  testMatch: ['player.spec.ts', 'drive-mode.spec.ts'],
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}${harnessPath.replace(/index\.html$/, '')}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx vite --config ${resolve(here, 'vite.config.ts')} --host 127.0.0.1 --port ${PORT}${isE2ePortExplicit('PAGENEST_PLAYER_PORT') ? ' --strictPort' : ''}`,
    cwd: resolve(here, '../../..'),
    url: `http://127.0.0.1:${PORT}${harnessPath}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
