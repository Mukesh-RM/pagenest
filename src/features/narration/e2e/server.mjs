import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const port = Number(process.argv[2] || 4173);
const dist = resolve(process.cwd(), process.argv[3] || 'dist');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
};

createServer((req, res) => {
  const pathname = (req.url ?? '/').split('?')[0] ?? '/';
  let file = join(dist, pathname === '/' ? 'narration-e2e.html' : pathname.replace(/^\//, ''));
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(dist, 'narration-e2e.html');
  }
  const type = types[extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`narration e2e: ${dist} on ${port}`));
