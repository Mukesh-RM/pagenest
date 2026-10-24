// node --test scripts/audit-models.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditProject, loadRegistry, renderDoc, renderLicensesSection, run, scanText, summarize, validateRegistry } from './audit-models.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pn-mod-'));
const write = (root, rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};
const capture = async (argv, opts = {}) => {
  const out = [];
  const err = [];
  const code = await run(argv, { log: (s = '') => out.push(s), errLog: (s) => err.push(s), ...opts });
  return { code, out: out.join('\n'), err: err.join('\n') };
};
const SHA = 'a'.repeat(64);
const voice = (id, verdict, extra = {}) => ({
  id,
  hfPath: 'x/y/z/q',
  language: id.split('-')[0],
  dataset: 'https://example.org/data',
  datasetLicense: 'CC0',
  lineage: 'scratch',
  onnxSha256: SHA,
  verdict,
  reason: 'test',
  reviewed: 'manual',
  blockers: verdict === 'OK' ? [] : ['test'],
  evidence: ['https://example.org/card'],
  ...(verdict === 'OK' ? { attribution: 'Test voice, CC0' } : {}),
  ...extra,
});
const REG = {
  reviewedAt: '2026-10-24',
  piperVoicesRevision: 'abcdef0123456789',
  piperVoicesUrl: 'https://huggingface.co/rhasspy/piper-voices',
  hfRepos: [
    { repo: 'rhasspy/piper-voices', kind: 'piper-voices' },
    { repo: 'hexgrad/Kokoro-82M', component: 'kokoro' },
    { repo: 'canopylabs/*', component: 'orpheus' },
  ],
  components: [
    { id: 'kokoro', kind: 'weights', name: 'Kokoro', license: 'Apache-2.0', verdict: 'OK', reason: 'r', evidence: ['u'], files: ['kokoro-v1.0.onnx'] },
    { id: 'orpheus', kind: 'weights', name: 'Orpheus', license: 'llama', verdict: 'NOT-OK', reason: 'Llama licence', evidence: ['u'], match: ['orpheus'] },
    { id: 'espeak', kind: 'library', name: 'eSpeak NG', license: 'GPL', verdict: 'NOT-OK', reason: 'GPL', evidence: ['u'], match: ['espeak', 'phonemizer'] },
  ],
  voices: [
    voice('en_US-good-medium', 'OK', { language: 'en_US' }),
    voice('en_US-lessac-medium', 'NOT-OK', { language: 'en_US' }),
    voice('en_US-maybe-medium', 'VERIFY', { language: 'en_US' }),
  ],
};
const rules = (findings) => findings.map((f) => f.rule);

test('an OK voice passes; NOT-OK, VERIFY and unknown voices fail', () => {
  assert.deepEqual(scanText("const v = 'en_US-good-medium';", 'src/a.ts', REG), []);
  assert.deepEqual(rules(scanText("const v = 'en_US-lessac-medium';", 'src/a.ts', REG)), ['voice-not-ok']);
  assert.deepEqual(rules(scanText("const v = 'en_US-maybe-medium';", 'src/a.ts', REG)), ['voice-verify']);
  assert.deepEqual(rules(scanText("const v = 'en_GB-nobody-high';", 'src/a.ts', REG)), ['voice-not-in-registry']);
});

test('voice ids are found in URLs, paths and file names', () => {
  const url = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx';
  const f = scanText(`fetch("${url}")`, 'src/a.ts', REG);
  assert.deepEqual(rules(f), ['voice-not-ok']);
  assert.deepEqual(rules(scanText('const p = "en/en_US/lessac/medium";', 'src/a.ts', REG)), ['voice-not-ok']);
  assert.deepEqual(rules(scanText('{"file": "en_US-lessac-medium.onnx.json"}', 'public/m.json', REG)), ['voice-not-ok']);
});

