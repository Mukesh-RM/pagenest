// Static server for the built app (dist/) used by the reader e2e tests.
//  - Sends the Content-Security-Policy and other headers from public/_headers (the `/` document rule) on HTML only,
//    under the same CSP as production: no inline scripts, blob: frames and workers only.
//  - Serves module workers (.mjs) and wasm with the right MIME types, like real static hosts.
//  - Supports HTTP Range requests.
//  - GET /__fixture/<name> serves a file from src/features/reader/fixtures, or the 50 MB synthetic PDF as "large.pdf".
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { resolveE2ePort } from '../../../../scripts/e2e/resolve-port.mjs';
import { LARGE_PDF, ensureLargePdf, FIXTURE_DIR } from './fixtures.mjs';

const dist = resolve(process.argv[2] ?? 'dist');
const port = process.argv[3] !== undefined ? Number(process.argv[3]) : await resolveE2ePort('PAGENEST_READER_PORT');
const root = resolve(dist, '..');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
};

/** Headers of the first `/` rule in _headers (document shell only). */
function documentHeaders() {
  const text = readFileSync(join(root, 'public', '_headers'), 'utf8');
  const headers = {};
  let inGlobal = false;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line) && !line.startsWith('#')) inGlobal = line.trim() === '/';
    else if (inGlobal && /^\s+\S+:/.test(line)) {
      const i = line.indexOf(':');
      headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    } else if (inGlobal && /^\S/.test(line)) break;
  }
  return headers;
}
const docHeaders = documentHeaders();

function send(req, res, file, extra = {}) {
  const size = statSync(file).size;
  const type = types[extname(file)] ?? 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  const isHtml = type.startsWith('text/html');
  const headers = {
    ...(isHtml ? docHeaders : {}),
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': isHtml ? 'no-cache' : 'no-cache',
    ...extra,
  };
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname.startsWith('/__fixture/')) {
    const name = decodeURIComponent(pathname.slice('/__fixture/'.length));
    const file = name === 'large.pdf' ? LARGE_PDF : resolve(FIXTURE_DIR, name);
    if (!(file === LARGE_PDF || file.startsWith(FIXTURE_DIR + sep)) || (file !== LARGE_PDF && !existsSync(file))) {
      res.writeHead(404).end();
      return;
    }
    if (file === LARGE_PDF) ensureLargePdf(); // built on first request via the Node fixture tool
    send(req, res, file, { 'Cache-Control': 'no-store' });
    return;
  }
  let file = resolve(join(dist, pathname));
  if (!file.startsWith(dist + sep) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  send(req, res, file);
}).listen(port, '127.0.0.1', () => console.log(`serving ${dist} on ${port}`));
