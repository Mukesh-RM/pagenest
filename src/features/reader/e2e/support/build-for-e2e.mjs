#!/usr/bin/env node
// Production build for reader e2e only (tsc + vite). Full `npm run build` also runs check-bundle.mjs.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');

function run(label, cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`[reader e2e] ${label} failed`);
    process.exit(r.status ?? 1);
  }
}

run('typecheck', 'npm', ['run', 'typecheck']);
run('vite build', 'npx', ['vite', 'build']);
