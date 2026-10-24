import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const here = fileURLToPath(new URL('.', import.meta.url));
const entryHtml = fileURLToPath(new URL('./index.html', import.meta.url));

/** Player Playwright harness: uses the repo Tailwind/PostCSS setup. */
export default defineConfig({
  root: workspaceRoot,
  envDir: workspaceRoot,
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(workspaceRoot, 'src'),
      'virtual:pwa-register': resolve(here, 'pwa-register-stub.ts'),
    },
  },
  build: {
    outDir: resolve(workspaceRoot, 'src/features/player/e2e/dist-e2e'),
    emptyOutDir: true,
    rollupOptions: {
      input: { playerE2e: entryHtml },
    },
  },
});
