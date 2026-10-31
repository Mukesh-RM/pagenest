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
        // Decision 15: the Reader's lazy engines are NOT precached (they are large). The service worker caches them at runtime, cache
        // first, the first time a book of that format opens (docs/DEPLOY.md). The import worker and the import parsers stay precached.
        globIgnores: [
          '**/_headers',
          '**/*.wasm',
          '**/*.map',
          '**/assets/engine-*.js',
          '**/assets/docx-core-*.js',
          '**/assets/docx.worker-*.js',
          '**/assets/piper.worker-*.js',
          '**/assets/engine-tts-*.js',
          '**/assets/engine-bergamot-*.js',
          '**/assets/pdf.worker*.mjs',
          '**/packs/**',
        ],
        maximumFileSizeToCacheInBytes: 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  // Workers are ES modules: the Library's import and search workers use dynamic import and nested workers.
  worker: { format: 'es' },
  // The entry used to evaluate as one ~100 ms task at 4x CPU (a long task). Vendor code in its own chunks is parsed and
  // compiled separately, which breaks that task up; the total first-load size is unchanged (they are modulepreloaded).
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        narrationE2e: fileURLToPath(new URL('./narration-e2e.html', import.meta.url)),
      },
      output: {
        manualChunks(id: string) {
          // Lazy engines get names the bundle check and the precache rules can recognise (Decision 15).
          // Vite's dynamic-import helper must not land inside a lazy engine chunk, or the entry would have to load it.
          if (id.includes('vite/preload-helper') || id.includes('vite/modulepreload-polyfill')) return 'vite-helpers';
          if (id.includes('node_modules/pdfjs-dist')) return 'engine-pdf';
          // MOBI, FB2 and comic books are separate lazy downloads: a plain reflowable book never loads them.
          if (/node_modules\/foliate-js\/(?:mobi|fb2|comic-book)\.js|node_modules\/foliate-js\/vendor\/fflate\.js/.test(id)) return 'engine-foliate-formats';
          if (id.includes('node_modules/foliate-js')) return 'engine-foliate';
          if (id.includes('node_modules/onnxruntime-web')) return 'engine-tts-ort';
          if (id.includes('@browsermt/bergamot-translator')) return 'engine-bergamot';
          if (id.includes('node_modules/react-dom')) return 'react-dom';
          if (id.includes('node_modules/dexie')) return 'dexie';
          if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run')) return 'router';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@pagenest/e2e-port': fileURLToPath(new URL('./scripts/e2e/resolve-port.mjs', import.meta.url)),
    },
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
