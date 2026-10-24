import { expect, test } from '@playwright/test';
import { THEMES, contrastRatio, relativeLuminance } from '../e2e/support/contrast';

// Blueprint section 5.2 palette. Section 5.2 promises "All text meets WCAG AA contrast (4.5:1 or better)".

test.describe('contrast maths', () => {
  test('matches WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    // #767676 on white is the well known smallest grey that passes 4.5:1.
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.54);
  });

  test('accepts 3 digit hex and rgb() strings', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
    expect(contrastRatio('rgb(255, 255, 255)', 'rgba(0, 0, 0, 1)')).toBeCloseTo(21, 5);
  });
});

test.describe('blueprint 5.2 palette meets WCAG AA', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    test(`${name}: text on page >= 4.5`, () => {
      expect(contrastRatio(t.text, t.page)).toBeGreaterThanOrEqual(4.5);
    });
    test(`${name}: accent on page >= 4.5`, () => {
      expect(contrastRatio(t.accent, t.page)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
