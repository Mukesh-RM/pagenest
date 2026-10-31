#!/usr/bin/env node
/**
 * Build a compressed WordNet 3.1 gloss pack (WNPK v1) for offline lookup.
 * Requires WordNet dict tarball (download if missing).
 *
 *   node scripts/build-wordnet-full-pack.mjs [--dict-tar /path/to/wn3.1.dict.tar.gz]
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createGunzip, gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/packs');
const WN_URL = 'https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz';

const POS = [
  ['index.noun', 'data.noun', 'n'],
  ['index.verb', 'data.verb', 'v'],
  ['index.adj', 'data.adj', 'a'],
  ['index.adv', 'data.adv', 'r'],
];

function posChar(pos) {
  return pos === 'a' ? 'j' : pos;
}

/** @param {string} dictDir */
function loadGlosses(dictDir) {
  /** @type {Map<number, string>} */
  const glossByOffset = new Map();
  for (const [, dataName] of POS) {
    const lines = readFileSync(join(dictDir, dataName), 'utf8').split('\n');
    for (const line of lines) {
      if (!line || line.startsWith('  ')) continue;
      const offset = Number.parseInt(line.slice(0, 8), 10);
      const bar = line.indexOf('|');
      if (bar === -1) continue;
      const gloss = line.slice(bar + 1).trim().replace(/;/g, '; ').slice(0, 512);
      if (gloss) glossByOffset.set(offset, gloss);
    }
  }
  return glossByOffset;
}

/** @param {string} dictDir @param {Map<number, string>} glossByOffset */
function loadEntries(dictDir, glossByOffset) {
  /** @type {Map<string, { pos: string, glosses: Set<string> }>} */
  const lemmas = new Map();
  for (const [indexName, , pos] of POS) {
    const lines = readFileSync(join(dictDir, indexName), 'utf8').split('\n');
    for (const line of lines) {
      if (!line || line.startsWith(' ')) continue;
      const parts = line.split(/\s+/);
      const lemma = parts[0]?.replace(/_/g, ' ').replace(/^['’]/, '').toLowerCase();
      if (!lemma) continue;
      const synsetCnt = Number.parseInt(parts[2] ?? '0', 10);
      const pCnt = Number.parseInt(parts[3] ?? '0', 10);
      const offStart = 4 + pCnt + 2;
      const offsets = parts.slice(offStart, offStart + synsetCnt);
      let row = lemmas.get(lemma);
      if (!row) {
        row = { pos: posChar(pos), glosses: new Set() };
        lemmas.set(lemma, row);
      }
      for (const off of offsets) {
        const g = glossByOffset.get(Number.parseInt(off, 10));
        if (g) row.glosses.add(g);
      }
    }
  }
  return [...lemmas.entries()]
    .filter(([, r]) => r.glosses.size > 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function encodePack(entries) {
  const dataParts = [];
  const index = [];
  let dataLen = 0;
  for (const [word, row] of entries) {
    const glosses = [...row.glosses].slice(0, 8);
    const blob = new TextEncoder().encode(`${row.pos}\n${glosses.join('\n')}`);
    index.push({ word, offset: dataLen, len: blob.length });
    dataParts.push(blob);
    dataLen += blob.length;
  }
  const indexRecords = [];
  for (const { word, offset, len } of index) {
    const w = new TextEncoder().encode(word);
    if (w.length > 255) continue;
    indexRecords.push(new Uint8Array([w.length, ...w, (offset >> 24) & 255, (offset >> 16) & 255, (offset >> 8) & 255, offset & 255, (len >> 8) & 255, len & 255]));
  }
  const indexFlat = Buffer.concat(indexRecords.map((u) => Buffer.from(u)));
  const dataFlat = Buffer.concat(dataParts.map((u) => Buffer.from(u)));
  const header = Buffer.alloc(32);
  header.write('WNPK', 0);
  header.writeUInt16LE(1, 4);
  header.writeUInt32LE(indexRecords.length, 8);
  header.writeUInt32LE(32, 12);
  header.writeUInt32LE(32 + indexFlat.length, 16);
  header.writeUInt32LE(indexFlat.length, 20);
  header.writeUInt32LE(dataFlat.length, 24);
  return Buffer.concat([header, indexFlat, dataFlat]);
}

async function main() {
  const tarArg = process.argv.find((a) => a.startsWith('--dict-tar='))?.split('=')[1];
  let tar = tarArg ?? join(root, '.cache/wn3.1.dict.tar.gz');
  mkdirSync(dirname(tar), { recursive: true });
  if (!existsSync(tar)) {
    console.log('Downloading WordNet 3.1 dict…');
    execFileSync('curl', ['-sL', WN_URL, '-o', tar], { stdio: 'inherit' });
  }
  const extractDir = join(root, '.cache/wn-dict');
  if (!existsSync(join(extractDir, 'dict/index.noun'))) {
    mkdirSync(extractDir, { recursive: true });
    execFileSync('tar', ['-xzf', tar, '-C', extractDir], { stdio: 'inherit' });
  }
  const dictDir = join(extractDir, 'dict');
  console.log('Parsing WordNet glosses…');
  const glossByOffset = loadGlosses(dictDir);
  const entries = loadEntries(dictDir, glossByOffset);
  console.log(`Lemma keys: ${entries.length}`);
  const raw = encodePack(entries);
  const gz = gzipSync(raw, { level: 9 });
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'wordnet-en-full.wnpk.gz');
  createWriteStream(outPath).end(gz);
  console.log(`Wrote ${outPath} (${(gz.length / 1000).toFixed(1)} kB gzip, ${(raw.length / 1e6).toFixed(2)} MB raw)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
