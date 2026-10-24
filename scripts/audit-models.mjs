#!/usr/bin/env node
// PageNest model audit: every voice, model or model host referenced in the app must be vetted.
//
//   node scripts/audit-models.mjs                 scan src/, public/, index.html, configs against the registry
//   node scripts/audit-models.mjs --voice ID      print the verdict for one Piper voice (for example en_US-lessac-medium)
//   node scripts/audit-models.mjs --list          print the registry summary
//   node scripts/audit-models.mjs --write         regenerate the tables in docs/MODEL_VETTING.md
//   node scripts/audit-models.mjs --check         fail if those tables are out of date
//   node scripts/audit-models.mjs --json          machine readable result
//   node scripts/audit-models.mjs --root DIR      audit another project folder
//   node scripts/audit-models.mjs --include-tests also scan test files
//
// Registry: scripts/audit-models.json (voices, components, Hugging Face repos). Procedure: docs/MODEL_VETTING.md.
// FAIL when code or data in src/ or public/ (comments and test files are skipped):
//   - names a Piper voice id (en_US-lessac-medium, en/en_US/lessac/medium/...) that is NOT-OK, VERIFY or not in the registry
//   - links a Hugging Face repo that is not in the registry, or an Orpheus, eSpeak, piper-phonemize, phonemizer,
//     kokoro-js or other component the registry marks NOT-OK (Decision 8)
//   - names a model file (.onnx, .gguf, .safetensors, .ckpt, .pt) that is neither a registered voice nor a registered file name
// WARN when a model URL is built at run time (template strings) and cannot be resolved. A template is resolved
//   (no warning) when its host and repo are fixed text, the repo is a registered Piper voice repo, the revision is
//   fixed text, every placeholder is a plain identifier after /resolve/<revision>/, and the same file names at least
//   one voice literal (every such literal is checked against the registry like any other). Limit: the scanner does not
//   prove which value reaches the placeholder at run time; the file must keep its closed list of approved voices.
//   A dynamic host or repo, an unregistered or non-voice repo, or an expression placeholder always warns.
// Silence one reviewed line with a comment: audit-ignore: <reason>. Owner: Auditor.
import fs from 'node:fs';
import path from 'node:path';
import { IGNORE_RE, SCRIPTS_DIR, escapeMd, exists, isMain, looksBinary, makeLineFinder, parseArgs, readJson, readText, relPath, truncate, walk } from './audit-lib.mjs';

const VERDICTS = new Set(['OK', 'NOT-OK', 'VERIFY']);
const SCANNED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.css', '.webmanifest', '.toml', '.yml', '.yaml', '.txt', '.svelte', '.vue']);
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MARK = { begin: '<!-- BEGIN GENERATED: ', end: '<!-- END GENERATED: ' };

// ---------------------------------------------------------------- registry

export function loadRegistry(root) {
  const local = path.join(root, 'scripts', 'audit-models.json');
  const file = exists(local) ? local : path.join(SCRIPTS_DIR, 'audit-models.json');
  const reg = readJson(file);
  if (!reg) throw new Error(`Model registry not found: ${file}`);
  return reg;
}

/** Problems in the registry itself (an OK row without proof is a bug in the registry). */
export function validateRegistry(reg) {
  const problems = [];
  const ids = new Set();
  for (const v of reg.voices || []) {
    if (!v.id) problems.push('voice without id');
    if (ids.has(v.id)) problems.push(`duplicate voice id ${v.id}`);
    ids.add(v.id);
    if (!VERDICTS.has(v.verdict)) problems.push(`${v.id}: verdict must be OK, NOT-OK or VERIFY`);
    if (!v.reason) problems.push(`${v.id}: reason is required`);
    if (!Array.isArray(v.evidence) || v.evidence.length === 0) problems.push(`${v.id}: evidence link is required`);
    if (v.verdict === 'OK') {
      if (!v.attribution) problems.push(`${v.id}: OK voices need an attribution text`);
      if (!/^[0-9a-f]{64}$/.test(v.onnxSha256 || '')) problems.push(`${v.id}: OK voices need the sha256 of the .onnx file`);
      if (!v.datasetLicense || !v.dataset) problems.push(`${v.id}: OK voices need dataset and datasetLicense`);
      if (v.reviewed !== 'manual') problems.push(`${v.id}: OK voices must be reviewed manually (reviewed: "manual")`);
      if (v.blockers && v.blockers.length) problems.push(`${v.id}: OK voice still lists blockers`);
    }
  }
  const compIds = new Set();
  for (const c of reg.components || []) {
    if (!c.id || !VERDICTS.has(c.verdict) || !c.reason || !c.evidence?.length) problems.push(`component ${c.id || '?'}: id, verdict, reason and evidence are required`);
    if (compIds.has(c.id)) problems.push(`duplicate component id ${c.id}`);
    compIds.add(c.id);
  }
  for (const r of reg.hfRepos || []) {
    if (!r.repo) problems.push('hfRepos entry without repo');
    if (r.component && !compIds.has(r.component)) problems.push(`hfRepos ${r.repo}: unknown component ${r.component}`);
  }
  return problems;
}

