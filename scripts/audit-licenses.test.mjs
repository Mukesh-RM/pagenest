// Tests for audit-licenses.mjs. Run: node --test scripts/audit-*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzePackages, collectPackages, declaredLicense, detectLicenseText, evaluateLicense, run } from './audit-licenses.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pn-lic-'));
const write = (root, rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
};
const capture = async (argv, opts = {}) => {
  const out = [];
  const err = [];
  const code = await run(argv, { log: (s = '') => out.push(s), errLog: (s) => err.push(s), ...opts });
  return { code, out: out.join('\n'), err: err.join('\n') };
};
const MIT_TEXT = 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software';

test('allowed licenses pass', () => {
  for (const l of ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0', '0BSD', 'Unlicense', 'Zlib', 'BlueOak-1.0.0', 'Python-2.0']) {
    assert.equal(evaluateLicense(l).status, 'ok', l);
  }
  assert.equal(evaluateLicense('MPL-2.0').status, 'note');
  assert.equal(evaluateLicense('OFL-1.1').status, 'note');
  assert.equal(evaluateLicense('CC-BY-4.0').status, 'note');
  assert.equal(evaluateLicense('Apache 2.0').status, 'ok');
});

test('copyleft, unknown and proprietary licenses are violations', () => {
  const cases = { 'GPL-3.0': /GPL/, 'GPL-2.0-only': /GPL/, 'AGPL-3.0-or-later': /AGPL/, 'LGPL-2.1': /LGPL/, 'SSPL-1.0': /SSPL/, 'CC-BY-NC-4.0': /non-commercial/, UNLICENSED: /UNLICENSED/, 'SEE LICENSE IN LICENSE.txt': /custom/, Weird: /unknown/ };
  for (const [l, re] of Object.entries(cases)) {
    const r = evaluateLicense(l);
    assert.equal(r.status, 'violation', l);
    assert.match(r.reason, re, l);
  }
  assert.equal(evaluateLicense('').status, 'violation');
  assert.equal(evaluateLicense(undefined).status, 'violation');
  assert.equal(evaluateLicense('GPL-2.0+').status, 'violation');
});

test('SPDX OR passes with one allowed choice, AND needs all', () => {
  assert.equal(evaluateLicense('(MIT OR GPL-3.0-or-later)').status, 'ok');
  assert.match(evaluateLicense('(MIT OR GPL-3.0-or-later)').reason, /Dual licensed/);
  assert.equal(evaluateLicense('GPL-2.0 OR LGPL-3.0').status, 'violation');
  assert.equal(evaluateLicense('MIT AND Apache-2.0').status, 'ok');
  assert.equal(evaluateLicense('MIT AND GPL-2.0').status, 'violation');
  assert.equal(evaluateLicense('(MIT AND (Apache-2.0 OR LGPL-2.1))').status, 'ok');
  assert.equal(evaluateLicense('MIT AND (GPL-3.0 OR AGPL-3.0)').status, 'violation');
  assert.equal(evaluateLicense('MPL-2.0 OR GPL-2.0').status, 'note');
  assert.equal(evaluateLicense('(MIT').status, 'violation'); // malformed
});

test('WITH exceptions: allowed base becomes a note, GPL stays a violation', () => {
  assert.equal(evaluateLicense('Apache-2.0 WITH LLVM-exception').status, 'note');
  assert.equal(evaluateLicense('GPL-2.0-only WITH Classpath-exception-2.0').status, 'violation');
});

test('declaredLicense understands legacy shapes', () => {
  assert.equal(declaredLicense({ license: 'MIT' }), 'MIT');
  assert.equal(declaredLicense({ license: { type: 'ISC', url: 'x' } }), 'ISC');
  assert.equal(declaredLicense({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] }), '(MIT OR Apache-2.0)');
  assert.equal(declaredLicense({}), undefined);
  assert.equal(declaredLicense(null), undefined);
});

test('detectLicenseText recognises common license files', () => {
  assert.equal(detectLicenseText(MIT_TEXT), 'MIT');
  assert.equal(detectLicenseText('Apache License\n Version 2.0, January 2004'), 'Apache-2.0');
  assert.equal(detectLicenseText('GNU GENERAL PUBLIC LICENSE Version 3'), 'GPL-3.0-only');
  assert.equal(detectLicenseText('GNU LESSER GENERAL PUBLIC LICENSE Version 3'), 'LGPL-3.0-only');
  assert.equal(detectLicenseText('Redistribution and use in source and binary forms ... Neither the name of'), 'BSD-3-Clause');
  assert.equal(detectLicenseText('something custom'), undefined);
});

test('repo without package.json: reports no dependencies yet and exits 0', async () => {
  const root = tmp();
  const r = await capture(['--root', root]);
  assert.equal(r.code, 0);
  assert.match(r.out, /no dependencies yet/i);
  const w = await capture(['--root', root, '--write']);
  assert.equal(w.code, 0);
  const doc = fs.readFileSync(path.join(root, 'docs', 'LICENSES.md'), 'utf8');
  assert.match(doc, /No dependencies yet/);
  assert.match(doc, /Piper voice models/);
  assert.match(doc, /\| Inter \(variable\)/);
  assert.match(doc, /Literata/);
});

