#!/usr/bin/env node
// The whole QA gate in one command: Playwright (unit, e2e, accessibility, offline, excellence, performance) then Lighthouse.
// Every step always runs so one report shows all failures; the exit code is non-zero if ANY step failed.
//   npm run qa            from /tests (builds the app once through Playwright's webServer unless CI=true)
// In CI run `npm run build` at the repo root first (the webServer then skips its own build) and use this as the QA step.
import { spawnSync } from 'node:child_process';

const steps = [
  ['Playwright: unit, e2e, accessibility, offline', ['npx', 'playwright', 'test', '--project=unit', '--project=chromium-desktop', '--project=chromium-mobile', ...(process.env.CI && process.env.PAGENEST_WEBKIT !== '1' ? [] : ['--project=webkit-iphone'])]],
  ['Playwright: product excellence gates per screen', ['npx', 'playwright', 'test', '--project=excellence-chromium-mobile']],
  ['Playwright: performance gates (one worker)', ['npx', 'playwright', 'test', '--project=perf-chromium-mobile', '--workers=1']],
  ['Lighthouse: PWA, accessibility, performance', ['npm', 'run', '--silent', 'lighthouse']],
];

let failed = 0;
const results = [];
for (const [name, cmd] of steps) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env: process.env });
  const ok = r.status === 0;
  if (!ok) failed++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} (exit ${r.status})`);
}
console.log(`\n=== QA summary ===\n${results.join('\n')}`);
process.exit(failed ? 1 : 0);
