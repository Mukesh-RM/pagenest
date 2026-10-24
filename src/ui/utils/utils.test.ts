import { describe, expect, it, vi } from 'vitest';
import { THEME_NAMES } from '../theme/themes';
import { THEME_PALETTE } from '../theme/palette';
import { tintForTheme } from '../hooks';
import { clampTint, hexToRgb, mix, ratio, rgbToHex, type Rgb } from './color';
import { dominantColor } from './coverColor';
import { flipTransform, playFlip } from './flip';
import { formatClock, formatDuration, formatSpeed, timeLeftLabel } from './time';

describe('time labels', () => {
  it('formats durations in plain words', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(8 * 60)).toBe('8 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3600 + 12 * 60)).toBe('1 h 12 min');
    expect(formatDuration(-5)).toBe('0 s');
    expect(formatDuration(Number.NaN)).toBe('0 s');
  });

  it('formats scrubber clocks', () => {
    expect(formatClock(187)).toBe('3:07');
    expect(formatClock(3600 + 2 * 60 + 9)).toBe('1:02:09');
  });

  it('formats speeds without trailing zeros', () => {
    expect(formatSpeed(1)).toBe('1×');
    expect(formatSpeed(1.25)).toBe('1.25×');
    expect(formatSpeed(1.5)).toBe('1.5×');
  });

  it('time left is at the chosen speed, so it changes with the speed chip', () => {
    const duration = 10 * 3600;
    const position = 2 * 3600;
    expect(timeLeftLabel(duration, position, 1)).toBe('8 h left at 1×');
    expect(timeLeftLabel(duration, position, 2)).toBe('4 h left at 2×');
    expect(timeLeftLabel(duration, position, 1.25)).toBe('6 h 24 min left at 1.25×');
    expect(timeLeftLabel(duration, duration, 1)).toBe('Finished');
    expect(timeLeftLabel(duration, position, 0)).toBe('8 h left at 1×'); // a broken speed falls back to 1×
  });
});

describe('color helpers', () => {
  it('round-trips hex and mixes linearly', () => {
    expect(rgbToHex(hexToRgb('#2f6f6b'))).toBe('#2f6f6b');
    expect(mix([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
    expect(ratio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
  });

  it('clampTint never lets text on the tinted surface fall under 4.5:1', () => {
    const page = hexToRgb('#ffffff');
    const text = hexToRgb('#1c1b19');
    for (const cover of ['#000000', '#ff0000', '#ffff00', '#0033ff'].map(hexToRgb)) {
      const { color, amount } = clampTint({ cover, page, foregrounds: [text], maxAmount: 0.6 });
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(0.6);
      expect(ratio(text, mix(page, color, amount))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('cover tint on every theme', () => {
  const covers: Rgb[] = ['#e63946', '#ffd60a', '#1d3557', '#06d6a0', '#000000', '#ffffff'].map(hexToRgb);
  for (const theme of THEME_NAMES) {
    it(`${theme}: text, muted, link, accent ink and danger stay AA on the tinted surface`, () => {
      const p = THEME_PALETTE[theme];
      const surface = hexToRgb(p['surface-raised']);
      for (const cover of covers) {
        const { color, amount } = tintForTheme(cover, theme);
        const tinted = mix(surface, hexToRgb(color), amount);
        for (const name of ['text', 'muted', 'link', 'accent-ink', 'danger'] as const) {
          expect(ratio(hexToRgb(p[name]), tinted), `${theme} ${name} over ${rgbToHex(cover)}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});

describe('dominantColor', () => {
  const px = (rgb: Rgb, count: number): number[] => Array.from({ length: count }, () => [...rgb, 255]).flat();

  it('picks the saturated majority color and ignores white and black borders', () => {
    const pixels = [...px([255, 255, 255], 200), ...px([0, 0, 0], 100), ...px([38, 70, 83], 60), ...px([233, 196, 106], 20)];
    const color = dominantColor(pixels);
    expect(color).toBeDefined();
    const [r, g, b] = color!;
    expect(Math.abs(r - 38)).toBeLessThan(24);
    expect(Math.abs(g - 70)).toBeLessThan(24);
    expect(Math.abs(b - 83)).toBeLessThan(24);
  });

  it('returns undefined for an empty, transparent or pure white image', () => {
    expect(dominantColor([])).toBeUndefined();
    expect(dominantColor(px([255, 255, 255], 50))).toBeUndefined();
    expect(dominantColor(Array.from({ length: 40 }, () => [10, 100, 200, 0]).flat())).toBeUndefined();
  });
});

describe('FLIP', () => {
  it('maps the final box back onto the first box', () => {
    const first = { left: 10, top: 20, width: 50, height: 75 };
    const last = { left: 100, top: 200, width: 200, height: 300 };
    const t = flipTransform(first, last);
    expect(t.scaleX).toBeCloseTo(0.25);
    expect(t.scaleY).toBeCloseTo(0.25);
    expect(t.x).toBeCloseTo(10 + 25 - (100 + 100));
    expect(t.y).toBeCloseTo(20 + 37.5 - (200 + 150));
  });

  it('animates only transform and opacity, and does nothing without an origin', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 300, right: 200, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
    const animate = vi.fn(() => ({}) as Animation);
    el.animate = animate as unknown as typeof el.animate;
    expect(playFlip(el, undefined, 200)).toBeUndefined();
    playFlip(el, { left: 10, top: 10, width: 50, height: 75 }, 200);
    expect(animate).toHaveBeenCalledTimes(1);
    const frames = (animate.mock.calls[0] as unknown as [Keyframe[]])[0];
    for (const frame of frames) expect(Object.keys(frame).sort()).toEqual(['opacity', 'transform']);
  });

  it('is skipped under reduced motion', () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true');
    const el = document.createElement('div');
    const animate = vi.fn();
    el.animate = animate as unknown as typeof el.animate;
    expect(playFlip(el, { left: 0, top: 0, width: 10, height: 10 }, 200)).toBeUndefined();
    expect(animate).not.toHaveBeenCalled();
    document.documentElement.removeAttribute('data-reduce-motion');
  });
});