test('package.json with no deps: no dependencies yet', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'x', version: '1.0.0' });
  const r = await capture(['--root', root]);
  assert.equal(r.code, 0);
  assert.match(r.out, /no dependencies yet/i);
});

test('node_modules scan: violations, scope, scoped and nested packages', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app', dependencies: { good: '1.0.0', '@scope/dual': '1.0.0', gplish: '1.0.0', 'no-field': '1.0.0' }, devDependencies: { 'dev-tool': '1.0.0', 'dev-gpl': '1.0.0' } });
  write(root, 'node_modules/good/package.json', { name: 'good', version: '1.0.0', license: 'MIT', dependencies: { child: '^1.0.0' } });
  write(root, 'node_modules/good/node_modules/child/package.json', { name: 'child', version: '1.2.3', license: 'ISC' });
  write(root, 'node_modules/@scope/dual/package.json', { name: '@scope/dual', version: '1.0.0', license: '(MIT OR GPL-3.0)' });
  write(root, 'node_modules/gplish/package.json', { name: 'gplish', version: '1.0.0', license: 'GPL-3.0-only' });
  write(root, 'node_modules/no-field/package.json', { name: 'no-field', version: '1.0.0' });
  write(root, 'node_modules/no-field/LICENSE', MIT_TEXT);
  write(root, 'node_modules/dev-tool/package.json', { name: 'dev-tool', version: '1.0.0', license: 'Apache-2.0' });
  write(root, 'node_modules/dev-gpl/package.json', { name: 'dev-gpl', version: '1.0.0', license: 'LGPL-3.0' });
  const { packages, mode } = collectPackages(root);
  assert.equal(mode, 'node_modules');
  const by = Object.fromEntries(packages.map((p) => [p.name, p]));
  assert.equal(by.good.scope, 'prod');
  assert.equal(by.child.scope, 'prod');
  assert.equal(by['dev-tool'].scope, 'dev');
  assert.equal(by['@scope/dual'].license, '(MIT OR GPL-3.0)');
  const rows = analyzePackages(packages);
  const st = Object.fromEntries(rows.map((r) => [r.name, r.status]));
  assert.equal(st.good, 'ok');
  assert.equal(st.child, 'ok');
  assert.equal(st['@scope/dual'], 'ok');
  assert.equal(st['no-field'], 'note'); // license detected from LICENSE file
  assert.equal(st.gplish, 'violation');
  assert.equal(st['dev-gpl'], 'violation');
  const r = await capture(['--root', root]);
  assert.equal(r.code, 1);
  assert.match(r.out, /\[prod\] gplish@1\.0\.0/);
  assert.match(r.out, /\[dev\] dev-gpl@1\.0\.0/);
  assert.match(r.out, /RESULT: FAIL/);
  assert.doesNotMatch(r.out, /\] good@/);
});

test('package-lock.json v3: uses lockfile license and dev flags without node_modules', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app', dependencies: { a: '1.0.0' }, devDependencies: { b: '1.0.0' } });
  write(root, 'package-lock.json', {
    name: 'app',
    lockfileVersion: 3,
    packages: {
      '': { name: 'app' },
      'node_modules/a': { version: '1.0.0', license: 'MIT', resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz' },
      'node_modules/a/node_modules/c': { version: '2.0.0', license: 'BSD-3-Clause' },
      'node_modules/b': { version: '1.0.0', dev: true, license: 'AGPL-3.0' },
      'node_modules/@s/d': { version: '3.0.0', dev: true, license: 'MIT' },
    },
  });
  const { packages } = collectPackages(root);
  assert.equal(packages.length, 4);
  assert.deepEqual(packages.map((p) => p.name).sort(), ['@s/d', 'a', 'b', 'c']);
  const r = await capture(['--root', root]);
  assert.equal(r.code, 1);
  assert.match(r.out, /\[dev\] b@1\.0\.0\s+license: AGPL-3\.0/);
});

test('declared but not installed: warns and fails as unknown', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app', dependencies: { react: '^18.0.0' } });
  const r = await capture(['--root', root]);
  assert.equal(r.code, 1);
  assert.match(r.out, /Run "npm ci"/);
  assert.match(r.out, /unknown/);
});

