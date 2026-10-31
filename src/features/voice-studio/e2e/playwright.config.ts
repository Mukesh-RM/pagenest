import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveE2ePort } from '@pagenest/e2e-port';

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(here, '../../../..');
const distDir = resolve(here, 'dist-e2e');
const PORT = await resolveE2ePort('PAGENEST_VOICE_STUDIO_PORT');
const indexPath = '/src/features/voice-studio/e2e/index.html';

export default defineConfig({
  testDir: here,
  testMatch: 'voice-studio.spec.ts',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${PORT}${indexPath.replace(/index\.html$/, '')}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx vite build -c ${resolve(here, 'vite.config.ts')} && node ${resolve(workspaceRoot, 'src/sw/e2e/server.mjs')} ${distDir} ${PORT}`,
    cwd: workspaceRoot,
    url: `http://127.0.0.1:${PORT}${indexPath}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
