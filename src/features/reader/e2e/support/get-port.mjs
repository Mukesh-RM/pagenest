import { createServer } from 'node:net';

/** First free TCP port on 127.0.0.1 (port 0). */
export function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}
