// Library e2e against the REAL app (router, service worker, player, mini-player), not the Library's test page.
// Run: npx playwright test -c src/features/library/e2e/playwright-app.config.mjs
// Needs the audio player on the branch (features/player); builds the app first (vite build), then serves it.
import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const port = Number(process.env.PAGENEST_LIBRARY_APP_PORT ?? 4395);

export default defineConfig({
  testDir: '.',
  testMatch: 'audio-playback.spec.ts',
  outputDir: resolve(root, 'test-results', 'library-app'),
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    ...devices['Pixel 7'],
    // Autoplay is never used by the app (play comes from a tap); this only lets the test's own tap start the media pipeline.
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: `npx vite build && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: root,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: Boolean(process.env.PAGENEST_LIBRARY_APP_REUSE), // set to iterate against a server you started (vite preview)
    timeout: 300_000,
  },
});
