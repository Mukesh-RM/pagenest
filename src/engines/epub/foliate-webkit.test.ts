// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { isWebKitEngine, watchUnsandboxFoliateIframes } from './foliate-webkit';

describe('isWebKitEngine', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
  });

  it('detects Mobile Safari', () => {
    expect(isWebKitEngine()).toBe(true);
  });

  it('does not treat Chrome as WebKit', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    expect(isWebKitEngine()).toBe(false);
  });
});

describe('watchUnsandboxFoliateIframes', () => {
  it('removes sandbox from iframes under the host', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1',
    });
    const host = document.createElement('div');
    document.body.append(host);
    const stop = watchUnsandboxFoliateIframes(host);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    host.append(iframe);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    expect(iframe.hasAttribute('sandbox')).toBe(false);
    stop();
    host.remove();
  });
});
