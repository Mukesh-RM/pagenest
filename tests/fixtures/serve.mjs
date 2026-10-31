// Minimal static file server for the reference fixture (no dependencies).
// Usage: [SPA=1] node fixtures/serve.mjs <directory> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { resolveE2ePort } from '../../scripts/e2e/resolve-port.mjs';

const root = resolve(process.argv[2] ?? 'fixtures/reference-app');
const port = process.argv[3] !== undefined ? Number(process.argv[3]) : await resolveE2ePort('PAGENEST_PORT');
// Static hosts (Cloudflare Pages, Netlify, ...) compress text assets. Without this the audited transfer size is 3x too big and
// Lighthouse reports a text-compression defect that production does not have.
const compressible = new Set(['.html', '.js', '.css', '.svg', '.webmanifest', '.json']);
const cache = new Map();
function encode(file, body, accept) {
  const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : '';
  if (!enc || !compressible.has(extname(file))) return { body, enc: '' };
  const key = `${enc}:${file}:${body.length}`;
  if (!cache.has(key)) cache.set(key, enc === 'br' ? brotliCompressSync(body) : gzipSync(body, { level: 9 }));
  return { body: cache.get(key), enc };
}

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname));
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, path);
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const found = await stat(file).then((s) => s.isFile(), () => false);
    if (!found) {
      // SPA fallback (BrowserRouter deep links) for extension-less paths only, enabled with SPA=1
      if (process.env.SPA === '1' && !extname(path)) {
        const html = encode('index.html', await readFile(join(root, 'index.html')), String(req.headers['accept-encoding'] ?? ''));
        res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-cache', vary: 'accept-encoding', ...(html.enc ? { 'content-encoding': html.enc } : {}) });
        res.end(html.body);
        return;
      }
      throw new Error('not a file');
    }
    const out = encode(file, await readFile(file), String(req.headers['accept-encoding'] ?? ''));
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache', vary: 'accept-encoding', ...(out.enc ? { 'content-encoding': out.enc } : {}) });
    res.end(out.body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`fixture on http://127.0.0.1:${port}`));
