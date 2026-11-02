// Validates public/manifest.webmanifest, the generated icons and public/_headers. No dependencies.
// Usage: node scripts/pwa/validate-pwa-assets.mjs   (run from the repo root; `npm run validate:pwa`)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pub = (p) => join(root, 'public', p);
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

const pngSize = (file) => {
  const b = readFileSync(file);
  const sig = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return sig ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
};

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const tags = (re) => [...indexHtml.matchAll(re)].map((m) => m[0]);
const metas = tags(/<meta\b[^>]*>/g);
const links = tags(/<link\b[^>]*>/g);
const metaWith = (name) => metas.filter((m) => new RegExp(`name="${name}"`).test(m));

const manifest = JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf8'));
for (const k of ['name', 'short_name', 'start_url', 'scope', 'theme_color', 'background_color', 'categories', 'icons', 'share_target']) {
  check(manifest[k] !== undefined, `manifest.${k} missing`);
}
check(manifest.display === 'standalone', 'display must be standalone');
check(/^#[0-9A-Fa-f]{6}$/.test(manifest.theme_color) && /^#[0-9A-Fa-f]{6}$/.test(manifest.background_color), 'colors must be #RRGGBB');
check(manifest.start_url.startsWith('/') && manifest.scope === '/', 'start_url/scope must be root-relative');

const has = (size, purpose) => manifest.icons.some((i) => i.sizes === size && i.purpose === purpose && i.type === 'image/png');
check(has('192x192', 'any'), 'need 192 any icon');
check(has('512x512', 'any'), 'need 512 any icon');
check(has('512x512', 'maskable'), 'need 512 maskable icon');
for (const icon of manifest.icons) {
  const file = pub(icon.src.replace(/^\//, ''));
  check(existsSync(file), `${icon.src} does not exist`);
  if (icon.type === 'image/png' && existsSync(file)) {
    const s = pngSize(file);
    const want = Number(icon.sizes.split('x')[0]);
    check(s && s.w === want && s.h === want, `${icon.src} is ${s && s.w}x${s && s.h}, manifest says ${icon.sizes}`);
  }
}
const apple = pngSize(pub('apple-touch-icon.png'));
check(apple && apple.w === 180 && apple.h === 180, 'apple-touch-icon.png must be 180x180');
const ico = readFileSync(pub('favicon.ico'));
check(ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= 1, 'favicon.ico header invalid');

check(manifest.short_name.length <= 12, `short_name "${manifest.short_name}" is ${manifest.short_name.length} chars, max 12`);
check(manifest.theme_color.toUpperCase() === '#FAFAF7' && manifest.background_color.toUpperCase() === '#FAFAF7', 'theme_color and background_color must be #FAFAF7 (Decision 3)');
check(/viewport-fit=cover/.test(metaWith('viewport').join('')), 'index.html viewport needs viewport-fit=cover');
const themeColors = metaWith('theme-color');
check(themeColors.some((m) => !/media=/.test(m) && /content="#[0-9A-Fa-f]{6}"/.test(m)), 'index.html needs a default theme-color meta with a hex colour');
check(themeColors.some((m) => /prefers-color-scheme: light/.test(m)), 'index.html needs theme-color for prefers-color-scheme: light');
check(themeColors.some((m) => /prefers-color-scheme: dark/.test(m) && /#17181C/i.test(m)), 'index.html needs theme-color #17181C for prefers-color-scheme: dark');
check(links.some((l) => /rel="apple-touch-icon"/.test(l) && /href="\/apple-touch-icon\.png"/.test(l)), 'index.html needs link rel=apple-touch-icon');
check(links.some((l) => /rel="manifest"/.test(l) && /href="\/manifest\.webmanifest"/.test(l)), 'index.html needs link rel=manifest');
check(metaWith('apple-mobile-web-app-capable').length === 1 || metaWith('mobile-web-app-capable').length >= 1, 'index.html needs a standalone meta tag');
check(metaWith('apple-mobile-web-app-status-bar-style').length === 1, 'index.html needs exactly one apple-mobile-web-app-status-bar-style');
const css = ['src/index.css', 'src/app/theme.css']
  .map((p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : ''))
  .join('\n');
check(/env\(safe-area-inset-top/.test(css) && /env\(safe-area-inset-bottom/.test(css), 'global CSS must use env(safe-area-inset-top) and env(safe-area-inset-bottom)');

const st = manifest.share_target;
check(st.method === 'POST' && st.enctype === 'multipart/form-data', 'share_target must be POST multipart/form-data when sharing files');
check(Array.isArray(st.params.files) && st.params.files[0].accept.length > 0, 'share_target.files.accept missing');
check(st.action.startsWith('/') && st.action.startsWith(manifest.scope), 'share_target.action must be inside scope');

const headers = readFileSync(pub('_headers'), 'utf8');
const csp = /Content-Security-Policy: (.*)/.exec(headers)?.[1] ?? '';
check(/default-src 'self'/.test(csp), "CSP needs default-src 'self'");
check(!/'unsafe-eval'/.test(csp), "CSP must not allow 'unsafe-eval'");
check(/script-src 'self' 'wasm-unsafe-eval'/.test(csp), 'script-src must allow wasm only');
const connect = /connect-src ([^;]+)/.exec(csp)?.[1] ?? '';
check(connect.includes("'self'"), "connect-src must include 'self'");
check(!/\*/.test(connect.replace(/https:\/\/\*\.hf\.co/g, '').replace(/https:\/\/\*\.huggingface\.co/g, '')), 'connect-src must not use bare wildcards');
check(
  connect.includes('https://huggingface.co') && connect.includes('https://*.huggingface.co') && connect.includes('https://*.hf.co'),
  'connect-src must allow approved Hugging Face model hosts',
);
for (const d of ['worker-src', 'media-src', 'img-src', 'font-src', 'connect-src', 'object-src']) check(csp.includes(d), `CSP missing ${d}`);

if (problems.length) { console.error('FAILED:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log(`OK: manifest valid (${manifest.icons.length} icons), icon dimensions match, share target present, CSP configured.`);