test('Hugging Face repos: registered OK repo passes, unknown and blocked ones fail, datasets are refused', () => {
  assert.deepEqual(scanText('const u = "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/model.onnx"', 'src/a.ts', REG).map((f) => f.rule), ['model-file-not-in-registry']);
  assert.deepEqual(rules(scanText('const u = "https://huggingface.co/hexgrad/Kokoro-82M"', 'src/a.ts', REG)), []);
  assert.deepEqual(rules(scanText('const u = "https://huggingface.co/someone/voices/resolve/main/a.bin"', 'src/a.ts', REG)), ['hf-repo-not-in-registry']);
  assert.deepEqual(rules(scanText('const u = "https://huggingface.co/canopylabs/orpheus-3b-0.1-ft"', 'src/a.ts', REG)).sort(), ['component-not-ok', 'hf-repo-not-ok']);
  assert.deepEqual(rules(scanText('const u = "https://huggingface.co/datasets/foo/bar"', 'src/a.ts', REG)), ['hf-dataset-or-space']);
});

test('model files must be registered; comments and audit-ignore lines are skipped', () => {
  assert.deepEqual(rules(scanText("load('mystery.onnx')", 'src/a.ts', REG)), ['model-file-not-in-registry']);
  assert.deepEqual(rules(scanText("load('kokoro-v1.0.onnx')", 'src/a.ts', REG)), []);
  assert.deepEqual(scanText("// we never ship en_US-lessac-medium.onnx\n * mystery.onnx\n# espeak", 'src/a.ts', REG), []);
  assert.deepEqual(scanText("const v = 'en_US-lessac-medium'; // audit-ignore: deny-list entry", 'src/a.ts', REG), []);
});

test('blocked components are flagged by name (espeak, phonemizer, orpheus)', () => {
  assert.deepEqual(rules(scanText("import { phonemize } from 'phonemizer';", 'src/a.ts', REG)), ['component-not-ok']);
  assert.deepEqual(rules(scanText("new Worker('espeak-ng.worker.js')", 'src/a.ts', REG)), ['component-not-ok']);
  assert.deepEqual(rules(scanText("const m = 'orpheus-3b';", 'src/a.ts', REG)), ['component-not-ok']);
});

test('model URLs built at run time give a warning', () => {
  const f = scanText('const u = `https://huggingface.co/rhasspy/piper-voices/resolve/main/${path}`;', 'src/a.ts', REG);
  assert.ok(f.some((x) => x.level === 'warn' && x.rule === 'dynamic-model-url'));
  assert.ok(!f.some((x) => x.level === 'fail'));
});

test('validateRegistry: OK rows need proof', () => {
  assert.deepEqual(validateRegistry(REG), []);
  const bad = structuredClone(REG);
  bad.voices[0].onnxSha256 = 'nothex';
  delete bad.voices[0].attribution;
  bad.voices[0].reviewed = 'auto';
  bad.voices[0].evidence = [];
  const p = validateRegistry(bad).join('\n');
  assert.match(p, /sha256/);
  assert.match(p, /attribution/);
  assert.match(p, /reviewed manually/);
  assert.match(p, /evidence link/);
  const dup = structuredClone(REG);
  dup.voices.push(voice('en_US-good-medium', 'NOT-OK'));
  assert.match(validateRegistry(dup).join('\n'), /duplicate voice id/);
  const wrong = structuredClone(REG);
  wrong.voices[1].verdict = 'MAYBE';
  assert.match(validateRegistry(wrong).join('\n'), /verdict must be/);
});

test('project scan: test files skipped, node_modules ignored, package.json dependency on a blocked component fails', async () => {
  const root = tmp();
  write(root, 'scripts/audit-models.json', JSON.stringify(REG));
  write(root, 'package.json', JSON.stringify({ name: 'app', dependencies: { react: '18' } }));
  write(root, 'src/ok.ts', "export const v = 'en_US-good-medium';\n");
  write(root, 'src/deny.test.ts', "expect(isBlocked('en_US-lessac-medium')).toBe(true);\n");
  write(root, 'node_modules/x/index.js', "'en_US-lessac-medium'");
  assert.equal((await capture(['--root', root])).code, 0);
  assert.equal(auditProject(root, REG).findings.length, 0);
  write(root, 'package.json', JSON.stringify({ name: 'app', dependencies: { phonemizer: '1.2.1' } }));
  const r = await capture(['--root', root]);
  assert.equal(r.code, 1);
  assert.match(r.out, /package\.json:1 \[component-not-ok\] dependency phonemizer/);
  write(root, 'package.json', JSON.stringify({ name: 'app' }));
  write(root, 'public/manifest.json', '{"voice":"en_US-lessac-medium"}');
  const r2 = await capture(['--root', root]);
  assert.equal(r2.code, 1);
  assert.match(r2.out, /public\/manifest\.json:1 \[voice-not-ok\]/);
});

