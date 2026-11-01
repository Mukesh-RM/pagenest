#!/usr/bin/env node
// The QA gates in one command. Every step always runs so one report shows all failures; the exit code is non-zero if
// ANY step failed (strict by default, also locally).
//
//   npm run qa                 all gates: stable + quality
//   npm run qa:stable          unit, e2e on the real app, Lighthouse on every screen   (BLOCKING in CI)
//   npm run qa:gates           product excellence + performance gates + Lighthouse scenarios (250 books, first launch)  (report-only in CI until QA_GATES_ENFORCED=1)
//
// Building: locally Playwright's webServer builds the app once. In CI (CI=true) the workflow builds once and every
// step reuses ./dist (see tests/README.md, "CI"). webkit-iphone runs locally, and in CI only with PAGENEST_WEBKIT=1.
//
// QA_GATES_ENFORCED is read by the CI workflow (repo variable) to decide whether the `qa:gates` job may fail the build.
// This script ignores it on purpose: it always exits non-zero when a gate fails.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = resolve(repoRoot, 'tests');

const mode = process.argv[2] ?? 'all';
if (!['all', 'stable', 'gates'].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use: all | stable | gates`);
  process.exit(2);
}

const vitestStep =
  mode === 'gates' || process.env.CI
    ? []
    : [['Vitest (app unit tests)', ['npm', 'test'], { cwd: repoRoot, env: process.env }]];

const webkit = !process.env.CI || process.env.PAGENEST_WEBKIT === '1';
const e2eProjects = [
  '--project=unit',
  '--project=chromium-desktop',
  '--project=chromium-mobile',
  '--project=android-mobile',
  ...(webkit ? ['--project=webkit-iphone'] : []),
];
// The JSON reports feed the CI summary (gates-summary.mjs). They go to qa-reports/, not test-results/, because Playwright
// empties test-results/ at the start of every run. Gates never retry: a timing gate that passes on the second try is flaky.
const gatesEnv = (name) => ({ ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: `qa-reports/${name}.json` });
const reporter = process.env.CI ? '--reporter=list,html,json' : '--reporter=list,json';

const lighthouseScreens = [
  'Lighthouse: PWA, accessibility, performance on every screen',
  ['npm', 'run', '--silent', 'lighthouse', '--', '--scenarios', 'none'],
  { env: process.env },
];
const playwrightStable = [
  'Playwright: unit, e2e on the real app, accessibility, offline',
  ['npx', 'playwright', 'test', ...e2eProjects, ...(process.env.CI ? ['--workers=1'] : [])],
  { env: process.env },
];
const releaseSmokeProjects = [
  '--project=release-smoke-chromium',
  ...(webkit ? ['--project=release-smoke-webkit'] : []),
];
const releaseSmoke = [
  'Release smoke: import/open/reload/SW (Pixel + iPhone)',
  [
    'npx',
    'playwright',
    'test',
    'e2e/release-smoke.spec.ts',
    ...releaseSmokeProjects,
    '--workers=1',
    '--retries=0',
  ],
  { env: process.env, cwd: testsDir },
];
const upgradeSmoke = [
  'Release upgrade smoke (previous commit → HEAD)',
  ['node', 'scripts/release-upgrade-smoke.mjs'],
  { env: process.env, cwd: testsDir },
];
// Two separate Playwright runs so timing-sensitive performance gates never share the machine with excellence tests.
const lighthouseScenarios = [
  'Lighthouse scenarios: mid-size library and first launch',
  ['npm', 'run', '--silent', 'lighthouse', '--', '--scenarios', 'only'],
  { env: process.env },
];
const gates = [
  ['Playwright: product excellence gates per screen', ['npx', 'playwright', 'test', '--project=excellence-chromium-mobile', '--workers=1', '--retries=0', reporter], gatesEnv('gates-excellence')],
  ['Playwright: performance gates (one worker)', ['npx', 'playwright', 'test', '--project=perf-chromium-mobile', '--workers=1', '--retries=0', reporter], gatesEnv('gates-perf')],
  lighthouseScenarios,
];
// Lighthouse is CPU-sensitive: run every Lighthouse step before Playwright's parallel projects.
const core =
  mode === 'stable'
    ? [lighthouseScreens, releaseSmoke, playwrightStable]
    : mode === 'gates'
      ? gates
      : [lighthouseScenarios, lighthouseScreens, releaseSmoke, upgradeSmoke, ...gates.slice(0, -1), playwrightStable];
const steps = [...vitestStep, ...core];

let failed = 0;
const results = [];
for (const step of steps) {
  const [name, cmd, opts] = step;
  const env = opts?.env ?? process.env;
  const cwd = opts?.cwd;
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env, ...(cwd ? { cwd } : {}) });
  const ok = r.status === 0;
  if (!ok) failed++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} (exit ${r.status})`);
}
console.log(`\n=== QA summary (${mode}) ===\n${results.join('\n')}`);
process.exit(failed ? 1 : 0);
