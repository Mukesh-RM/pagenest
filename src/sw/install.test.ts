import { describe, expect, it } from 'vitest';
import { isIosSafari, isStandalone } from './install';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

describe('isIosSafari', () => {
  it('detects Safari on iPhone', () => expect(isIosSafari(IPHONE_SAFARI)).toBe(true));
  it('detects Safari on iPadOS (Mac user agent with touch)', () => {
    expect(isIosSafari(IPAD_SAFARI, 5)).toBe(true);
    expect(isIosSafari(IPAD_SAFARI, 0)).toBe(false); // a real Mac
  });
  it('ignores other iOS browsers and Android', () => {
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME)).toBe(false);
  });
});

describe('isStandalone', () => {
  const win = (standalone: boolean | undefined, displayMode: boolean) =>
    ({
      navigator: { standalone },
      matchMedia: () => ({ matches: displayMode }),
    }) as unknown as Window;
  it('is true for iOS standalone', () => expect(isStandalone(win(true, false))).toBe(true));
  it('is true for display-mode: standalone', () => expect(isStandalone(win(undefined, true))).toBe(true));
  it('is false in a browser tab', () => expect(isStandalone(win(false, false))).toBe(false));
});
