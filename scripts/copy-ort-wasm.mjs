#!/usr/bin/env node
/** Copy ONNX Runtime Web WASM (+ companion .mjs) into public/ort for Piper (self-hosted, Decision 8). */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function resolveOrtDist() {
  const candidates = [
    join(root, 'node_modules', 'onnxruntime-web', 'dist'),
  ];
  try {
    const entry = dirname(require.resolve('onnxruntime-web'));
    candidates.unshift(entry);
    candidates.unshift(join(entry, 'dist'));
  } catch {
    /* optional dependency path */
  }
  for (const dir of candidates) {
    if (existsSync(join(dir, 'ort-wasm-simd-threaded.wasm'))) return dir;
  }
  console.warn('onnxruntime-web is not installed; skipping ORT WASM copy.');
  process.exit(0);
}

const src = resolveOrtDist();
const dest = join(root, 'public', 'ort');
mkdirSync(dest, { recursive: true });

let copied = 0;
for (const name of readdirSync(src)) {
  if (!/^ort-wasm.*\.(wasm|mjs)$/.test(name)) continue;
  cpSync(join(src, name), join(dest, name));
  copied += 1;
}

if (copied === 0) {
  console.error(`No ort-wasm assets found under ${src}`);
  process.exit(1);
}
console.log(`Copied ${copied} ORT wasm/mjs file(s) to ${dest}`);
