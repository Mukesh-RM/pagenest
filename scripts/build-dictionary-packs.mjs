#!/usr/bin/env node
/** Copies curated dictionary packs into public/packs for optional download. */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/packs');
mkdirSync(out, { recursive: true });

const copies = [
  ['src/features/dictionary/fixtures/wordnet-en-mini.json', 'wordnet-en-core.json'],
  ['src/features/dictionary/fixtures/translate-en-hi-mini.json', 'translate-en-hi-lexicon.json'],
  ['public/packs/translate-en-es-lexicon.json', 'translate-en-es-lexicon.json'],
];

for (const [from, name] of copies) {
  copyFileSync(join(root, from), join(out, name));
}
console.log('Dictionary packs written to public/packs/');
