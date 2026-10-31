#!/usr/bin/env node
/**
 * Production builds must not ship the review seed audiobook (no id, no fixture bytes in dist/).
 * Skipped when the build was made with VITE_PN_SEED_AUDIO=1 (Playwright / reviewer builds).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

if (process.env.VITE_PN_SEED_AUDIO === '1') {
  console.log('ok   seed check skipped (VITE_PN_SEED_AUDIO=1 build)');
  process.exit(0);
}

const dist = resolve(process.argv[2] ?? 'dist');
const needles = ['pn-review-seed-audiobook', 'pn-seed-audiobook-cc0', '01-opening.wav'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const hits = [];
for (const file of walk(dist)) {
  if (!/\.(js|mjs|css|html|json|webmanifest|map)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (text.includes(needle)) hits.push({ file, needle });
  }
}

if (hits.length > 0) {
  console.error('FAIL production dist contains review seed audiobook data:');
  for (const { file, needle } of hits) console.error(`  ${needle} in ${file}`);
  process.exit(1);
}

console.log('ok   production dist has no review seed audiobook strings');
