import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PAGENEST_PLAYER_PORT ?? 5199);

export default defineConfig({
  testDir: here,
  testMatch: 'player.spec.ts',
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx vite --config ${resolve(here, 'vite.config.ts')} --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: resolve(here, '../../..'),
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
