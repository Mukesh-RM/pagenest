import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    // PWA (owner: Shell and PWA). The manifest is public/manifest.webmanifest, so the plugin does not generate one.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'prompt', // a new version waits; it never replaces the running one on its own
      injectRegister: false, // src/sw/register.ts registers the worker
      manifest: false,
      injectManifest: {
        rollupFormat: 'iife', // classic worker: works on every iOS and Firefox version that supports workers
        // App shell, icons and ONLY the Inter and Literata fonts (Decision 3). Other fonts are cached on first use.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}', '**/*[Ii]nter*.woff2', '**/*[Ll]iterata*.woff2'],
        globIgnores: ['**/_headers', '**/*.wasm', '**/*.map'],
        maximumFileSizeToCacheInBytes: 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // scripts/audit-*.test.mjs use node:test and run with `node --test`, not Vitest.
    exclude: [...configDefaults.exclude, 'scripts/**'],
    css: false,
  },
});
