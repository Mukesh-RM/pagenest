import {
  clampPercent,
  compareLocators,
  isLocator,
  isLocatorForMode,
  locatorsEqual,
  type Locator,
} from './index';

const page: Locator = { kind: 'page', page: 3, offset: 0.25 };
const reflow: Locator = { kind: 'reflow', section: 2, textOffset: 120, sentence: 4 };
const audio: Locator = { kind: 'audio', trackIndex: 1, positionSec: 62.5 };

describe('isLocator', () => {
  it('accepts well-formed locators of every kind', () => {
    expect(isLocator(page)).toBe(true);
    expect(isLocator(reflow)).toBe(true);
    expect(isLocator({ ...reflow, cfi: 'epubcfi(/6/4!/4/2)' })).toBe(true);
    expect(isLocator(audio)).toBe(true);
  });

  it('survives a JSON round trip (backup files)', () => {
    for (const l of [page, reflow, audio]) expect(isLocator(JSON.parse(JSON.stringify(l)))).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'page 3'],
    ['unknown kind', { kind: 'chapter', index: 1 }],
    ['page 0', { kind: 'page', page: 0, offset: 0 }],
    ['fractional page', { kind: 'page', page: 1.5, offset: 0 }],
    ['offset above 1', { kind: 'page', page: 1, offset: 1.1 }],
    ['negative section', { kind: 'reflow', section: -1, textOffset: 0 }],
    ['non-integer textOffset', { kind: 'reflow', section: 0, textOffset: 0.5 }],
    ['non-string cfi', { kind: 'reflow', section: 0, textOffset: 0, cfi: 5 }],
    ['negative sentence', { kind: 'reflow', section: 0, textOffset: 0, sentence: -2 }],
    ['negative seconds', { kind: 'audio', trackIndex: 0, positionSec: -1 }],
    ['NaN seconds', { kind: 'audio', trackIndex: 0, positionSec: Number.NaN }],
    ['Infinity seconds', { kind: 'audio', trackIndex: 0, positionSec: Infinity }],
  ])('rejects %s', (_name, value) => {
    expect(isLocator(value)).toBe(false);
  });
});

describe('isLocatorForMode', () => {
  it('matches kinds to modes', () => {
    expect(isLocatorForMode(page, 'read')).toBe(true);
    expect(isLocatorForMode(reflow, 'read')).toBe(true);
    expect(isLocatorForMode(audio, 'listen')).toBe(true);
    expect(isLocatorForMode(reflow, 'aloud')).toBe(true);
    expect(isLocatorForMode(audio, 'read')).toBe(false);
    expect(isLocatorForMode(page, 'aloud')).toBe(false);
    expect(isLocatorForMode(reflow, 'listen')).toBe(false);
  });
});

describe('locatorsEqual', () => {
  it('compares by value', () => {
    expect(locatorsEqual(page, { ...page })).toBe(true);
    expect(locatorsEqual(page, { ...page, offset: 0.5 })).toBe(false);
    expect(locatorsEqual(reflow, { ...reflow, sentence: 5 })).toBe(false);
    expect(locatorsEqual(audio, { ...audio })).toBe(true);
    expect(locatorsEqual(page, audio)).toBe(false);
  });
});

describe('compareLocators', () => {
  it('orders by page, then offset', () => {
    expect(compareLocators(page, { kind: 'page', page: 4, offset: 0 })).toBeLessThan(0);
    expect(compareLocators(page, { kind: 'page', page: 3, offset: 0.1 })).toBeGreaterThan(0);
    expect(compareLocators(page, { ...page })).toBe(0);
  });

  it('orders reflow by section, then text offset, ignoring sentence', () => {
    expect(compareLocators(reflow, { kind: 'reflow', section: 3, textOffset: 0 })).toBeLessThan(0);
    expect(compareLocators(reflow, { kind: 'reflow', section: 2, textOffset: 10 })).toBeGreaterThan(0);
  });

  it('orders audio by track, then seconds', () => {
    expect(compareLocators(audio, { kind: 'audio', trackIndex: 0, positionSec: 900 })).toBeGreaterThan(0);
    expect(compareLocators(audio, { kind: 'audio', trackIndex: 1, positionSec: 70 })).toBeLessThan(0);
  });

  it('refuses to compare different kinds', () => {
    expect(compareLocators(page, reflow)).toBeUndefined();
  });
});

describe('clampPercent', () => {
  it('keeps values in 0 to 100', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(42.5)).toBe(42.5);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(Infinity)).toBe(100);
    expect(clampPercent(-Infinity)).toBe(0);
  });
});
