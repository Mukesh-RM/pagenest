#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGES_MAX = 25 * 1024 * 1024;
const REQUIRED = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];
const ortDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ort');

if (!existsSync(ortDir)) {
  console.error('Missing public/ort — run node scripts/copy-ort-wasm.mjs before build.');
  process.exit(1);
}

const names = readdirSync(ortDir);
for (const name of names) {
  if (name.startsWith('.')) continue;
  if (!REQUIRED.includes(name)) {
    console.error(`Unexpected file in public/ort: ${name} (only ${REQUIRED.join(', ')} allowed).`);
    process.exit(1);
  }
  const size = statSync(join(ortDir, name)).size;
  if (size > PAGES_MAX) {
    console.error(`${name} exceeds 25 MiB Pages limit (${(size / (1024 * 1024)).toFixed(2)} MiB).`);
    process.exit(1);
  }
}
for (const req of REQUIRED) {
  if (!names.includes(req)) {
    console.error(`Missing public/ort/${req}`);
    process.exit(1);
  }
}
console.log('OK: Piper ORT wasm bundle present and within Pages size limit');
