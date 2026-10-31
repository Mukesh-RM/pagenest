#!/usr/bin/env node
// InkQuiet privacy audit. Dependency-free, offline.
//
//   node scripts/audit-privacy.mjs              scan src/, index.html, public/, vite config, package.json
//   node scripts/audit-privacy.mjs --strict     warnings also fail
//   node scripts/audit-privacy.mjs --json       machine readable result
//   node scripts/audit-privacy.mjs --root DIR   scan another project folder
//   node scripts/audit-privacy.mjs --allowlist FILE   use another allow-list (default scripts/audit-allowlist.json)
//   node scripts/audit-privacy.mjs --include-tests    also scan *.test.* / tests folders
//
// FAIL: analytics, tracking, ads, payment or login SDKs (dependencies, imports, globals, tracker hosts);
//       external script/link/font/CDN tags; fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon,
//       importScripts, Worker or import() of http(s)/ws(s) hosts that are not same-origin and not allow-listed.
// WARN: network calls whose URL cannot be resolved statically, external URL literals in code,
//       localhost URLs. Silence one reviewed line with a comment: audit-ignore: <reason>.
// Rule source: blueprint sections 4 and 17, .cursor/rules/pagenest.mdc ("No network code except loading the app,
// optional model downloads and the user's own backup file"). Owner: Auditor.
import fs from 'node:fs';
import path from 'node:path';
import { IGNORE_RE, SCRIPTS_DIR, exists, isMain, looksBinary, makeLineFinder, parseArgs, readJson, relPath, truncate, walk } from './audit-lib.mjs';

// ---------------------------------------------------------------- rules

/** [regex on package name, category] */
export const BAD_PACKAGES = [
  // analytics / tracking / monitoring
  [/^(react-ga4?|ga-gtag|vue-gtag|react-gtm-module|react-google-tag-manager|universal-analytics|google-analytics|analytics|use-analytics|@analytics\/.+|@vercel\/(analytics|speed-insights)|@next\/third-parties|@gtm-support\/.+|nuxt-gtag)$/, 'analytics'],
  [/^(analytics-node|@segment\/.+|@segment|mixpanel|mixpanel-browser|amplitude-js|@amplitude\/.+|posthog-js|posthog-node|posthog-react-native|@posthog\/.+)$/, 'analytics'],
  [/^(@sentry\/.+|sentry|raven-js|bugsnag-js|@bugsnag\/.+|rollbar|logrocket|logrocket-react|@logrocket\/.+|@datadog\/browser-.+|@newrelic\/.+|newrelic|@microsoft\/applicationinsights-.+|@elastic\/apm-rum.*|trackjs|@honeycombio\/.+|@opentelemetry\/exporter-.+)$/, 'monitoring/tracking'],
  [/^(hotjar|react-hotjar|@hotjar\/.+|plausible-tracker|@plausible-analytics\/.+|next-plausible|fathom-client|@fathom\/.+|simple-analytics.*|@simpleanalytics\/.+|umami.*|@umami\/.+|react-matomo|@datapunt\/matomo-tracker-.+|matomo-tracker.*|@microsoft\/clarity|react-clarity|smartlook-client|@fullstory\/.+|fullstory|@heap\/.+|heap-api|rudder-sdk-js|@rudderstack\/.+|countly-sdk-web|@june-so\/.+|@statsig\/.+|statsig-js|launchdarkly-.+|@launchdarkly\/.+|@growthbook\/.+|optimizely-.+|@optimizely\/.+|react-facebook-pixel|react-pixel|react-tiktok-pixel|react-linkedin-insight|@mparticle\/.+|@customerio\/.+|customerio-.+|intercom-client|@intercom\/.+|react-intercom|@crisp.+|crisp-sdk-web|@hubspot\/.+|react-hubspot.*|@vercel\/toolbar)$/, 'analytics/tracking'],
  // ads
  [/^(react-adsense|react-google-adsense|@ads\/.+|react-ad-manager|@googleads\/.+|google-ads-.+|cordova-plugin-admob.*|@capacitor-community\/admob|react-native-google-mobile-ads|@react-google-publisher-tag\/.+|react-ads.*|adsbygoogle|nextjs-google-adsense)$/, 'ads'],
  // payments
  [/^(stripe|@stripe\/.+|stripe-js|paypal-rest-sdk|@paypal\/.+|react-paypal-button-v2|braintree|braintree-web.*|razorpay|@razorpay\/.+|@square\/.+|square|squareup|@paddle\/.+|paddle-.+|@lemonsqueezy\/.+|lemonsqueezy.+|mollie.*|@mollieapi\/.+|@adyen\/.+|adyen-.+|@chargebee\/.+|chargebee.*|@revenuecat\/.+|react-native-purchases|@gumroad\/.+|@polar-sh\/.+|coinbase-commerce-node|@coinbase\/.+|react-native-iap|cordova-plugin-purchase|@google-pay\/.+|@react-native-google-pay\/.+|@apple-pay\/.+)$/, 'payments'],
  // login / auth / backend
  [/^(firebase|firebase-admin|@firebase\/.+|reactfire|react-firebase-hooks|auth0|auth0-js|@auth0\/.+|@clerk\/.+|clerk-.+|next-auth|@auth\/.+|@next-auth\/.+|passport(-.+)?|@supabase\/.+|supabase|@okta\/.+|@azure\/msal-.+|msal|amazon-cognito-identity-js|aws-amplify|@aws-amplify\/.+|@aws-sdk\/client-cognito.+|keycloak-js|@react-oauth\/google|react-google-login|react-facebook-login|@greatsumini\/react-facebook-login|react-oauth2-.+|oidc-client(-ts)?|@kinde-oss\/.+|lucia|lucia-auth|better-auth|@workos-inc\/.+|@stytch\/.+|@descope\/.+|@magic-sdk\/.+|@web3auth\/.+|@privy-io\/.+|@propelauth\/.+|@frontegg\/.+|@nhost\/.+|appwrite|pocketbase|parse|@convex-dev\/.+|convex|@trpc\/client|@apollo\/client|graphql-request|socket\.io-client|pusher-js|ably|@ably\/.+|@pusher\/.+|@liveblocks\/.+|y-websocket|@planetscale\/.+|@neondatabase\/.+|@vercel\/(kv|postgres|blob)|@upstash\/.+|mongodb|mongoose|pg|mysql2?|redis|ioredis|@libsql\/client)$/, 'login/backend'],
];

