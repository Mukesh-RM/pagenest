// Builds the Library test page (index.html here) for the Playwright tests. Not part of the app build.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..', '..');

export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: { alias: { '@': resolve(root, 'src') } },
  build: { outDir: resolve(root, 'dist-library-e2e'), emptyOutDir: true, target: 'es2022' },
  logLevel: 'warn',
});