export function summarize(reg) {
  const count = (arr, v) => arr.filter((x) => x.verdict === v).length;
  const voices = reg.voices || [];
  const en = voices.filter((v) => v.language.startsWith('en_'));
  const blockers = {};
  for (const v of voices) for (const b of v.blockers || []) blockers[b] = (blockers[b] || 0) + 1;
  return {
    voices: voices.length,
    ok: count(voices, 'OK'),
    notOk: count(voices, 'NOT-OK'),
    verify: count(voices, 'VERIFY'),
    english: en.length,
    englishOk: count(en, 'OK'),
    blockers,
    components: (reg.components || []).length,
  };
}

// ---------------------------------------------------------------- scanning

const VOICE_ID_RE = /(?<![A-Za-z0-9_])([a-z]{2,3}_[A-Z]{2})-([A-Za-z0-9_]+)-(x_low|low|medium|high)(?![A-Za-z0-9_])/g;
const VOICE_PATH_RE = /(?<![A-Za-z0-9_])([a-z]{2,3})\/([a-z]{2,3}_[A-Z]{2})\/([A-Za-z0-9_]+)\/(x_low|low|medium|high)(?![A-Za-z0-9_])/g;
const HF_URL_RE = /(?:https?:)?\/\/(?:www\.)?(?:huggingface\.co|hf\.co)\/(?:(datasets|spaces)\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/(?:resolve|blob|raw)\/([^/\s'"`)]+)\/([^\s'"`?#)]*))?/g;
const HF_DYNAMIC_RE = /(?:huggingface\.co|hf\.co)\/[^\s'"`]*\$\{/;
const SIMPLE_PLACEHOLDER_RE = /^\$\{\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\}$/;

/**
 * Judge a template-literal Hugging Face URL. Returns null when there is nothing dynamic, otherwise
 * { resolvable, why }. Resolvable only when the host and the repo are fixed text, the repo is a registered
 * Piper voice repo, the revision segment is fixed text and every placeholder is a plain identifier or
 * property access that sits after "/resolve/<revision>/" (so it can only select a file inside that repo).
 * Whether the selected voice is vetted is then decided by the caller (the file must carry a closed set of
 * registry-OK voice literals).
 */
export function analyzeTemplateUrl(line, reg) {
  const m = line.match(/`(?:https?:)?\/\/(?:www\.)?(?:huggingface\.co|hf\.co)\/([^`]*)`/);
  if (!m || !m[1].includes('${')) return null;
  const parts = m[1].split('/');
  const [org, repo, kind, rev] = parts;
  if (!org || !repo || org.includes('${') || repo.includes('${')) return { resolvable: false, why: 'the repository part of the URL is dynamic' };
  const rule = repoRule(reg, `${org}/${repo}`);
  if (!rule) return { resolvable: false, why: `repo ${org}/${repo} is not in the registry` };
  if (rule.kind !== 'piper-voices') return { resolvable: false, why: `repo ${org}/${repo} is not a Piper voice repo with a per-voice registry` };
  if (!['resolve', 'blob', 'raw'].includes(kind || '') || !rev || rev.includes('${')) return { resolvable: false, why: 'the URL is not of the form /<org>/<repo>/resolve/<fixed revision>/<file>' };
  const rest = parts.slice(4).join('/');
  const placeholders = rest.match(/\$\{[^}]*\}/g) || [];
  if (rest.replace(/\$\{[^}]*\}/g, '').includes('$')) return { resolvable: false, why: 'unsupported template syntax' };
  if (!placeholders.length || !placeholders.every((x) => SIMPLE_PLACEHOLDER_RE.test(x))) return { resolvable: false, why: 'a placeholder is an expression, not a plain identifier' };
  return { resolvable: true, why: 'fixed host, registered repo and fixed revision; only the file path is dynamic' };
}
const MODEL_FILE_RE = /(?<![A-Za-z0-9_.-])([A-Za-z0-9_.-]+\.(?:onnx|gguf|safetensors|ckpt|pt))(?![A-Za-z0-9_-])/g;

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--') || t.startsWith('#');
}

function isTestFile(rel) {
  return /(^|\/)(__tests__|__mocks__|tests?|e2e|fixtures)\//.test(rel) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel);
}

function repoRule(reg, repo) {
  for (const r of reg.hfRepos || []) {
    if (r.repo === repo) return r;
    if (r.repo.endsWith('/*') && repo.startsWith(r.repo.slice(0, -1))) return r;
  }
  return null;
}

/** Scan one text. Returns findings {level, rule, line, detail, text}. */
export function scanText(text, rel, reg) {
  const findings = [];
  const voices = new Map((reg.voices || []).map((v) => [v.id, v]));
  const comps = new Map((reg.components || []).map((c) => [c.id, c]));
  const fileNames = new Set((reg.components || []).flatMap((c) => c.files || []));
  const compMatchers = (reg.components || []).filter((c) => c.verdict !== 'OK' && Array.isArray(c.match)).map((c) => [c, c.match.map((m) => new RegExp(m, 'i'))]);
  const lines = text.split(/\r?\n/);
  const literalVoices = new Set();
  const pendingTemplates = [];
  const add = (level, rule, i, detail) => findings.push({ level, rule, file: rel, line: i + 1, detail, text: truncate(lines[i].trim(), 160) });

  const voiceCheck = (id, i) => {
    const v = voices.get(id);
    if (!v) add('fail', 'voice-not-in-registry', i, `Piper voice ${id} is not in scripts/audit-models.json; vet it first (docs/MODEL_VETTING.md)`);
    else if (v.verdict !== 'OK') add('fail', `voice-${v.verdict.toLowerCase()}`, i, `Piper voice ${id} is ${v.verdict}: ${truncate(v.reason, 200)}`);
  };

  lines.forEach((line, i) => {
    if (isCommentLine(line) || IGNORE_RE.test(line)) return;
    const seenVoices = new Set();
    for (const m of line.matchAll(VOICE_ID_RE)) {
      const id = `${m[1]}-${m[2]}-${m[3]}`;
      literalVoices.add(id);
      if (!seenVoices.has(id)) {
        seenVoices.add(id);
        voiceCheck(id, i);
      }
    }
    for (const m of line.matchAll(VOICE_PATH_RE)) {
      const id = `${m[2]}-${m[3]}-${m[4]}`;
      literalVoices.add(id);
      if (!seenVoices.has(id)) {
        seenVoices.add(id);
        voiceCheck(id, i);
      }
    }
    for (const m of line.matchAll(HF_URL_RE)) {
      if (m[1]) {
        add('fail', 'hf-dataset-or-space', i, `Hugging Face ${m[1]} URL ${m[2]}/${m[3]}: not a model host the app may use`);
        continue;
      }
      const repo = `${m[2]}/${m[3]}`;
      const rule = repoRule(reg, repo);
      if (!rule) add('fail', 'hf-repo-not-in-registry', i, `Hugging Face repo ${repo} is not in the registry (hfRepos)`);
      else if (rule.component) {
        const c = comps.get(rule.component);
        if (c && c.verdict !== 'OK') add('fail', 'hf-repo-not-ok', i, `Hugging Face repo ${repo} belongs to ${c.id}, which is ${c.verdict}: ${truncate(c.reason, 160)}`);
      }
    }
    if (HF_DYNAMIC_RE.test(line)) {
      const t = analyzeTemplateUrl(line, reg);
      if (t && t.resolvable) pendingTemplates.push(i);
      else add('warn', 'dynamic-model-url', i, `Hugging Face URL built at run time (${t ? t.why : 'cannot be analysed'}): the code must only build URLs for voices that the registry marks OK`);
    }
    for (const m of line.matchAll(MODEL_FILE_RE)) {
      const name = m[1];
      const stem = name.replace(/\.(onnx|gguf|safetensors|ckpt|pt)$/, '');
      if (voices.has(stem) || fileNames.has(name)) continue;
      if (/^[a-z]{2,3}_[A-Z]{2}-/.test(stem)) continue; // already judged as a voice id above
      add('fail', 'model-file-not-in-registry', i, `model file ${name} is not a registered voice or model file name (add it to a component's "files" after vetting)`);
    }
    for (const [c, res] of compMatchers) {
      if (res.some((re) => re.test(line))) add('fail', 'component-not-ok', i, `${c.name} is ${c.verdict}: ${truncate(c.reason, 180)}`);
    }
  });
  // A resolvable template is accepted when this file carries a closed set of voice literals (ids or paths) and every
  // one of them was just checked against the registry (a NOT-OK, VERIFY or unknown literal is already a failure).
  // With no voice literal in the file the selected voice is unknown, so warn.
  for (const i of pendingTemplates) {
    if (literalVoices.size === 0) add('warn', 'dynamic-model-url', i, 'Hugging Face URL built at run time from a registered Piper repo, but this file lists no voice ids to check: the code must only build URLs for voices that the registry marks OK');
  }
  return dedupe(findings);
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const k = `${f.rule}|${f.file}|${f.line}|${f.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function targets(root) {
  const out = [];
  for (const d of ['src', 'public']) {
    const p = path.join(root, d);
    if (exists(p)) out.push(...walk(p));
  }
  for (const f of ['index.html']) if (exists(path.join(root, f))) out.push(path.join(root, f));
  for (const f of fs.readdirSync(root)) if (/^(vite|vitest|workbox)\.config\.[cm]?[jt]s$/.test(f) || f === 'manifest.webmanifest') out.push(path.join(root, f));
  return [...new Set(out)];
}

export function auditProject(root, reg, { includeTests = false } = {}) {
  const findings = [];
  const skipped = [];
  let scanned = 0;
  for (const file of targets(root)) {
    const rel = relPath(root, file);
    if (!SCANNED_EXT.has(path.extname(file).toLowerCase())) continue;
    if (!includeTests && isTestFile(rel)) {
      skipped.push(`${rel} (test file)`);
      continue;
    }
    let st;
    try {
      st = fs.statSync(file);
    } catch {
      continue;
    }
    if (st.size > MAX_FILE_BYTES) {
      skipped.push(`${rel} (over 2 MB)`);
      continue;
    }
    const buf = fs.readFileSync(file);
    if (looksBinary(buf)) continue;
    scanned++;
    findings.push(...scanText(buf.toString('utf8'), rel, reg));
  }
  // package.json dependencies naming a blocked component
  const pkg = exists(path.join(root, 'package.json')) ? readJson(path.join(root, 'package.json')) : null;
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
    for (const c of reg.components || []) {
      if (c.verdict === 'OK' || !c.match) continue;
      for (const name of Object.keys(deps)) {
        if (c.match.some((m) => new RegExp(m, 'i').test(name))) findings.push({ level: 'fail', rule: 'component-not-ok', file: 'package.json', line: 1, detail: `dependency ${name}: ${c.name} is ${c.verdict}: ${truncate(c.reason, 180)}`, text: name });
      }
    }
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { scanned, skipped, findings };
}

// ---------------------------------------------------------------- docs/MODEL_VETTING.md tables

const STATUS = { OK: 'OK', 'NOT-OK': 'NOT OK', VERIFY: 'VERIFY' };
const short = (s, n = 140) => truncate(String(s || '').replace(/\s+/g, ' '), n);
const link = (label, url) => `[${escapeMd(label)}](${url})`;

export function renderTables(reg) {
  const sum = summarize(reg);
  const base = `${reg.piperVoicesUrl}/blob/main`;
  const out = {};
  out.summary = [
    `Registry reviewed ${reg.reviewedAt} against \`${reg.piperVoicesUrl}\` at revision \`${reg.piperVoicesRevision.slice(0, 8)}\`.`,
    '',
    `| | Voices | OK | NOT OK | VERIFY |`,
    `|---|---:|---:|---:|---:|`,
    `| All languages | ${sum.voices} | ${sum.ok} | ${sum.notOk} | ${sum.verify} |`,
    `| English (en_US, en_GB) | ${sum.english} | ${sum.englishOk} | ${reg.voices.filter((v) => v.language.startsWith('en_') && v.verdict === 'NOT-OK').length} | ${reg.voices.filter((v) => v.language.startsWith('en_') && v.verdict === 'VERIFY').length} |`,
    '',
    'Why voices are blocked (a voice can have several reasons):',
    '',
    ...Object.entries(sum.blockers)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `- \`${k}\`: ${n}`),
  ].join('\n');

  const voiceRows = (list) => {
    const rows = ['| Voice | Dataset | Dataset license (card) | Lineage | Verdict | Why | sha256 of .onnx | Evidence |', '|---|---|---|---|---|---|---|---|'];
    for (const v of list) {
      const ev = [link('card', v.evidence[0]), ...v.evidence.slice(1, 3).map((u, i) => link(`src${i + 1}`, u))].join(' ');
      rows.push(`| ${escapeMd(v.id)} | ${short(v.dataset, 60) ? escapeMd(short(v.dataset, 60)) : 'n/a'} | ${escapeMd(short(v.datasetLicense, 50))} | ${escapeMd(short(v.lineage, 50))} | **${STATUS[v.verdict]}** | ${escapeMd(short(v.reason, 170))} | ${v.onnxSha256 ? `\`${v.onnxSha256.slice(0, 12)}\`...` : 'n/a'} | ${ev} |`);
    }
    return rows.join('\n');
  };
  out.english = voiceRows(reg.voices.filter((v) => v.language.startsWith('en_')));
  const others = reg.voices.filter((v) => !v.language.startsWith('en_'));
  const compact = ['| Voice | Dataset license (card) | Lineage | Verdict | Blockers |', '|---|---|---|---|---|'];
  for (const v of others) compact.push(`| ${link(v.id, `${base}/${v.hfPath}/MODEL_CARD`)} | ${escapeMd(short(v.datasetLicense, 40))} | ${escapeMd(short(v.lineage, 40))} | **${STATUS[v.verdict]}** | ${(v.blockers || []).join(', ') || (v.verdict === 'OK' ? 'none' : 'unreviewed')} |`);
  out.other = compact.join('\n');

  const comp = ['| Component | Kind | License | Verdict | Why | Evidence |', '|---|---|---|---|---|---|'];
  for (const c of reg.components) comp.push(`| ${escapeMd(c.name)} | ${c.kind} | ${escapeMd(c.license)} | **${STATUS[c.verdict]}** | ${escapeMd(short(c.reason, 330))} | ${c.evidence.map((u, i) => link(`src${i + 1}`, u)).join(' ')} |`);
  out.components = comp.join('\n');
  out.attribution = reg.voices
    .filter((v) => v.verdict === 'OK')
    .map((v) => `- **${v.id}**: ${v.attribution}`)
    .concat(reg.components.filter((c) => c.attribution && c.verdict === 'OK').map((c) => `- **${c.name}**: ${c.attribution}`))
    .join('\n');
  return out;
}

function inject(doc, key, body) {
  const b = `${MARK.begin}${key} -->`;
  const e = `${MARK.end}${key} -->`;
  const i = doc.indexOf(b);
  const j = doc.indexOf(e);
  if (i < 0 || j < 0 || j < i) throw new Error(`docs/MODEL_VETTING.md is missing the markers for "${key}"`);
  return `${doc.slice(0, i + b.length)}\n${body}\n${doc.slice(j)}`;
}

export function renderDoc(currentDoc, reg) {
  const t = renderTables(reg);
  let doc = currentDoc;
  for (const key of ['summary', 'english', 'other', 'components', 'attribution']) doc = inject(doc, key, t[key]);
  return doc;
}

/** Markdown for docs/LICENSES.md (registry summary). */
export function renderLicensesSection(reg) {
  const s = summarize(reg);
  const lines = ['## Voice and model registry', ''];
  lines.push(`Source: \`scripts/audit-models.json\`, procedure and per-voice evidence in \`docs/MODEL_VETTING.md\`. \`node scripts/audit-models.mjs\` fails the build when code names a voice, model file or Hugging Face repo that is not OK in this registry.`, '');
  lines.push(`- Piper voices reviewed: ${s.voices} (OK ${s.ok}, NOT OK ${s.notOk}, VERIFY ${s.verify}); English: ${s.englishOk} of ${s.english} OK`);
  lines.push('- OK voices: ' + (reg.voices.filter((v) => v.verdict === 'OK').map((v) => `\`${v.id}\``).join(', ') || 'none'), '');
  lines.push('| Component | License | Verdict |', '|---|---|---|');
  for (const c of reg.components) lines.push(`| ${escapeMd(c.name)} | ${escapeMd(c.license)} | ${STATUS[c.verdict]} |`);
  lines.push('');
  return lines;
}