/** Hosts that mean "tracker, ad, payment or login service" when found anywhere in scanned files. */
export const TRACKER_HOSTS = [
  'google-analytics.com', 'analytics.google.com', 'googletagmanager.com', 'googletagservices.com', 'googleadservices.com', 'doubleclick.net', 'googlesyndication.com', 'adservice.google.com', 'pagead2.googlesyndication.com',
  'connect.facebook.net', 'facebook.com/tr', 'analytics.tiktok.com', 'static.ads-twitter.com', 'analytics.twitter.com', 'snap.licdn.com', 'px.ads.linkedin.com', 'ads.linkedin.com', 'bat.bing.com', 'clarity.ms',
  'segment.com', 'segment.io', 'cdn.segment.com', 'mixpanel.com', 'amplitude.com', 'posthog.com', 'sentry.io', 'ingest.sentry.io', 'hotjar.com', 'hotjar.io', 'plausible.io', 'fullstory.com', 'logrocket.com', 'lr-ingest.io', 'heap.io', 'heapanalytics.com',
  'datadoghq.com', 'newrelic.com', 'nr-data.net', 'bugsnag.com', 'rollbar.com', 'matomo.cloud', 'fathom.video', 'usefathom.com', 'simpleanalytics.com', 'umami.is', 'hs-scripts.com', 'hs-analytics.net', 'intercom.io', 'intercomcdn.com', 'crisp.chat', 'cloudflareinsights.com', 'static.cloudflareinsights.com', 'vercel-insights.com', 'vitals.vercel-insights.com',
  'stripe.com', 'js.stripe.com', 'paypal.com', 'paypalobjects.com', 'braintreegateway.com', 'razorpay.com', 'squareup.com', 'paddle.com', 'lemonsqueezy.com', 'checkout.com', 'adyen.com',
  'auth0.com', 'clerk.com', 'clerk.dev', 'clerk.accounts.dev', 'firebaseio.com', 'firebaseapp.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'accounts.google.com', 'appleid.apple.com', 'login.microsoftonline.com', 'okta.com', 'supabase.co', 'supabase.in', 'amazoncognito.com', 'cognito-idp.amazonaws.com',
];