test('--voice prints the verdict and exits non-zero unless OK', async () => {
  const root = tmp();
  write(root, 'scripts/audit-models.json', JSON.stringify(REG));
  assert.equal((await capture(['--root', root, '--voice', 'en_US-good-medium'])).code, 0);
  const bad = await capture(['--root', root, '--voice', 'en_US-lessac-medium']);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /NOT-OK/);
  const unknown = await capture(['--root', root, '--voice', 'xx_XX-none-low']);
  assert.equal(unknown.code, 1);
  assert.match(unknown.out, /NOT IN REGISTRY/);
});

test('--write and --check keep the generated tables of docs/MODEL_VETTING.md in sync', async () => {
  const root = tmp();
  write(root, 'scripts/audit-models.json', JSON.stringify(REG));
  const markers = ['summary', 'english', 'other', 'components', 'attribution'].map((k) => `## ${k}\n<!-- BEGIN GENERATED: ${k} -->\n<!-- END GENERATED: ${k} -->\n`).join('\n');
  write(root, 'docs/MODEL_VETTING.md', `# Doc\n\n${markers}`);
  assert.equal((await capture(['--root', root, '--check'])).code, 1);
  assert.equal((await capture(['--root', root, '--write'])).code, 0);
  const doc = fs.readFileSync(path.join(root, 'docs/MODEL_VETTING.md'), 'utf8');
  assert.match(doc, /\| en_US-good-medium \|/);
  assert.match(doc, /\*\*NOT OK\*\*/);
  assert.match(doc, /Test voice, CC0/);
  assert.equal((await capture(['--root', root, '--check'])).code, 0);
  const reg2 = structuredClone(REG);
  reg2.voices[0].verdict = 'NOT-OK';
  reg2.voices[0].blockers = ['x'];
  write(root, 'scripts/audit-models.json', JSON.stringify(reg2));
  assert.equal((await capture(['--root', root, '--check'])).code, 1);
  assert.throws(() => renderDoc('no markers', REG), /markers/);
});

test('registry summary and licenses section', () => {
  const s = summarize(REG);
  assert.equal(s.voices, 3);
  assert.equal(s.ok, 1);
  assert.equal(s.english, 3);
  assert.match(renderLicensesSection(REG).join('\n'), /Piper voices reviewed: 3 \(OK 1, NOT OK 1, VERIFY 1\)/);
});

test('shipped registry: well formed, real findings pinned', () => {
  const reg = loadRegistry(process.cwd());
  assert.deepEqual(validateRegistry(reg), []);
  const get = (id) => reg.voices.find((v) => v.id === id);
  for (const id of ['en_US-lessac-low', 'en_US-lessac-medium', 'en_US-lessac-high', 'en_US-libritts_r-medium', 'en_US-ryan-high', 'en_US-hfc_female-medium', 'en_GB-semaine-medium', 'en_US-l2arctic-medium', 'en_GB-alan-medium']) {
    assert.equal(get(id)?.verdict, 'NOT-OK', id);
  }
  assert.equal(get('en_US-libritts-high')?.verdict, 'OK');
  assert.equal(get('en_US-kristin-medium')?.verdict, 'OK');
  assert.equal(get('en_US-bryce-medium')?.verdict, 'VERIFY');
  for (const v of reg.voices.filter((x) => x.verdict === 'OK')) assert.match(v.onnxSha256, /^[0-9a-f]{64}$/);
  for (const v of reg.voices) if (v.reviewed === 'auto') assert.notEqual(v.verdict, 'OK', `${v.id}: auto-reviewed voices can never be OK`);
  assert.equal(reg.components.find((c) => c.id === 'phonemizer-npm').verdict, 'NOT-OK');
  assert.equal(reg.components.find((c) => c.id === 'orpheus-3b').verdict, 'NOT-OK');
});
