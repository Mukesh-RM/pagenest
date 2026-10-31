// Tiny static server for the built app (dist/), used only by the service worker e2e tests.
// GET /__bump makes every later /sw.js response differ by one comment, which the browser treats as a new version.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { resolveE2ePort } from '../../../scripts/e2e/resolve-port.mjs';

const dist = resolve(process.argv[2] ?? 'dist');
const port = process.argv[3] !== undefined ? Number(process.argv[3]) : await resolveE2ePort('PAGENEST_SW_PORT');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};
let version = 1;

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname === '/__bump') {
    version += 1;
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end(String(version));
    return;
  }
  if (req.method === 'POST') {
    // Static hosting has no handler for POST: only the service worker may answer it.
    res.writeHead(405, { 'Content-Type': 'text/plain' }).end('no service worker handled this POST');
    return;
  }
  let file = resolve(join(dist, pathname));
  if (!file.startsWith(dist + sep) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  let body = readFileSync(file);
  if (pathname === '/sw.js') body = Buffer.concat([body, Buffer.from(`\n/* e2e version ${version} */`)]);
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(body);
}).listen(port, '127.0.0.1', () => console.log(`serving ${dist} on ${port}`));
