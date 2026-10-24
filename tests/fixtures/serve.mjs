// Minimal static file server for the reference fixture (no dependencies).
// Usage: [SPA=1] node fixtures/serve.mjs <directory> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'fixtures/reference-app');
const port = Number(process.argv[3] ?? 4173);
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
        res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-cache' });
        res.end(await readFile(join(root, 'index.html')));
        return;
      }
      throw new Error('not a file');
    }
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`fixture on http://127.0.0.1:${port}`));
