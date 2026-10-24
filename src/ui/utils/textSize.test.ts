import { describe, expect, it } from 'vitest';
import { TEXT_SIZE_DEFAULT, TEXT_SIZE_MAX, TEXT_SIZE_MIN, applyTextSize, clampTextSize, textSizePercent } from './textSize';

describe('text size', () => {
  it('reaches 200% and stops there', () => {
    expect(TEXT_SIZE_MAX / TEXT_SIZE_DEFAULT).toBe(2);
    expect(clampTextSize(99)).toBe(32);
    expect(clampTextSize(1)).toBe(TEXT_SIZE_MIN);
    expect(clampTextSize(Number.NaN)).toBe(16);
    expect(clampTextSize(20.4)).toBe(20);
    expect(textSizePercent(32)).toBe('200%');
    expect(textSizePercent(16)).toBe('100%');
  });

  it('writes the root size and scaled tokens; the smallest token grows at most 15 percent', () => {
    const el = document.createElement('div');
    applyTextSize(32, el);
    expect(el.style.getPropertyValue('--pn-font-size')).toBe('32px');
    expect(el.style.getPropertyValue('--pn-text-md')).toBe('32px');
    expect(el.style.getPropertyValue('--pn-text-xl')).toBe('56px');
    expect(el.style.getPropertyValue('--pn-text-xs')).toBe('14px');
  });
});
