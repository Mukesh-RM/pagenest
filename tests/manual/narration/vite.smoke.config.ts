import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('../../../src', import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./smoke-harness.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'smoke-harness',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
