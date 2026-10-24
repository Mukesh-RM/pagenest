#!/usr/bin/env node
// Turns the Playwright JSON report of the quality gates into a Markdown summary for the GitHub job summary.
//   node gates-summary.mjs [report.json ...]   (default: qa-reports/gates-excellence.json and gates-perf.json) >> "$GITHUB_STEP_SUMMARY"
// Always exits 0: it only reports. The job's own exit code decides whether the build fails.
import { existsSync, readFileSync } from 'node:fs';

const files = (process.argv.length > 2 ? process.argv.slice(2) : ['qa-reports/gates-excellence.json', 'qa-reports/gates-perf.json']).filter((f) => existsSync(f));
const enforced = process.env.QA_GATES_ENFORCED === '1';
const mark = enforced ? 'ENFORCED: any failure below fails the build.' : 'REPORT-ONLY: failures below do not fail the build until the repo variable QA_GATES_ENFORCED is set to 1.';
const lines = ['## Quality gates (product excellence and performance)', '', `_${mark}_`, ''];

if (files.length === 0) {
  lines.push('No gate report was written. The gates did not run to completion (missing build or browser setup failed). See the job log.');
  console.log(lines.join('\n'));
  process.exit(0);
}

const rows = [];
let passed = 0; let skipped = 0;
const strip = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');
function walk(suite, trail) {
  const here = suite.title && !suite.file ? [...trail, suite.title] : trail;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const status = t.status; // expected | unexpected | flaky | skipped
      if (status === 'expected') passed++;
      else if (status === 'skipped') skipped++;
      else {
        const err = strip(t.results?.at(-1)?.error?.message ?? '').split('\n').filter((l) => l.trim()).slice(0, 3).join(' ').slice(0, 300);
        rows.push({ project: t.projectName, title: [...here, spec.title].join(' › '), err });
      }
    }
  }
  for (const s of suite.suites ?? []) walk(s, here);
}
for (const f of files) for (const s of JSON.parse(readFileSync(f, 'utf8')).suites ?? []) walk(s, []);

lines.push(`**${passed} passed, ${rows.length} failed, ${skipped} skipped.**`, '');
if (rows.length) {
  lines.push('| Project | Gate | Error |', '|---|---|---|');
  for (const r of rows) lines.push(`| ${r.project} | ${r.title.replace(/\|/g, '\\|')} | ${r.err.replace(/\|/g, '\\|')} |`);
  lines.push('', 'Thresholds live in `tests/perf/budgets.ts`. Traces, screenshots and the HTML report are in the `quality-gates-reports` artifact.');
}
console.log(lines.join('\n'));
