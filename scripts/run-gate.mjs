#!/usr/bin/env node
// Full PageNest quality gate from the repo root: Vitest, then tests/ QA (Playwright + Lighthouse).
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = resolve(repoRoot, 'tests');

const steps = [
  ['Vitest (app unit tests)', ['npm', 'test'], { cwd: repoRoot, env: process.env }],
  ['Full QA suite (Playwright projects + Lighthouse)', ['npm', 'run', '--silent', 'qa'], { cwd: testsDir, env: process.env }],
];

let failed = 0;
const results = [];
for (const [name, cmd, opts] of steps) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', ...opts });
  const ok = r.status === 0;
  if (!ok) failed++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} (exit ${r.status})`);
}
console.log(`\n=== gate summary ===\n${results.join('\n')}`);
process.exit(failed ? 1 : 0);
