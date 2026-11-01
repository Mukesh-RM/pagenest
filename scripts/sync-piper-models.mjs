#!/usr/bin/env node
/**
 * Maintainer-only: download audit-OK Piper ONNX + config from pinned Hugging Face revision,
 * split ONNX into ≤24 MiB parts for Cloudflare Pages, write under public/models/piper/.
 *
 *   node scripts/sync-piper-models.mjs --out public/models/piper
 *
 * Do not run in CI. Do not commit generated .onnx parts to git unless your release process requires it.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(repoRoot, 'public/models/piper/manifest.json');
const HF_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve';

const outArg = process.argv.indexOf('--out');
const outRoot = outArg >= 0 ? resolve(process.argv[outArg + 1] ?? '') : join(repoRoot, 'public/models/piper');
if (!outRoot) {
  console.error('Usage: node scripts/sync-piper-models.mjs --out <directory>');
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const { revision, chunkBytes, voices } = manifest;
if (!revision || !chunkBytes || !voices) throw new Error('Invalid manifest.json');

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function writeParts(dir, voiceId, buf) {
  mkdirSync(dir, { recursive: true });
  let offset = 0;
  let part = 0;
  while (offset < buf.length) {
    const slice = buf.subarray(offset, offset + chunkBytes);
    const name = `${voiceId}.onnx.part${String(part).padStart(2, '0')}`;
    writeFileSync(join(dir, name), slice);
    offset += slice.length;
    part += 1;
  }
  return part;
}

async function main() {
  for (const [voiceId, meta] of Object.entries(voices)) {
    const base = `${HF_BASE}/${revision}/${meta.hfPath}`;
    const onnxUrl = `${base}/${voiceId}.onnx`;
    const cfgUrl = `${base}/${voiceId}.onnx.json`;
    console.log(`\n→ ${voiceId}`);
    const onnx = await download(onnxUrl);
    const hex = sha256(onnx);
    if (hex !== meta.sha256) {
      throw new Error(`${voiceId}: sha256 mismatch (got ${hex}, expected ${meta.sha256})`);
    }
    if (onnx.length !== meta.sizeBytes) {
      console.warn(`  size note: ${onnx.length} bytes (manifest ${meta.sizeBytes})`);
    }
    const cfg = await download(cfgUrl);
    const dest = join(outRoot, revision, meta.hfPath);
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, `${voiceId}.onnx.json`), cfg);
    const parts = writeParts(dest, voiceId, onnx);
    console.log(`  wrote ${parts} part(s) + config → ${dest}`);
  }
  writeFileSync(join(outRoot, 'manifest.json'), readFileSync(manifestPath));
  console.log('\nDone. Deploy public/models/piper with your Pages project (or upload the same tree to R2).');
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
