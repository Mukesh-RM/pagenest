// Tests for audit-all.mjs. Run: node --test scripts/audit-*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from './audit-all.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pn-all-'));
const capture = (argv) => {
  const out = [];
  const code = run(argv, { log: (s = '') => out.push(s), errLog: (s) => out.push(s) });
  return { code, out: out.join('\n') };
};
// child processes inherit stdio, so only the exit code and the summary are observable here
test('empty project: all four audits pass', () => {
  const r = capture(['--root', tmp()]);
  assert.equal(r.code, 0);
  assert.match(r.out, /ALL AUDITS PASSED/);
  assert.match(r.out, /licenses\s+PASS/);
  assert.match(r.out, /privacy\s+PASS/);
  assert.match(r.out, /models\s+PASS/);
  assert.match(r.out, /secrets\s+PASS/);
});

test('one failing audit fails the whole run and the others still run', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'a.ts'), "fetch('https://api.example.com/x');\n");
  const r = capture(['--root', root]);
  assert.equal(r.code, 1);
  assert.match(r.out, /privacy\s+FAIL/);
  assert.match(r.out, /licenses\s+PASS/);
  assert.match(r.out, /secrets\s+PASS/);
  assert.match(r.out, /AUDIT FAILED/);
});

test('unknown option is a usage error', () => {
  assert.equal(capture(['--bogus']).code, 2);
});

test('a blocked voice in src/ fails only the model audit', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'voices.ts'), "export const DEFAULT_VOICE = 'en_US-lessac-medium';\n");
  const r = capture(['--root', root]);
  assert.equal(r.code, 1);
  assert.match(r.out, /models\s+FAIL/);
  assert.match(r.out, /licenses\s+PASS/);
  assert.match(r.out, /privacy\s+PASS/);
});
