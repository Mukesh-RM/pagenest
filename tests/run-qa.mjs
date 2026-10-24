#!/usr/bin/env node
// The QA gates in one command. Every step always runs so one report shows all failures; the exit code is non-zero if
// ANY step failed (strict by default, also locally).
//
//   npm run qa                 all gates: stable + quality
//   npm run qa:stable          unit, e2e on the real app, Lighthouse   (BLOCKING in CI)
//   npm run qa:gates           product excellence + performance gates  (report-only in CI until QA_GATES_ENFORCED=1)
//
// Building: locally Playwright's webServer builds the app once. In CI (CI=true) the workflow builds once and every
// step reuses ./dist (see tests/README.md, "CI"). webkit-iphone runs locally, and in CI only with PAGENEST_WEBKIT=1.
//
// QA_GATES_ENFORCED is read by the CI workflow (repo variable) to decide whether the `qa:gates` job may fail the build.
// This script ignores it on purpose: it always exits non-zero when a gate fails.
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? 'all';
if (!['all', 'stable', 'gates'].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use: all | stable | gates`);
  process.exit(2);
}

const webkit = !process.env.CI || process.env.PAGENEST_WEBKIT === '1';
// The JSON reports feed the CI summary (gates-summary.mjs). They go to qa-reports/, not test-results/, because Playwright
// empties test-results/ at the start of every run. Gates never retry: a timing gate that passes on the second try is flaky.
const gatesEnv = (name) => ({ ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: `qa-reports/${name}.json` });
const reporter = process.env.CI ? '--reporter=list,html,json' : '--reporter=list,json';

const stable = [
  ['Playwright: unit, e2e on the real app, accessibility, offline', ['npx', 'playwright', 'test', '--project=unit', '--project=chromium-desktop', '--project=chromium-mobile', ...(webkit ? ['--project=webkit-iphone'] : [])], process.env],
  ['Lighthouse: PWA, accessibility, performance on every screen', ['npm', 'run', '--silent', 'lighthouse'], process.env],
];
// Two separate runs, so the timing-sensitive performance gates never share the machine with the excellence tests.
const gates = [
  ['Playwright: product excellence gates per screen', ['npx', 'playwright', 'test', '--project=excellence-chromium-mobile', '--retries=0', reporter], gatesEnv('gates-excellence')],
  ['Playwright: performance gates (one worker)', ['npx', 'playwright', 'test', '--project=perf-chromium-mobile', '--workers=1', '--retries=0', reporter], gatesEnv('gates-perf')],
];
const steps = mode === 'stable' ? stable : mode === 'gates' ? gates : [stable[0], ...gates, stable[1]];

let failed = 0;
const results = [];
for (const [name, cmd, env] of steps) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env });
  const ok = r.status === 0;
  if (!ok) failed++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} (exit ${r.status})`);
}
console.log(`\n=== QA summary (${mode}) ===\n${results.join('\n')}`);
process.exit(failed ? 1 : 0);