test('packages that hide GPL (eSpeak NG in WASM) are flagged despite a permissive license; reviewed override accepts', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app', dependencies: { phonemizer: '1.2.1' } });
  write(root, 'node_modules/phonemizer/package.json', { name: 'phonemizer', version: '1.2.1', license: 'Apache-2.0' });
  const r = await capture(['--root', root]);
  assert.equal(r.code, 1);
  assert.match(r.out, /hidden copyleft/);
  write(root, 'scripts/audit-license-overrides.json', { overrides: [{ name: 'phonemizer', version: '1.2.1', license: 'Apache-2.0', reason: 'owner accepted GPL notices, see DECISIONS.md' }] });
  const r2 = await capture(['--root', root]);
  assert.equal(r2.code, 0, 'a reviewed override accepts the hidden-copyleft package');
  assert.match(r2.out, /Reviewed override/);
});

test('override with a reviewed license downgrades a violation to a note', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app', dependencies: { odd: '1.0.0' } });
  write(root, 'node_modules/odd/package.json', { name: 'odd', version: '1.0.0', license: 'SEE LICENSE IN LICENSE.md' });
  assert.equal((await capture(['--root', root])).code, 1);
  write(root, 'scripts/audit-license-overrides.json', { overrides: [{ name: 'odd', version: '*', license: 'MIT', reason: 'read LICENSE.md by hand, plain MIT' }] });
  const r = await capture(['--root', root]);
  assert.equal(r.code, 0);
  assert.match(r.out, /NOTES/);
});

test('--write generates docs/LICENSES.md, --check detects staleness', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app', dependencies: { good: '1.0.0', 'pipe|name': '1.0.0' } });
  write(root, 'node_modules/good/package.json', { name: 'good', version: '1.0.0', license: 'MIT' });
  write(root, 'node_modules/pipe|name/package.json', { name: 'pipe|name', version: '1.0.0', license: 'ISC' });
  assert.equal((await capture(['--root', root, '--check'])).code, 1);
  assert.equal((await capture(['--root', root, '--write'])).code, 0);
  const doc = fs.readFileSync(path.join(root, 'docs', 'LICENSES.md'), 'utf8');
  assert.match(doc, /\| good \| 1\.0\.0 \| prod \| MIT \|/);
  assert.match(doc, /pipe\\\|name/);
  assert.match(doc, /Planned stack/);
  assert.equal((await capture(['--root', root, '--check'])).code, 0);
  write(root, 'node_modules/good/package.json', { name: 'good', version: '1.0.1', license: 'MIT' });
  assert.equal((await capture(['--root', root, '--check'])).code, 1);
});

test('installed package removes its planned row', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app', dependencies: { zustand: '5.0.0' } });
  write(root, 'node_modules/zustand/package.json', { name: 'zustand', version: '5.0.0', license: 'MIT' });
  await capture(['--root', root, '--write']);
  const doc = fs.readFileSync(path.join(root, 'docs', 'LICENSES.md'), 'utf8');
  assert.equal((doc.match(/\| zustand \|/g) || []).length, 1);
});

test('--registry looks up unknown licenses through an injected fetch (no network in tests)', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app', dependencies: { mystery: '1.0.0' } });
  write(root, 'package-lock.json', { lockfileVersion: 3, packages: { '': {}, 'node_modules/mystery': { version: '1.0.0' } } });
  assert.equal((await capture(['--root', root])).code, 1);
  const urls = [];
  const fetchFn = async (u) => {
    urls.push(u);
    return { ok: true, json: async () => ({ license: 'MIT' }) };
  };
  const r = await capture(['--root', root, '--registry'], { fetchFn });
  assert.equal(r.code, 0);
  assert.deepEqual(urls, ['https://registry.npmjs.org/mystery/1.0.0']);
});

test('--json prints parseable output', async () => {
  const root = tmp();
  const r = await capture(['--root', root, '--json']);
  const j = JSON.parse(r.out);
  assert.equal(j.packages, 0);
  assert.ok(Array.isArray(j.plannedRisks));
});

test('unknown option is a usage error', async () => {
  const r = await capture(['--nope']);
  assert.equal(r.code, 2);
});

test('generated doc contains the Speech engine licensing section', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app' });
  assert.equal((await capture(['--root', root, '--write'])).code, 0);
  const doc = fs.readFileSync(path.join(root, 'docs', 'LICENSES.md'), 'utf8');
  assert.match(doc, /## Speech engine licensing/);
  assert.match(doc, /eSpeak NG/);
  assert.match(doc, /Decision 8/);
});

test('tests/ QA toolchain is audited too (violations fail, doc has its table)', async () => {
  const root = tmp();
  write(root, 'package.json', { name: 'app' });
  write(root, 'tests/package.json', { name: 'qa', devDependencies: { bad: '1.0.0' } });
  write(root, 'tests/package-lock.json', { lockfileVersion: 3, packages: { '': {}, 'node_modules/bad': { version: '1.0.0', license: 'GPL-3.0', dev: true } } });
  const r = await capture(['--write'], { cwd: root });
  assert.equal(r.code, 1);
  assert.match(r.out, /bad@1\.0\.0/);
  assert.match(fs.readFileSync(path.join(root, 'docs', 'LICENSES.md'), 'utf8'), /QA toolchain \(tests\/, dev only\)/);
});