/** External font/CDN hosts: InkQuiet must self-host everything (blueprint 11: "No external requests"). */
export const CDN_HOSTS = [
  'fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net', 'p.typekit.net', 'fonts.adobe.com', 'fast.fonts.net', 'use.fontawesome.com', 'kit.fontawesome.com', 'ka-f.fontawesome.com', 'fonts.bunny.net',
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'ajax.googleapis.com', 'code.jquery.com', 'maxcdn.bootstrapcdn.com', 'stackpath.bootstrapcdn.com', 'cdn.tailwindcss.com', 'esm.sh', 'cdn.skypack.dev', 'ga.jspm.io', 'esm.run', 'cdn.statically.io', 'rawcdn.githack.com', 'cdn.rawgit.com', 'fastly.jsdelivr.net', 'gcore.jsdelivr.net',
];

/** Global names / calls that belong to tracker, ad, payment or login SDKs. */
export const SDK_PATTERNS = [
  [/\bgtag\s*\(\s*['"`](?:config|event|js|consent|set)['"`]/, 'Google Analytics gtag()'],
  [/\b(?:window\.)?dataLayer\s*(?:=|\.push)/, 'Google Tag Manager dataLayer'],
  [/\b_gaq\.push\b|\bga\s*\(\s*['"`](?:create|send)['"`]/, 'Google Analytics (ga.js / analytics.js)'],
  [/\bfbq\s*\(\s*['"`](?:init|track|trackCustom)['"`]/, 'Facebook pixel'],
  [/\b(?:analytics|segment)\.(?:track|identify|page|load)\s*\(/, 'Segment-style analytics call'],
  [/\bmixpanel\.(?:init|track|identify)\s*\(/, 'Mixpanel'],
  [/\bamplitude\.(?:getInstance|init|track|logEvent)\s*\(/, 'Amplitude'],
  [/\bposthog\.(?:init|capture|identify)\s*\(/, 'PostHog'],
  [/\bSentry\.(?:init|captureException|captureMessage)\s*\(/, 'Sentry'],
  [/\bhj\s*\(\s*['"`](?:event|identify|trigger)['"`]|\b_hjSettings\b/, 'Hotjar'],
  [/\bplausible\s*\(\s*['"`]/, 'Plausible'],
  [/\bFS\.(?:identify|event)\s*\(|\b_fs_host\b/, 'FullStory'],
  [/\bclarity\s*\(\s*['"`](?:set|identify|event)['"`]/, 'Microsoft Clarity'],
  [/\(adsbygoogle\s*=\s*window\.adsbygoogle|\badsbygoogle\.push\b|\bgoogletag\.(?:cmd|defineSlot)/, 'Google ads (AdSense / GPT)'],
  [/\bloadStripe\s*\(|\bnew\s+Stripe\s*\(|\bStripe\s*\(\s*['"`]pk_/, 'Stripe'],
  [/\bpaypal\.Buttons\s*\(|\bwindow\.paypal\b/, 'PayPal'],
  [/\bnew\s+PaymentRequest\s*\(/, 'Payment Request API'],
  [/\bnavigator\.credentials\.(?:get|create)\s*\(\s*\{\s*(?:publicKey|federated|identity)/, 'Credential/login API'],
  [/\b(?:getAuth|initializeApp|signInWithPopup|signInWithRedirect|signInWithEmailAndPassword|signInWithCredential|createUserWithEmailAndPassword|onAuthStateChanged)\s*\(/, 'Firebase Auth'],
  [/\bsupabase\.auth\.\w+\s*\(|\bcreateClient\s*\(\s*['"`]https?:\/\/[^'"`]*supabase/, 'Supabase'],
  [/\bnew\s+Auth0Client\s*\(|\bauth0\.WebAuth\s*\(/, 'Auth0'],
  [/\bClerk\.(?:load|signIn|signUp)\b|\bwindow\.Clerk\b/, 'Clerk'],
  [/\bnavigator\.sendBeacon\s*\(/, 'navigator.sendBeacon (beacons are tracking by design; InkQuiet has no use for it)'],
];

const SCANNED_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.mts', '.cts', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.json', '.webmanifest', '.svg', '.vue', '.svelte', '.astro', '.xml', '.txt', '.toml', '.yml', '.yaml']);
const XML_NS_HOSTS = ['www.w3.org', 'w3.org', 'schemas.microsoft.com', 'schemas.openxmlformats.org', 'purl.org', 'xmlns.com', 'ns.adobe.com', 'schema.org', 'json-schema.org', 'www.inkscape.org', 'creativecommons.org', 'sodipodi.sourceforge.net', 'www.sodipodi.org', 'docs.oasis-open.org', 'www.idpf.org', 'localhost'];
const MAX_FILE_BYTES = 3 * 1024 * 1024;

// ---------------------------------------------------------------- helpers

export function loadAllowlist(file) {
  const j = readJson(file) || {};
  const compile = (e) => ({ host: String(e.host).toLowerCase(), pathRe: e.pathRegex ? new RegExp(e.pathRegex) : null, reason: e.reason || '' });
  const allowed = (j.allowedHosts || []).map(compile);
  const warn = (j.warnHosts || []).map(compile);
  for (const e of [...(j.allowedHosts || []), ...(j.warnHosts || [])]) if (!e.host) throw new Error(`${file}: every entry needs a host`);
  return { allowed, warn };
}

function hostMatches(pattern, host) {
  if (pattern.startsWith('*.')) return host.endsWith(pattern.slice(1)) && host.length > pattern.length - 1;
  return host === pattern;
}

function matchList(list, host, pathname) {
  return list.some((e) => hostMatches(e.host, host) && (!e.pathRe || e.pathRe.test(pathname)));
}

const hostIsIn = (host, domains) => domains.some((d) => host === d || host.endsWith(`.${d}`));

/** Parse an absolute or protocol-relative URL literal. Returns null for relative/same-origin. */
export function parseExternalUrl(raw) {
  const s = raw.trim();
  if (/^(\/(?!\/)|\.{1,2}\/|#|\?|data:|blob:|about:|mailto:|tel:)/.test(s) || s === '') return null;
  if (!/^(?:https?:|wss?:|ftp:)?\/\//i.test(s)) return null; // plain relative path like "model.onnx"
  try {
    const u = new URL(s.startsWith('//') ? `https:${s}` : s);
    return { host: u.hostname.toLowerCase(), pathname: u.pathname, protocol: u.protocol, href: u.href };
  } catch {
    return null;
  }
}

/** Decide how a network URL literal is treated: 'ok' | 'warn' | 'fail'. */
export function judgeUrl(raw, allow) {
  const u = parseExternalUrl(raw);
  if (!u) return { level: 'ok' };
  if (matchList(allow.allowed, u.host, u.pathname)) return { level: 'ok', url: u };
  if (matchList(allow.warn, u.host, u.pathname)) return { level: 'warn', url: u, why: 'localhost-style host' };
  return { level: 'fail', url: u, why: `host ${u.host} is not same-origin and not in scripts/audit-allowlist.json` };
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--') || t.startsWith('#');
}

function isTestFile(rel) {
  return /(^|\/)(__tests__|__mocks__|tests?|e2e|fixtures)\//.test(rel) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel);
}

function isVendorFile(rel, text) {
  if (/(^|\/)(vendor|vendors|third[-_]party)\//.test(rel) || /\.min\.(js|css|mjs)$/.test(rel)) return true;
  let max = 0;
  let run = 0;
  for (let i = 0; i < Math.min(text.length, 200000); i++) {
    if (text.charCodeAt(i) === 10) run = 0;
    else if (++run > max) max = run;
  }
  return max > 4000; // minified bundle
}

// ---------------------------------------------------------------- scanning

const CALL_RE = /(?:\bfetch|\bimportScripts|\bimport|\.sendBeacon|\bnew\s+WebSocket|\bnew\s+EventSource|\bnew\s+(?:Shared)?Worker|\bnew\s+Request|\b(?:axios|ky|got|superagent|wretch)(?:\.\w+)?|\$\.(?:ajax|get|post|getJSON|getScript)|\.register|\.(?:addModule|loadScript))\s*\(\s*(?:\{\s*url\s*:\s*)?/g;
const CALL_KIND = (m) => m.replace(/\s*\(\s*(?:\{\s*url\s*:\s*)?$/, '').replace(/\s+/g, ' ');
const XHR_OPEN_RE = /\.open\s*\(\s*['"`][A-Za-z]+['"`]\s*,\s*/g;
const URL_LITERAL_RE = /(['"`])((?:https?:|wss?:)\/\/[^'"`\s]+|\/\/[a-z0-9.-]+\.[a-z]{2,}[^'"`\s]*)\1/gi;
const IMPORT_FROM_RE = /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)(['"`])([^'"`]+)\1/g;

function pkgNameOf(spec) {
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) return null;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export function badPackageCategory(name) {
  for (const [re, cat] of BAD_PACKAGES) if (re.test(name)) return cat;
  return null;
}

/** Scan one file's text. Returns findings [{level, rule, file, line, text, detail}]. */
export function scanText(text, rel, allow, { vendor = false } = {}) {
  const findings = [];
  const lineOf = makeLineFinder(text);
  const lines = text.split('\n');
  const ext = path.extname(rel).toLowerCase();
  const isHtml = ext === '.html' || ext === '.htm';
  const isCss = ['.css', '.scss', '.sass', '.less'].includes(ext);
  const isJson = ['.json', '.webmanifest'].includes(ext);
  const isCode = !isHtml && !isCss && !isJson;

  const ignored = (line) => IGNORE_RE.test(lines[line - 1] || '') || IGNORE_RE.test(lines[line - 2] || '');
  const add = (level, rule, line, detail) => {
    if (ignored(line)) return;
    findings.push({ level, rule, file: rel, line, text: truncate(lines[line - 1] || ''), detail });
  };

  // 1. tracker / CDN hosts anywhere in the file (comments excluded for code files).
  const hostRe = /(?:https?:)?\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})(?::\d+)?(\/[^\s'"`)<>]*)?/gi;
  for (const m of text.matchAll(hostRe)) {
    const line = lineOf(m.index);
    if (!isHtml && !isJson && isCommentLine(lines[line - 1] || '')) continue;
    const host = m[1].toLowerCase();
    const pathname = m[2] || '/';
    if (hostIsIn(host, TRACKER_HOSTS) || (host === 'www.facebook.com' && pathname.startsWith('/tr'))) {
      add('fail', 'tracker-host', line, `tracker, ad, payment or login host ${host}`);
    } else if (hostIsIn(host, CDN_HOSTS)) {
      add('fail', 'external-cdn', line, `external font/CDN host ${host}: self-host the file instead`);
    }
  }
  if (vendor) return dedupe(findings);

  // 2. SDK globals and calls (code, HTML inline scripts).
  if (!isJson) {
    for (const [re, label] of SDK_PATTERNS) {
      const g = new RegExp(re.source, 'g');
      for (const m of text.matchAll(g)) {
        const line = lineOf(m.index);
        if (isCode && isCommentLine(lines[line - 1] || '')) continue;
        add('fail', 'sdk', line, label);
      }
    }
  }

  // 3. bad package imports.
  if (isCode) {
    for (const m of text.matchAll(IMPORT_FROM_RE)) {
      const line = lineOf(m.index);
      if (isCommentLine(lines[line - 1] || '')) continue;
      const name = pkgNameOf(m[2]);
      const cat = name && badPackageCategory(name);
      if (cat) add('fail', 'sdk-import', line, `import of ${name} (${cat})`);
    }
  }

  // 4. HTML tags that make external requests.
  if (isHtml) {
    const tagRe = /<(script|link|img|iframe|video|audio|source|embed|object|form|track|input|frame)\b([^>]*)>/gi;
    for (const m of text.matchAll(tagRe)) {
      const tag = m[1].toLowerCase();
      const attrs = m[2];
      const rel = (/\brel\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1] || '';
      if (tag === 'link' && /^(canonical|alternate|author|license|help|me|next|prev|search|bookmark|external)$/i.test(rel)) continue;
      const attrName = tag === 'link' ? 'href' : tag === 'form' ? 'action' : tag === 'object' ? 'data' : 'src';
      const am = new RegExp(`\\b${attrName}\\s*=\\s*(["']?)([^"'\\s>]+)\\1`, 'i').exec(attrs);
      if (!am) continue;
      const line = lineOf(m.index);
      const j = judgeUrl(am[2], allow);
      if (j.level === 'ok') continue;
      const kind = tag === 'script' ? 'external script tag' : tag === 'link' ? `external <link rel="${rel || '?'}">` : `external <${tag}>`;
      add(j.level === 'warn' ? 'warn' : 'fail', 'external-tag', line, `${kind}: ${j.url.host}`);
    }
  }

  // 5. CSS @import / url().
  if (isCss || isHtml) {
    for (const m of text.matchAll(/(?:@import\s+(?:url\()?|url\(\s*)(['"]?)((?:https?:)?\/\/[^'")\s]+)\1/gi)) {
      const line = lineOf(m.index);
      const j = judgeUrl(m[2], allow);
      if (j.level !== 'ok') add(j.level === 'warn' ? 'warn' : 'fail', 'external-css', line, `CSS pulls ${j.url.host}`);
    }
  }

  if (!isCode) return dedupe(findings);

  // 6. network calls with URL literals / identifiers.
  const consts = new Map();
  for (const m of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])((?:https?:|wss?:)?\/\/[^'"`\s]+)\2/g)) consts.set(m[1], { value: m[3], line: lineOf(m.index) });

  const check = (kind, argStart, callIndex) => {
    const line = lineOf(callIndex);
    if (isCommentLine(lines[line - 1] || '')) return;
    const rest = text.slice(argStart, argStart + 400);
    const lit = /^(['"`])((?:(?!\1)[^\\\n])*)\1/.exec(rest);
    const isDynamicImport = kind === 'import';
    const isRegister = kind === '.register';
    if (lit) {
      const val = lit[2];
      if (val.includes('${')) {
        const prefix = val.slice(0, val.indexOf('${'));
        if (/^(?:https?:|wss?:)?\/\/[^/]*$/i.test(prefix) || /^(?:https?:|wss?:)?\/\/$/i.test(prefix)) add('warn', 'dynamic-url', line, `${kind}() builds the host from a variable: ${truncate(val, 80)}`);
        else if (/^(?:https?:|wss?:)?\/\//i.test(prefix)) {
          const j = judgeUrl(prefix.endsWith('/') ? prefix : `${prefix}/`, allow);
          if (j.level === 'fail') add('fail', 'external-call', line, `${kind}() to ${j.url.host}: ${j.why}`);
          else if (j.level === 'warn') add('warn', 'external-call', line, `${kind}() to ${j.url.host}: ${j.why}`);
        }
        return;
      }
      const j = judgeUrl(val, allow);
      if (j.level === 'fail') add('fail', 'external-call', line, `${kind}() to ${j.url.host}: ${j.why}`);
      else if (j.level === 'warn') add('warn', 'external-call', line, `${kind}() to ${j.url.host}: ${j.why}`);
      return;
    }
    const urlCtor = /^new\s+URL\s*\(\s*(['"`])([^'"`]*)\1/.exec(rest);
    if (urlCtor) {
      if (urlCtor[2].includes('${')) return;
      const j = judgeUrl(urlCtor[2], allow);
      if (j.level === 'fail') add('fail', 'external-call', line, `${kind}(new URL()) to ${j.url.host}: ${j.why}`);
      else if (j.level === 'warn') add('warn', 'external-call', line, `${kind}(new URL()) to ${j.url.host}: ${j.why}`);
      return;
    }
    if (/^new\s+URL\s*\([^)]*import\.meta\.url/.test(rest)) return; // bundler asset or worker URL
    if (isRegister) return; // .register(variable) is too generic to judge
    const id = /^([A-Za-z_$][\w$.]*)/.exec(rest);
    if (id && consts.has(id[1])) {
      const c = consts.get(id[1]);
      const j = judgeUrl(c.value, allow);
      if (j.level === 'fail') add('fail', 'external-call', line, `${kind}(${id[1]}) where ${id[1]} = ${c.value} (line ${c.line}): ${j.why}`);
      else if (j.level === 'warn') add('warn', 'external-call', line, `${kind}(${id[1]}) -> ${c.value}: ${j.why}`);
      return;
    }
    if (kind === 'import' && !isDynamicImport) return;
    if (/^(new\s+URL|`|[A-Za-z_$])/.test(rest)) {
      if (['.sendBeacon'].includes(kind)) return; // already failed by SDK pattern
      if (kind === 'import') {
        if (/^[A-Za-z_$]/.test(rest)) add('warn', 'dynamic-url', line, 'import() of a non-literal specifier: ensure it is a local module');
        return;
      }
      add('warn', 'dynamic-url', line, `${CALL_KIND(kind)}() with a URL that cannot be checked statically: confirm it is same-origin or allow-listed`);
    }
  };

  for (const m of text.matchAll(CALL_RE)) {
    const kind = CALL_KIND(m[0]);
    // `import x from` / `import {` are not calls; CALL_RE requires "(" so only import() matches.
    check(kind, m.index + m[0].length, m.index);
  }
  for (const m of text.matchAll(XHR_OPEN_RE)) check('XMLHttpRequest.open', m.index + m[0].length, m.index);
  // XMLHttpRequest usage without a literal URL still deserves a look.
  for (const m of text.matchAll(/\bnew\s+XMLHttpRequest\b/g)) {
    const line = lineOf(m.index);
    if (!isCommentLine(lines[line - 1] || '')) add('warn', 'xhr-usage', line, 'XMLHttpRequest used: confirm every request is same-origin or allow-listed');
  }
  for (const m of text.matchAll(/\bnew\s+(WebSocket|EventSource)\s*\(\s*[^'"`\s)]/g)) {
    const line = lineOf(m.index);
    if (!isCommentLine(lines[line - 1] || '') && !consts.has((/\(\s*([\w$]+)/.exec(m[0]) || [])[1])) add('warn', 'dynamic-url', line, `new ${m[1]}() with a dynamic URL: confirm it is same-origin or allow-listed`);
  }

  // 7. any other external URL literal in code: review (user-visible links are fine, requests are not).
  const flagged = new Set(findings.filter((f) => f.rule === 'external-call').map((f) => f.line));
  for (const m of text.matchAll(URL_LITERAL_RE)) {
    const line = lineOf(m.index);
    if (flagged.has(line) || isCommentLine(lines[line - 1] || '')) continue;
    const u = parseExternalUrl(m[2]);
    if (!u) continue;
    if (hostIsIn(u.host, TRACKER_HOSTS) || hostIsIn(u.host, CDN_HOSTS)) continue; // reported by rule 1
    if (XML_NS_HOSTS.includes(u.host)) continue;
    if (matchList(allow.allowed, u.host, u.pathname)) continue;
    add('warn', 'external-url-literal', line, `external URL ${u.host} in code: fine for a visible link, not for a request`);
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

/** Check package.json dependency names. */
export function scanPackageJson(pkg, rel = 'package.json', text = '') {
  const findings = [];
  const lines = text.split('\n');
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(pkg[field] || {})) {
      const cat = badPackageCategory(name);
      if (!cat) continue;
      const idx = lines.findIndex((l) => l.includes(`"${name}"`));
      findings.push({ level: 'fail', rule: 'bad-dependency', file: rel, line: idx >= 0 ? idx + 1 : 1, text: truncate(idx >= 0 ? lines[idx] : name), detail: `${field}: ${name} is a ${cat} package` });
    }
  }
  return findings;
}

export function collectTargets(root) {
  const targets = [];
  const addDir = (d) => {
    const p = path.join(root, d);
    if (exists(p)) targets.push(...walk(p));
  };
  addDir('src');
  addDir('public');
  for (const f of ['index.html', 'package.json']) if (exists(path.join(root, f))) targets.push(path.join(root, f));
  for (const f of fs.readdirSync(root)) {
    const isConfig = /^(vite|vitest|workbox|tailwind|postcss)\.config\.[cm]?[jt]s$/.test(f) || /^(vite|workbox)[-.].*config.*\.[cm]?[jt]s$/.test(f);
    if (isConfig || ['manifest.webmanifest', 'manifest.json', '_headers', 'wrangler.toml'].includes(f)) targets.push(path.join(root, f));
  }
  return [...new Set(targets)];
}

export function auditProject(root, { allowlistFile, includeTests = false } = {}) {
  const allow = loadAllowlist(allowlistFile || path.join(exists(path.join(root, 'scripts', 'audit-allowlist.json')) ? path.join(root, 'scripts') : SCRIPTS_DIR, 'audit-allowlist.json'));
  const files = collectTargets(root);
  const findings = [];
  let scanned = 0;
  const skipped = [];
  for (const file of files) {
    const rel = relPath(root, file);
    const ext = path.extname(file).toLowerCase();
    if (!SCANNED_EXT.has(ext) && path.basename(file) !== '_headers') continue;
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
      skipped.push(`${rel} (over ${MAX_FILE_BYTES / 1024 / 1024} MB)`);
      continue;
    }
    const buf = fs.readFileSync(file);
    if (looksBinary(buf)) continue;
    const text = buf.toString('utf8');
    scanned++;
    if (path.basename(file) === 'package.json' && path.dirname(file) === root) {
      let pkg = null;
      try {
        pkg = JSON.parse(text);
      } catch {
        findings.push({ level: 'fail', rule: 'invalid-json', file: rel, line: 1, text: '', detail: 'package.json is not valid JSON' });
      }
      if (pkg) findings.push(...scanPackageJson(pkg, rel, text));
      continue;
    }
    const vendor = isVendorFile(rel, text);
    if (vendor) skipped.push(`${rel} (vendor/minified: only tracker and CDN hosts checked)`);
    findings.push(...scanText(text, rel, allow, { vendor }));
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { root, scanned, skipped, findings, targets: files.map((f) => relPath(root, f)) };
}

// ---------------------------------------------------------------- main

export function run(argv, { cwd = process.cwd(), log = console.log, errLog = console.error } = {}) {
  let args;
  try {
    args = parseArgs(argv, { root: 'string', allowlist: 'string', strict: 'bool', json: 'bool', 'include-tests': 'bool', help: 'bool' });
  } catch (e) {
    errLog(e.message);
    return 2;
  }
  if (args.help) {
    log('Usage: node scripts/audit-privacy.mjs [--root DIR] [--allowlist FILE] [--strict] [--json] [--include-tests]');
    return 0;
  }
  const root = path.resolve(cwd, args.root || '.');
  const res = auditProject(root, { allowlistFile: args.allowlist && path.resolve(cwd, args.allowlist), includeTests: args.includeTests });
  const fails = res.findings.filter((f) => f.level === 'fail');
  const warns = res.findings.filter((f) => f.level === 'warn');
  const exit = fails.length || (args.strict && warns.length) ? 1 : 0;

  if (args.json) {
    log(JSON.stringify({ root, scanned: res.scanned, skipped: res.skipped, failures: fails, warnings: warns }, null, 2));
    return exit;
  }
  log('InkQuiet privacy audit');
  log(`  project: ${root}`);
  log(`  scanned ${res.scanned} file(s) in: ${res.targets.length ? 'src/, public/, index.html, vite config, package.json (where present)' : 'nothing found'}`);
  if (res.targets.length === 0) log('  no app code yet (no src/, public/, index.html or package.json): nothing to scan.');
  for (const s of res.skipped) log(`  skipped: ${s}`);
  const print = (title, list) => {
    if (!list.length) return;
    log('');
    log(title);
    for (const f of list) {
      log(`  ${f.file}:${f.line}  [${f.rule}] ${f.detail}`);
      if (f.text) log(`      ${f.text}`);
    }
  };
  print(`FAILURES (${fails.length})`, fails);
  print(`WARNINGS (${warns.length})${args.strict ? ' (strict: these fail)' : ' (review; do not fail the run)'}`, warns);
  log(`\nRESULT: ${exit ? 'FAIL' : 'PASS'} (${fails.length} failure(s), ${warns.length} warning(s))`);
  return exit;
}

if (isMain(import.meta.url)) process.exit(run(process.argv.slice(2)));
