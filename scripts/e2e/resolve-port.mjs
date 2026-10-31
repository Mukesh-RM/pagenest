import net from 'node:net';

/** Shared fallback when a suite-specific port env is unset (see docs/TESTING.md). */
export const SHARED_E2E_PORT_ENV = 'PAGENEST_E2E_PORT';

/**
 * @param {string | undefined} envVar
 * @returns {number | undefined}
 */
function readPortEnv(envVar) {
  const raw = process.env[envVar];
  if (raw === undefined || String(raw).trim() === '') return undefined;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${envVar} must be a TCP port (1–65535), got ${JSON.stringify(raw)}`);
  }
  return port;
}

/**
 * Reads suite env then {@link SHARED_E2E_PORT_ENV}. Returns undefined when both are unset.
 *
 * @param {string | undefined} suiteEnvVar
 * @returns {number | undefined}
 */
export function resolveE2ePortFromEnv(suiteEnvVar) {
  for (const name of [suiteEnvVar, SHARED_E2E_PORT_ENV].filter(Boolean)) {
    const port = readPortEnv(name);
    if (port !== undefined) return port;
  }
  return undefined;
}

/** Env key: ephemeral port chosen once per process tree (Playwright reloads config in workers). */
const EPHEMERAL_ENV = 'PAGENEST_RESOLVED_EPHEMERAL_PORT';

/**
 * Port for Playwright `webServer`, static e2e servers, and `vite preview`.
 * Resolution order: `suiteEnvVar` (if provided) → {@link SHARED_E2E_PORT_ENV} → ephemeral free port on `host`.
 *
 * @param {string | undefined} suiteEnvVar
 * @param {string} [host]
 * @returns {Promise<number>}
 */
export async function resolveE2ePort(suiteEnvVar, host = '127.0.0.1') {
  const fromEnv = resolveE2ePortFromEnv(suiteEnvVar);
  if (fromEnv !== undefined) return fromEnv;
  const cached = process.env[EPHEMERAL_ENV];
  if (cached !== undefined && cached !== '') {
    const port = Number(cached);
    if (Number.isInteger(port) && port >= 1 && port <= 65535) return port;
  }
  const port = await pickFreePort(host);
  process.env[EPHEMERAL_ENV] = String(port);
  return port;
}

/** True when the suite env or {@link SHARED_E2E_PORT_ENV} is set (use `--strictPort` on preview/vite). */
export function isE2ePortExplicit(suiteEnvVar) {
  return resolveE2ePortFromEnv(suiteEnvVar) !== undefined;
}

/** @param {string} host */
function pickFreePort(host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Could not allocate a free port'));
        return;
      }
      const { port } = addr;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}
