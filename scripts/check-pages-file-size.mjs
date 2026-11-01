#!/usr/bin/env node
/** Cloudflare Pages static asset limit (https://developers.cloudflare.com/pages/platform/limits/). */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 25 * 1024 * 1024;
const dist = join(process.cwd(), 'dist');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else out.push({ path, size: st.size });
  }
  return out;
}

const files = walk(dist);
const tooLarge = files.filter((f) => f.size > MAX_BYTES);
if (tooLarge.length) {
  console.error('Pages deploy limit: no file in dist/ may exceed 25 MiB.');
  for (const f of tooLarge) {
    console.error(`  ${(f.size / (1024 * 1024)).toFixed(2)} MiB  ${f.path.replace(dist, 'dist')}`);
  }
  process.exit(1);
}
console.log(`OK: ${files.length} dist file(s), all ≤ 25 MiB`);
