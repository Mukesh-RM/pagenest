#!/usr/bin/env node
/** Copy the minimal ORT WebAssembly build Piper uses (plain simd-threaded, no JSEP/asyncify). */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_MAX = 25 * 1024 * 1024;

/** Must match onnxruntime-web/wasm default backend (see node_modules/onnxruntime-web/dist/ort.wasm.mjs). */
const PIPER_ORT_ASSETS = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];

function resolveOrtDist() {
  const candidates = [join(root, 'node_modules', 'onnxruntime-web', 'dist')];
  try {
    const entry = dirname(require.resolve('onnxruntime-web'));
    candidates.unshift(entry);
    candidates.unshift(join(entry, 'dist'));
  } catch {
    /* not installed */
  }
  for (const dir of candidates) {
    if (existsSync(join(dir, PIPER_ORT_ASSETS[0]))) return dir;
  }
  console.warn('onnxruntime-web is not installed; skipping ORT WASM copy.');
  process.exit(0);
}

const src = resolveOrtDist();
const dest = join(root, 'public', 'ort');
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const name of PIPER_ORT_ASSETS) {
  const from = join(src, name);
  if (!existsSync(from)) {
    console.error(`Missing ${name} under ${src}`);
    process.exit(1);
  }
  const size = statSync(from).size;
  if (size > PAGES_MAX) {
    console.error(`${name} is ${(size / (1024 * 1024)).toFixed(2)} MiB (> 25 MiB Pages limit).`);
    process.exit(1);
  }
  cpSync(from, join(dest, name));
}
console.log(`Copied Piper ORT assets to ${dest}: ${PIPER_ORT_ASSETS.join(', ')}`);
