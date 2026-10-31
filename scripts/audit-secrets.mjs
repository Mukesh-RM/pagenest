#!/usr/bin/env node
// InkQuiet secret scan. Dependency-free; uses gitleaks when it is installed.
//
//   node scripts/audit-secrets.mjs               scan the working tree (tracked + untracked, not ignored files)
//   node scripts/audit-secrets.mjs --history     also scan every commit on every branch (added lines + file names)
//   node scripts/audit-secrets.mjs --builtin     never call gitleaks, use the built-in regex rules
//   node scripts/audit-secrets.mjs --json        machine readable result
//   node scripts/audit-secrets.mjs --root DIR    scan another folder
//
// Matched values are always redacted (first 4 characters + length). Exit 1 on any finding.
// Silence one reviewed line with a comment: audit-ignore: <reason>  (or "gitleaks:allow").
// Owner: Auditor.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { git, isGitRepo, isMain, looksBinary, makeLineFinder, parseArgs, readText, relPath, truncate, walk } from './audit-lib.mjs';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.wrangler', 'playwright-report', 'test-results']);
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.m4a', '.m4b', '.mp4', '.wav', '.opus', '.zip', '.wasm', '.epub', '.cbz', '.onnx', '.bin', '.lock']);

/** name, regex (global), group index holding the secret (0 = whole match). */
export const RULES = [
  ['AWS access key id', /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g, 0],
  ['AWS secret access key', /aws_?secret_?(?:access_?)?key['"]?\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi, 1],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255})\b/g, 0],
  ['GitLab token', /\bglpat-[A-Za-z0-9_-]{20,}\b/g, 0],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g, 0],
  ['Google OAuth client secret', /\bGOCSPX-[A-Za-z0-9_-]{28}\b/g, 0],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, 0],
  ['Slack webhook', /https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+/g, 0],
  ['Discord webhook', /https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{20,}/g, 0],
  ['Stripe secret key', /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/g, 0],
  ['Twilio API key', /\bSK[0-9a-f]{32}\b/g, 0],
  ['SendGrid key', /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, 0],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/g, 0],
  ['Hugging Face token', /\bhf_[A-Za-z0-9]{34,}\b/g, 0],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, 0],
  ['OpenAI API key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/g, 0],
  ['Cloudflare API token (labelled)', /cloudflare[_-]?(?:api[_-]?)?(?:token|key)['"]?\s*[:=]\s*['"]?([A-Za-z0-9_-]{37,40})['"]?/gi, 1],
  ['Private key block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g, 0],
  ['JSON Web Token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, 0],
  ['Credentials in URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/'"`]{1,64}:([^\s:@/'"`]{4,128})@[a-z0-9.-]+/gi, 1],
  ['Hard-coded secret assignment', /\b(?:api[_-]?key|apikey|secret(?:[_-]?key)?|client[_-]?secret|access[_-]?token|auth[_-]?token|private[_-]?key|passwd|password|pwd)\b['"]?\s*[:=]\s*['"`]([A-Za-z0-9_\-/+=.!@#$%^&*]{12,})['"`]/gi, 1],
];

const PLACEHOLDER_RE = /(example|sample|placeholder|changeme|change[-_]me|your[-_]|<[^>]+>|\$\{|\{\{|xxxx|\*{4,}|dummy|fake|test|todo|redacted|process\.env|import\.meta|env\.|\.\.\.|0000000)/i;

/** Files that must never be committed. */
const SENSITIVE_NAMES = [
  [/^\.env(\..+)?$/i, (n) => !/\.(example|sample|template|defaults?)$/i.test(n), '.env file'],
  [/\.(pem|key|p12|pfx|jks|keystore|ppk)$/i, () => true, 'private key or keystore file'],
  [/^id_(rsa|dsa|ecdsa|ed25519)$/, () => true, 'SSH private key'],
  [/^(credentials|service-?account.*|client_secret.*|secrets?)\.json$/i, () => true, 'credentials file'],
  [/^\.(npmrc|pypirc|netrc|git-credentials|htpasswd)$/i, () => true, 'credentials dotfile'],
];

export function shannon(s) {
  const f = new Map();
  for (const c of s) f.set(c, (f.get(c) || 0) + 1);
  let h = 0;
  for (const n of f.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function redact(value) {
  const v = String(value);
  return `${v.slice(0, Math.min(4, Math.floor(v.length / 4)))}…[redacted, ${v.length} chars]`;
}

export function sensitiveFileReason(rel) {
  const base = rel.split('/').pop();
  for (const [re, ok, label] of SENSITIVE_NAMES) if (re.test(base) && ok(base)) return label;
  return null;
}

/** Scan text. Returns [{rule, line, redacted, text}]. */
export function scanText(text, { skipLowEntropy = true } = {}) {
  const out = [];
  const lineOf = makeLineFinder(text);
  const lines = text.split('\n');
  for (const [name, re, group] of RULES) {
    const rx = new RegExp(re.source, re.flags);
    for (const m of text.matchAll(rx)) {
      const secret = group ? m[group] : m[0];
      if (!secret) continue;
      const line = lineOf(m.index);
      const src = lines[line - 1] || '';
      if (/audit-ignore:\s*\S+|gitleaks:allow/.test(src)) continue;
      if (name === 'Hard-coded secret assignment' || name === 'Credentials in URL') {
        if (PLACEHOLDER_RE.test(secret)) continue;
        if (name === 'Hard-coded secret assignment' && (/^[A-Za-z_]+$/.test(secret) || /[()]/.test(secret) || /^[A-Z][A-Za-z]+[A-Z][A-Za-z]+$/.test(secret))) continue; // identifiers, camelCase labels, calls
        if (skipLowEntropy && shannon(secret) < 3.0) continue;
      } else if (name === 'OpenAI API key' && (PLACEHOLDER_RE.test(secret) || shannon(secret) < 3.5)) continue;
      else if (name === 'JSON Web Token' && PLACEHOLDER_RE.test(src)) continue;
      out.push({ rule: name, line, redacted: redact(secret), text: truncate(src.replace(secret, redact(secret))) });
    }
  }
  const seen = new Set();
  return out.filter((f) => {
    const k = `${f.line}|${f.redacted}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function listTree(root) {
  if (isGitRepo(root)) {
    const r = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
    if (r.status === 0) {
      const tracked = new Set(git(root, ['ls-files', '-z']).stdout.split('\0').filter(Boolean));
      return { files: r.stdout.split('\0').filter(Boolean).filter((f) => fs.existsSync(path.join(root, f))).map((f) => ({ rel: f, tracked: tracked.has(f) })), git: true };
    }
  }
  return { files: walk(root, { skipDirs: SKIP_DIRS }).map((f) => ({ rel: relPath(root, f), tracked: true })), git: false };
}

export function scanTree(root) {
  const { files, git: inGit } = listTree(root);
  const findings = [];
  let scanned = 0;
  for (const { rel, tracked } of files) {
    if (rel.split('/').some((p) => SKIP_DIRS.has(p))) continue;
    const reason = sensitiveFileReason(rel);
    if (reason) findings.push({ rule: `${tracked ? 'Committed' : inGit ? 'Not git-ignored (would be committed)' : 'Present'} ${reason}`, file: rel, line: 1, redacted: '(file content not shown)', text: '' });
    if (SKIP_EXT.has(path.extname(rel).toLowerCase())) continue;
    const abs = path.join(root, rel);
    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
    const buf = fs.readFileSync(abs);
    if (looksBinary(buf)) continue;
    scanned++;
    for (const f of scanText(buf.toString('utf8'))) findings.push({ ...f, file: rel });
  }
  return { findings, scanned, inGit };
}

/** Scan added lines of every commit on every ref plus every file name ever committed. */
export function scanHistory(root) {
  const findings = [];
  if (!isGitRepo(root)) return { findings, commits: 0, note: 'not a git repository' };
  const commits = git(root, ['rev-list', '--all', '--count']);
  const names = git(root, ['log', '--all', '--name-only', '--pretty=format:commit %H']);
  let sha = '';
  for (const line of (names.stdout || '').split('\n')) {
    if (line.startsWith('commit ')) sha = line.slice(7, 19);
    else if (line.trim()) {
      const reason = sensitiveFileReason(line.trim());
      if (reason) findings.push({ rule: `Committed ${reason} (history)`, file: line.trim(), line: 1, commit: sha, redacted: '(file content not shown)', text: '' });
    }
  }
  const log = git(root, ['log', '--all', '-p', '-U0', '--no-color', '--no-ext-diff', '--pretty=format:commit %H']);
  let file = '';
  sha = '';
  let added = [];
  const flush = () => {
    if (!added.length || !file || SKIP_EXT.has(path.extname(file).toLowerCase())) return;
    const text = added.map((a) => a.text).join('\n');
    for (const f of scanText(text)) findings.push({ ...f, file, line: added[f.line - 1] ? added[f.line - 1].line : 0, commit: sha });
  };
  let lineNo = 0;
  for (const l of (log.stdout || '').split('\n')) {
    if (l.startsWith('commit ')) {
      flush();
      added = [];
      sha = l.slice(7, 19);
      file = '';
    } else if (l.startsWith('+++ ')) {
      flush();
      added = [];
      file = l.startsWith('+++ b/') ? l.slice(6) : '';
    } else if (l.startsWith('@@')) {
      const m = /\+(\d+)/.exec(l);
      lineNo = m ? Number(m[1]) : 0;
    } else if (l.startsWith('+') && !l.startsWith('+++')) {
      added.push({ text: l.slice(1), line: lineNo++ });
    }
  }
  flush();
  const seen = new Set();
  return {
    commits: Number((commits.stdout || '0').trim()) || 0,
    findings: findings.filter((f) => {
      const k = `${f.rule}|${f.file}|${f.redacted}|${f.commit}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
  };
}

/** Try gitleaks. Returns null when it is not installed or failed to run. */
export function runGitleaks(root, { history = false, bin = 'gitleaks' } = {}) {
  const probe = spawnSync(bin, ['version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) return null;
  const report = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pn-gitleaks-')), 'report.json');
  const attempts = history
    ? [['git', root, '--redact', '--no-banner', '--report-format', 'json', '--report-path', report, '--exit-code', '0']]
    : [
        ['dir', root, '--redact', '--no-banner', '--report-format', 'json', '--report-path', report, '--exit-code', '0'],
        ['detect', '--no-git', '--source', root, '--redact', '--no-banner', '--report-format', 'json', '--report-path', report, '--exit-code', '0'],
      ];
  for (const a of attempts) {
    const r = spawnSync(bin, a, { cwd: root, encoding: 'utf8' });
    if (r.error || r.status !== 0) continue;
    let rows = [];
    try {
      rows = JSON.parse(fs.readFileSync(report, 'utf8') || '[]') || [];
    } catch {
      rows = [];
    }
    fs.rmSync(path.dirname(report), { recursive: true, force: true });
    return {
      version: (probe.stdout || '').trim(),
      findings: rows.map((x) => ({ rule: `gitleaks: ${x.RuleID || x.Description}`, file: x.File, line: x.StartLine || 0, commit: x.Commit ? String(x.Commit).slice(0, 12) : undefined, redacted: redact(x.Secret && x.Secret !== 'REDACTED' ? x.Secret : 'REDACTED-by-gitleaks'), text: '' })),
    };
  }
  return null;
}

export function run(argv, { cwd = process.cwd(), log = console.log, errLog = console.error, gitleaksBin = 'gitleaks' } = {}) {
  let args;
  try {
    args = parseArgs(argv, { root: 'string', history: 'bool', builtin: 'bool', json: 'bool', help: 'bool' });
  } catch (e) {
    errLog(e.message);
    return 2;
  }
  if (args.help) {
    log('Usage: node scripts/audit-secrets.mjs [--root DIR] [--history] [--builtin] [--json]');
    return 0;
  }
  const root = path.resolve(cwd, args.root || '.');
  let findings = [];
  const engines = [];
  let scanned = 0;
  let glResult = null;
  if (!args.builtin) glResult = runGitleaks(root, { history: false, bin: gitleaksBin });
  if (glResult) {
    engines.push(`gitleaks ${glResult.version}`);
    findings.push(...glResult.findings);
    // gitleaks does not know our file-name rules: always run them.
    const t = scanTree(root);
    findings.push(...t.findings.filter((f) => /^(Committed|Not git-ignored|Present) /.test(f.rule)));
    scanned = t.scanned;
    if (args.history) {
      const h = runGitleaks(root, { history: true, bin: gitleaksBin });
      if (h) findings.push(...h.findings);
      const hist = scanHistory(root);
      findings.push(...hist.findings.filter((f) => /^(Committed|Not git-ignored|Present) /.test(f.rule)));
    }
  } else {
    engines.push('built-in regex rules' + (args.builtin ? '' : ' (gitleaks not installed)'));
    const t = scanTree(root);
    findings.push(...t.findings);
    scanned = t.scanned;
    if (args.history) {
      const h = scanHistory(root);
      engines.push(`history: ${h.commits} commit(s)${h.note ? `, ${h.note}` : ''}`);
      findings.push(...h.findings);
    }
  }
  const seen = new Set();
  findings = findings.filter((f) => {
    const k = `${f.rule}|${f.file}|${f.line}|${f.commit || ''}|${f.redacted}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const exit = findings.length ? 1 : 0;
  if (args.json) {
    log(JSON.stringify({ root, engines, scanned, findings }, null, 2));
    return exit;
  }
  log('InkQuiet secret scan');
  log(`  project: ${root}`);
  log(`  engine: ${engines.join('; ')}`);
  log(`  scanned ${scanned} text file(s)${args.history ? ' + git history' : ' (add --history to scan past commits)'}`);
  if (findings.length) {
    log('');
    log(`FINDINGS (${findings.length}), values are redacted`);
    for (const f of findings) {
      log(`  ${f.file}:${f.line}${f.commit ? ` @${f.commit}` : ''}  [${f.rule}] ${f.redacted}`);
      if (f.text) log(`      ${f.text}`);
    }
  }
  log(`\nRESULT: ${exit ? 'FAIL' : 'PASS'} (${findings.length} finding(s))`);
  return exit;
}

if (isMain(import.meta.url)) process.exit(run(process.argv.slice(2)));
