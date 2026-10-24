import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/** Minimal Vite app for player Playwright flows (Audio-owned). */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('../../../', import.meta.url)) },
  },
  build: {
    outDir: 'dist-e2e',
    emptyOutDir: true,
  },
});
