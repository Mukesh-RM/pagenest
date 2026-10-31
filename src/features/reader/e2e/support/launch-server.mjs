// Playwright webServer entry: serve dist/ on PN_READER_E2E_PORT (set by run-playwright.mjs) or a fresh free port.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFreePort } from './get-port.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..', '..');
const dist = join(root, 'dist');

let port = Number(process.env.PN_READER_E2E_PORT);
if (!Number.isFinite(port) || port <= 0) {
  port = await getFreePort();
  process.env.PN_READER_E2E_PORT = String(port);
  process.env.PN_READER_E2E_BASE_URL = `http://127.0.0.1:${port}/`;
}

const child = spawn(process.execPath, [join(here, 'server.mjs'), dist, String(port)], {
  stdio: 'inherit',
  cwd: root,
});

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
