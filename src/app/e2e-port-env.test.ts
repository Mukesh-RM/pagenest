// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { resolveE2ePort, resolveE2ePortFromEnv, isE2ePortExplicit, SHARED_E2E_PORT_ENV } from '@pagenest/e2e-port';

const SUITE = 'PAGENEST_TEST_SUITE_PORT';

afterEach(() => {
  delete process.env[SUITE];
  delete process.env[SHARED_E2E_PORT_ENV];
});

describe('resolveE2ePort', () => {
  it('prefers the suite env over the shared env', () => {
    process.env[SUITE] = '8765';
    process.env[SHARED_E2E_PORT_ENV] = '8766';
    expect(resolveE2ePortFromEnv(SUITE)).toBe(8765);
  });

  it('falls back to PAGENEST_E2E_PORT', async () => {
    process.env[SHARED_E2E_PORT_ENV] = '8766';
    expect(await resolveE2ePort(SUITE)).toBe(8766);
  });

  it('allocates a free port when nothing is set', async () => {
    const port = await resolveE2ePort(SUITE);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });

  it('marks explicit ports for strictPort', () => {
    expect(isE2ePortExplicit(SUITE)).toBe(false);
    process.env[SHARED_E2E_PORT_ENV] = '9001';
    expect(isE2ePortExplicit(SUITE)).toBe(true);
  });
});
