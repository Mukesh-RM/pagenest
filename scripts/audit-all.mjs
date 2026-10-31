#!/usr/bin/env node
// Runs the four PageNest audits (licenses, privacy, models, secrets) and prints one summary.
//
//   node scripts/audit-all.mjs                run all three
//   node scripts/audit-all.mjs --history      also scan git history for secrets
//   node scripts/audit-all.mjs --strict       privacy warnings fail too
//   node scripts/audit-all.mjs --write        also regenerate docs/LICENSES.md
//   node scripts/audit-all.mjs --root DIR     audit another folder
//
// Suggested package.json script (Casey adds it): "audit": "node scripts/audit-all.mjs"
// Exit code: 0 all pass, 1 any audit failed, 2 usage or crash. Owner: Auditor.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SCRIPTS_DIR, isMain, parseArgs } from './audit-lib.mjs';

export function run(argv, { cwd = process.cwd(), log = console.log, errLog = console.error } = {}) {
  let args;
  try {
    args = parseArgs(argv, { root: 'string', history: 'bool', strict: 'bool', write: 'bool', check: 'bool', builtin: 'bool', help: 'bool' });
  } catch (e) {
    errLog(e.message);
    return 2;
  }
  if (args.help) {
    log('Usage: node scripts/audit-all.mjs [--root DIR] [--history] [--strict] [--write] [--check] [--builtin]');
    return 0;
  }
  const rootArgs = args.root ? ['--root', path.resolve(cwd, args.root)] : [];
  const jobs = [
    ['licenses', 'audit-licenses.mjs', [...rootArgs, '--check', ...(args.write ? ['--write'] : [])]],
    ['privacy', 'audit-privacy.mjs', [...rootArgs, ...(args.strict ? ['--strict'] : [])]],
    ['models', 'audit-models.mjs', [...rootArgs, ...(args.write ? ['--write'] : []), ...(args.check ? ['--check'] : [])]],
    ['secrets', 'audit-secrets.mjs', [...rootArgs, ...(args.history ? ['--history'] : []), ...(args.builtin ? ['--builtin'] : [])]],
  ];
  const results = [];
  for (const [name, file, a] of jobs) {
    log(`\n=== ${name} ${'='.repeat(60 - name.length)}`);
    const r = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, file), ...a], { cwd, stdio: 'inherit' });
    results.push([name, r.status === null ? 2 : r.status]);
  }
  log('\n=== summary ' + '='.repeat(54));
  for (const [n, c] of results) log(`  ${n.padEnd(9)} ${c === 0 ? 'PASS' : c === 1 ? 'FAIL' : 'ERROR'}`);
  const worst = Math.max(...results.map(([, c]) => c));
  log(worst === 0 ? '\nALL AUDITS PASSED' : '\nAUDIT FAILED');
  return worst;
}

if (isMain(import.meta.url)) process.exit(run(process.argv.slice(2)));
