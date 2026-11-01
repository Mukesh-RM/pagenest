#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ortDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ort');
if (!existsSync(ortDir)) {
  console.error('Missing public/ort — run node scripts/copy-ort-wasm.mjs before build.');
  process.exit(1);
}
const wasm = readdirSync(ortDir).filter((n) => n.endsWith('.wasm'));
if (wasm.length === 0) {
  console.error('public/ort has no .wasm files — Piper read-aloud will fail at runtime.');
  process.exit(1);
}
console.log(`OK: ${wasm.length} ORT wasm file(s) in public/ort`);
