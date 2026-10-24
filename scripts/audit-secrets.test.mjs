// Tests for audit-secrets.mjs. Run: node --test scripts/audit-*.test.mjs
// Fixture secrets are assembled at run time so this file itself contains nothing that looks like a key.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { redact, run, runGitleaks, scanHistory, scanText, scanTree, sensitiveFileReason, shannon } from './audit-secrets.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pn-sec-'));
const write = (root, rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};
const sh = (root, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
const gitInit = (root) => {
  sh(root, 'git', ['init', '-q', '-b', 'main']);
};
const commit = (root, msg = 'c') => {
  sh(root, 'git', ['add', '-A']);
  sh(root, 'git', ['commit', '-q', '-m', msg]);
};
const capture = (argv, opts) => {
  const out = [];
  const code = run(argv, { log: (s = '') => out.push(s), errLog: (s) => out.push(s), ...opts });
  return { code, out: out.join('\n') };
};

const AWS = 'AKIA' + 'QWERTYUIOPASDFGH';
const GH = 'ghp_' + 'aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bD1fH3jL5';
const GOOGLE = 'AIza' + 'Sy' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'.slice(0, 33);
const HF = 'hf_' + 'abcdEFGHijklMNOPqrstUVWXyz0123456789';
const PEM = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
const HIGH = 'q7Zr2Lw9XcV4bN8mK1pT6yH3'; // random looking value for assignment rule

test('detects well-known token formats and redacts the value', () => {
  const text = [`aws = "${AWS}"`, `token: ${GH}`, `key=${GOOGLE}`, `HF_TOKEN=${HF}`, PEM, 'ok line'].join('\n');
  const f = scanText(text);
  const names = f.map((x) => x.rule);
  for (const n of ['AWS access key id', 'GitHub token', 'Google API key', 'Hugging Face token', 'Private key block']) assert.ok(names.includes(n), `${n} in ${names}`);
  const dump = JSON.stringify(f);
  for (const s of [AWS, GH, GOOGLE, HF]) assert.ok(!dump.includes(s), 'secret value leaked into the report');
  assert.ok(f.every((x) => x.redacted.includes('redacted')));
  assert.equal(f.find((x) => x.rule === 'AWS access key id').line, 1);
});

test('hard-coded secret assignments are found; placeholders and env lookups are not', () => {
  assert.equal(scanText(`const apiKey = "${HIGH}";`).length, 1);
  assert.equal(scanText(`password: '${HIGH}'`).length, 1);
  assert.equal(scanText(`API_KEY = "your-api-key-here"`).length, 0);
  assert.equal(scanText(`const apiKey = process.env.API_KEY;`).length, 0);
  assert.equal(scanText(`const secret = "changeme-changeme"`).length, 0);
  assert.equal(scanText(`password: 'aaaaaaaaaaaaaaaa'`).length, 0);
  assert.equal(scanText(`const token = getToken();`).length, 0);
  assert.equal(scanText(`<input type="password" name="password" placeholder="Enter">`).length, 0);
  assert.equal(scanText(`passwordLabel = "ConfirmYourPassword"`).length, 0);
});

test('credentials inside URLs are found, ordinary URLs are not', () => {
  assert.equal(scanText(`const u = "postgres://admin:${HIGH}@db.internal.example/app";`).length, 1);
  assert.equal(scanText('https://example.com/a/b?c=d').length, 0);
  assert.equal(scanText('https://user:pass@example.com').length, 0); // low entropy placeholder
});

test('audit-ignore with a reason (or gitleaks:allow) silences a line', () => {
  assert.equal(scanText(`k = "${AWS}" // audit-ignore: public example id from AWS docs`).length, 0);
  assert.equal(scanText(`k = "${AWS}" # gitleaks:allow`).length, 0);
  assert.equal(scanText(`k = "${AWS}" // audit-ignore:`).length, 1);
});

test('helpers: redact never returns the full value, entropy, sensitive names', () => {
  const r = redact(GH);
  assert.ok(!r.includes(GH) && r.length < 40);
  assert.ok(shannon('aaaaaaaa') < 1 && shannon(HIGH) > 3.5);
  assert.equal(sensitiveFileReason('.env'), '.env file');
  assert.equal(sensitiveFileReason('apps/web/.env.production'), '.env file');
  assert.equal(sensitiveFileReason('.env.example'), null);
  assert.equal(sensitiveFileReason('keys/server.pem'), 'private key or keystore file');
  assert.equal(sensitiveFileReason('id_rsa'), 'SSH private key');
  assert.equal(sensitiveFileReason('src/main.ts'), null);
  assert.equal(sensitiveFileReason('service-account-prod.json'), 'credentials file');
});

test('clean git repo passes; .env example is fine', () => {
  const root = tmp();
  gitInit(root);
  write(root, 'src/a.ts', 'export const a = 1;\n');
  write(root, '.env.example', 'API_URL=\n');
  write(root, 'README.md', 'Set `API_KEY` in your env.\n');
  commit(root);
  const r = capture(['--root', root, '--builtin']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /RESULT: PASS/);
});

test('working tree: token in source and a committed .env fail, output is redacted', () => {
  const root = tmp();
  gitInit(root);
  write(root, 'src/cfg.ts', `export const t = "${GH}";\n`);
  write(root, '.env', 'FOO=bar\n');
  commit(root);
  const r = capture(['--root', root, '--builtin']);
  assert.equal(r.code, 1);
  assert.match(r.out, /src\/cfg\.ts:1 {2}\[GitHub token\]/);
  assert.match(r.out, /\.env:1 {2}\[Committed \.env file\]/);
  assert.ok(!r.out.includes(GH));
});

test('gitignored .env is not reported, but an un-ignored untracked one is', () => {
  const root = tmp();
  gitInit(root);
  write(root, '.gitignore', '.env\n');
  write(root, '.env', 'FOO=bar\n');
  write(root, 'src/a.ts', 'export {};\n');
  commit(root);
  assert.equal(capture(['--root', root, '--builtin']).code, 0);
  write(root, 'config/.env.local', 'FOO=bar\n');
  const r = capture(['--root', root, '--builtin']);
  assert.equal(r.code, 1);
  assert.match(r.out, /would be committed/);
});

test('--history finds a secret that was deleted in a later commit', () => {
  const root = tmp();
  gitInit(root);
  write(root, 'src/a.ts', `const k = "${AWS}";\n`);
  commit(root, 'oops');
  write(root, 'src/a.ts', 'const k = process.env.K;\n');
  write(root, 'secrets.pem', 'x');
  commit(root, 'fix');
  fs.rmSync(path.join(root, 'secrets.pem'));
  commit(root, 'remove pem');
  assert.equal(capture(['--root', root, '--builtin']).code, 0, 'working tree is clean');
  const r = capture(['--root', root, '--builtin', '--history']);
  assert.equal(r.code, 1);
  assert.match(r.out, /src\/a\.ts:1 @[0-9a-f]{12} {2}\[AWS access key id\]/);
  assert.match(r.out, /secrets\.pem.*history/);
  assert.ok(!r.out.includes(AWS));
  const h = scanHistory(root);
  assert.ok(h.commits >= 3);
});

test('non-git folder is scanned by walking files and skips node_modules', () => {
  const root = tmp();
  write(root, 'src/a.ts', `const t = "${GH}";\n`);
  write(root, 'node_modules/x/index.js', `const t = "${GH}";\n`);
  const t = scanTree(root);
  assert.equal(t.inGit, false);
  assert.equal(t.findings.length, 1);
  assert.equal(t.findings[0].file, 'src/a.ts');
});

test('binary and oversized files are skipped', () => {
  const root = tmp();
  write(root, 'a.png', `${GH}`);
  fs.writeFileSync(path.join(root, 'blob.dat'), Buffer.concat([Buffer.from([0, 1, 2, 3]), Buffer.from(GH)]));
  assert.equal(scanTree(root).findings.length, 0);
});

test('uses gitleaks when installed (stub binary) and still applies file-name rules', () => {
  const root = tmp();
  gitInit(root);
  write(root, 'src/a.ts', 'export {};\n');
  write(root, '.env', 'A=b\n');
  commit(root);
  const bin = path.join(tmp(), 'gitleaks');
  fs.writeFileSync(
    bin,
    `#!/bin/sh
if [ "$1" = "version" ]; then echo "8.99.0-stub"; exit 0; fi
REPORT=""
while [ $# -gt 0 ]; do if [ "$1" = "--report-path" ]; then REPORT="$2"; fi; shift; done
echo '[{"RuleID":"generic-api-key","File":"src/a.ts","StartLine":7,"Secret":"REDACTED","Commit":""}]' > "$REPORT"
exit 0
`,
    { mode: 0o755 },
  );
  const g = runGitleaks(root, { bin });
  assert.equal(g.findings.length, 1);
  assert.equal(g.findings[0].file, 'src/a.ts');
  const r = capture(['--root', root], { gitleaksBin: bin });
  assert.equal(r.code, 1);
  assert.match(r.out, /engine: gitleaks 8\.99\.0-stub/);
  assert.match(r.out, /src\/a\.ts:7 {2}\[gitleaks: generic-api-key\]/);
  assert.match(r.out, /Committed \.env file/);
  assert.equal(runGitleaks(root, { bin: '/nonexistent/gitleaks' }), null);
});

test('--json output is parseable and contains no secret values', () => {
  const root = tmp();
  write(root, 'a.ts', `const t = "${GH}";\n`);
  const r = capture(['--root', root, '--builtin', '--json']);
  assert.equal(r.code, 1);
  const j = JSON.parse(r.out);
  assert.equal(j.findings.length, 1);
  assert.ok(!r.out.includes(GH));
});

test('the audit scripts and fixtures in this repo do not trip the scanner', () => {
  const dir = path.dirname(new URL(import.meta.url).pathname);
  for (const f of fs.readdirSync(dir).filter((n) => n.startsWith('audit-') && /\.(mjs|json)$/.test(n))) {
    const hits = scanText(fs.readFileSync(path.join(dir, f), 'utf8'));
    assert.deepEqual(hits, [], `${f} should be clean`);
  }
});

test('unknown option is a usage error', () => {
  assert.equal(capture(['--wat']).code, 2);
});
