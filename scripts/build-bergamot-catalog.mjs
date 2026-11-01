#!/usr/bin/env node
/** Regenerates translation pack sizes from public/packs/bergamot-registry.json */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(root, 'public/packs/bergamot-registry.json'), 'utf8'));

const LEXICON = {
  hi: { url: '/packs/translate-en-hi-lexicon.json', bytes: 36_400 },
  es: { url: '/packs/translate-en-es-lexicon.json', bytes: 34_800 },
};
const EMPTY_LEX = { url: '/packs/translate-lexicon-empty.json', bytes: 120 };

const NEURAL = [
  ['hi', []],
  ['es', ['enes', 'esen']],
  ['de', ['ende', 'deen']],
  ['fr', ['enfr', 'fren']],
  ['ru', ['enru', 'ruen']],
  ['cs', ['encs', 'csen']],
  ['uk', ['enuk', 'uken']],
  ['et', ['enet', 'eten']],
  ['it', ['enit', 'iten']],
  ['pt', ['enpt', 'pten']],
  ['bg', ['enbg', 'bgen']],
];

function sumKey(key) {
  const pair = registry[key];
  if (!pair) return 0;
  return Object.values(pair).reduce((a, f) => a + (f?.size ?? 0), 0);
}

const packs = NEURAL.map(([target, bergamotKeys]) => {
  const lex = LEXICON[target] ?? EMPTY_LEX;
  const neuralBytes = bergamotKeys.reduce((a, k) => a + sumKey(k), 0);
  return {
    id: `translate-en-${target}`,
    targetLang: target,
    bergamotKeys,
    lexiconUrl: lex.url,
    lexiconBytes: lex.bytes,
    sizeBytes: lex.bytes + neuralBytes,
  };
});

writeFileSync(
  join(root, 'src/engines/dictionary/bergamot/pack-sizes.generated.json'),
  `${JSON.stringify(packs, null, 2)}\n`,
);
console.log('Wrote pack-sizes.generated.json', packs.length, 'packs');