// ---------------------------------------------------------------- main

export function run(argv, { cwd = process.cwd(), log = console.log, errLog = console.error } = {}) {
  let args;
  try {
    args = parseArgs(argv, { root: 'string', voice: 'string', list: 'bool', write: 'bool', check: 'bool', json: 'bool', 'include-tests': 'bool', help: 'bool' });
  } catch (e) {
    errLog(e.message);
    return 2;
  }
  if (args.help) {
    log('Usage: node scripts/audit-models.mjs [--root DIR] [--voice ID] [--list] [--write] [--check] [--json] [--include-tests]');
    return 0;
  }
  const root = path.resolve(cwd, args.root || '.');
  const reg = loadRegistry(root);
  const problems = validateRegistry(reg);

  if (args.voice) {
    const v = reg.voices.find((x) => x.id === args.voice);
    if (!v) {
      log(`${args.voice}: NOT IN REGISTRY (treated as blocked; vet it with docs/MODEL_VETTING.md)`);
      return 1;
    }
    log(`${v.id}: ${v.verdict}`);
    log(`  dataset: ${v.dataset || 'n/a'} (${v.datasetLicense})`);
    log(`  lineage: ${v.lineage}`);
    log(`  why: ${v.reason}`);
    if (v.attribution) log(`  attribution: ${v.attribution}`);
    log(`  evidence: ${v.evidence.join(' ')}`);
    return v.verdict === 'OK' ? 0 : 1;
  }
  if (args.list) {
    const s = summarize(reg);
    log(`voices ${s.voices}: OK ${s.ok}, NOT OK ${s.notOk}, VERIFY ${s.verify} (English ${s.englishOk}/${s.english} OK)`);
    for (const v of reg.voices.filter((x) => x.verdict === 'OK')) log(`  OK  ${v.id}`);
    for (const c of reg.components) log(`  ${STATUS[c.verdict].padEnd(6)} ${c.name} (${c.license})`);
    return 0;
  }

  const result = auditProject(root, reg, { includeTests: args.includeTests });
  const fails = result.findings.filter((f) => f.level === 'fail');
  const warns = result.findings.filter((f) => f.level === 'warn');
  let exit = fails.length || problems.length ? 1 : 0;

  const docPath = path.join(root, 'docs', 'MODEL_VETTING.md');
  let doc = null;
  if (args.write || args.check) {
    const cur = readText(docPath);
    if (cur === null) {
      errLog('docs/MODEL_VETTING.md not found');
      exit = exit || 1;
    } else {
      doc = renderDoc(cur, reg);
    }
  }

  if (args.json) {
    log(JSON.stringify({ root, scanned: result.scanned, registry: summarize(reg), problems, findings: result.findings }, null, 2));
  } else {
    const s = summarize(reg);
    log('PageNest model audit');
    log(`  project: ${root}`);
    log(`  registry: ${s.voices} Piper voices (OK ${s.ok}, NOT OK ${s.notOk}, VERIFY ${s.verify}), ${s.components} components`);
    log(`  scanned ${result.scanned} file(s) in: src/, public/, index.html, configs, package.json`);
    if (problems.length) {
      log('\nREGISTRY PROBLEMS');
      for (const p of problems) log(`  ${p}`);
    }
    if (fails.length) {
      log('\nFAILURES');
      for (const f of fails) log(`  ${f.file}:${f.line} [${f.rule}] ${f.detail}\n      ${f.text}`);
    }
    if (warns.length) {
      log('\nWARNINGS (review; do not fail the run)');
      for (const f of warns) log(`  ${f.file}:${f.line} [${f.rule}] ${f.detail}\n      ${f.text}`);
    }
  }

  if (doc !== null) {
    if (args.write) {
      fs.writeFileSync(docPath, doc);
      if (!args.json) log('\nWrote docs/MODEL_VETTING.md');
    } else if (readText(docPath) !== doc) {
      errLog('docs/MODEL_VETTING.md tables are out of date. Run: node scripts/audit-models.mjs --write');
      exit = exit || 1;
    } else if (!args.json) log('\ndocs/MODEL_VETTING.md is up to date.');
  }
  if (!args.json) log(exit ? `\nRESULT: FAIL (${fails.length} failure(s), ${problems.length} registry problem(s), ${warns.length} warning(s))` : `\nRESULT: PASS (0 failure(s), ${warns.length} warning(s))`);
  return exit;
}

if (isMain(import.meta.url)) {
  try {
    process.exit(run(process.argv.slice(2)));
  } catch (e) {
    console.error(e.stack || e.message);
    process.exit(2);
  }
}
