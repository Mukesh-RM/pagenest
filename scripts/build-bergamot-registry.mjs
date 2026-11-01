#!/usr/bin/env node
/** Writes a filtered Bergamot registry (full HTTPS URLs) for PageNest-supported language pairs. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/packs/bergamot-registry.json');
const REGISTRY_URL = 'https://bergamot.s3.amazonaws.com/models/index.json';

/** Pairs PageNest offers (CC-BY Firefox Translations / Bergamot sandbox). */
const BERGAMOT_PAIR_KEYS = [
  'enes',
  'esen',
  'ende',
  'deen',
  'enfr',
  'fren',
  'enru',
  'ruen',
  'encs',
  'csen',
  'enuk',
  'uken',
  'enet',
  'eten',
  'enit',
  'iten',
  'enpl',
  'plen',
  'enpt',
  'pten',
  'enbg',
  'bgen',
  'ennl',
  'nlen',
  'enfa',
  'faen',
  'enhi',
  'hien',
];

function main() {
  const gz = execFileSync('curl', ['-sL', REGISTRY_URL], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
  const full = JSON.parse(gunzipSync(gz).toString('utf8'));
  const slice = {};
  for (const key of BERGAMOT_PAIR_KEYS) {
    if (full[key]) slice[key] = full[key];
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(slice, null, 2)}\n`);
  const missing = BERGAMOT_PAIR_KEYS.filter((k) => !full[k]);
  if (missing.length) console.warn('Pairs not in upstream registry (lexicon-only fallback):', missing.join(', '));
  console.log(`Wrote ${out} (${Object.keys(slice).length} pairs)`);
}

main();
