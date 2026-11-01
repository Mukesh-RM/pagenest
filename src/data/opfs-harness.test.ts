// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isOpfsHarnessDisabled, openOpfsRoot } from './opfs';

describe('isOpfsHarnessDisabled', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('is false by default', () => {
    expect(isOpfsHarnessDisabled()).toBe(false);
  });

  it('reads ?pn_no_opfs=1', () => {
    window.history.replaceState({}, '', '/?pn_no_opfs=1');
    expect(isOpfsHarnessDisabled()).toBe(true);
  });

  it('reads sessionStorage pn_no_opfs', () => {
    sessionStorage.setItem('pn_no_opfs', '1');
    expect(isOpfsHarnessDisabled()).toBe(true);
  });
});

describe('openOpfsRoot', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('returns undefined without calling getDirectory when harness is on', async () => {
    sessionStorage.setItem('pn_no_opfs', '1');
    const getDirectory = vi.fn(async () => ({}));
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { getDirectory },
    });
    await expect(openOpfsRoot()).resolves.toBeUndefined();
    expect(getDirectory).not.toHaveBeenCalled();
  });
});
