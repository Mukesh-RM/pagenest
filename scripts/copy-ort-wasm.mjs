#!/usr/bin/env node
/** Copy ONNX Runtime Web WASM files into public/ort for the Piper worker (self-hosted, Decision 8). */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pkgDir;
try {
  pkgDir = dirname(require.resolve('onnxruntime-web/package.json'));
} catch {
  console.warn('onnxruntime-web is not installed; skipping ORT WASM copy.');
  process.exit(0);
}
const src = join(pkgDir, 'dist');
const dest = join(root, 'public', 'ort');
mkdirSync(dest, { recursive: true });
for (const name of ['ort-wasm.wasm', 'ort-wasm-simd.wasm', 'ort-wasm-threaded.wasm', 'ort-wasm-simd-threaded.wasm']) {
  const from = join(src, name);
  if (existsSync(from)) cpSync(from, join(dest, name));
}
console.log(`Copied ORT wasm to ${dest}`);
