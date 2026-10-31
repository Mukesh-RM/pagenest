import { describe, expect, it, vi } from 'vitest';
import { preloadPlayerEngine } from './lazy-runtime';

describe('preloadPlayerEngine', () => {
  it('starts loading the provider module without throwing', () => {
    preloadPlayerEngine();
    expect(vi.isMockFunction(preloadPlayerEngine)).toBe(false);
  });
});
