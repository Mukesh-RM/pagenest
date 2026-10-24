import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'smoke.spec.ts',
  timeout: 300_000,
  use: {
    headless: true,
    channel: 'chromium',
  },
});
