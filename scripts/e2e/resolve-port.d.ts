declare module '@pagenest/e2e-port' {
  /** Shared fallback when a suite-specific port env is unset (see docs/TESTING.md). */
  export const SHARED_E2E_PORT_ENV: 'PAGENEST_E2E_PORT';
  export function resolveE2ePortFromEnv(suiteEnvVar: string | undefined): number | undefined;
  export function resolveE2ePortFromEnv(suiteEnvVar: string | undefined): number | undefined;
  export function resolveE2ePort(suiteEnvVar: string | undefined, host?: string): Promise<number>;
  export function isE2ePortExplicit(suiteEnvVar: string | undefined): boolean;
}
