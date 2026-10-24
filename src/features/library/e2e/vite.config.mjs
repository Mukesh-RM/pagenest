// Builds the Library test page (index.html here) for the Playwright tests. Not part of the app build.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..', '..');

export default defineConfig({
  root: here,
  plugins: [
    react(),
    {
      // The test page has no service worker; the app's PWA plugin is not part of this build.
      name: 'library-e2e-no-pwa',
      resolveId: (id) => (id === 'virtual:pwa-register' ? '\0no-pwa-register' : undefined),
      load: (id) => (id === '\0no-pwa-register' ? 'export const registerSW = () => () => undefined;' : undefined),
    },
  ],
  resolve: { alias: { '@': resolve(root, 'src') } },
  worker: { format: 'es' },
  build: { outDir: resolve(root, 'dist-library-e2e'), emptyOutDir: true, target: 'es2022' },
  logLevel: 'warn',
});
