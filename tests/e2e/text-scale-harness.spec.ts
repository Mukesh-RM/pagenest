import { expect, test } from '@playwright/test';
import { applyTextScale, expectTextScaleOk } from './support/layout';
import { launch } from './support/app';
import { textScalePage, type Defect, type Unit } from '../fixtures/text-scale/pages';

// Does the 200% text gate have teeth? The same function the product gate uses (expectTextScaleOk) runs on fixture pages:
// it must pass on a sane layout and fail, for the right reason, on each deliberately broken one, in px, rem and mixed units.
// Needs no app, so it runs in the blocking e2e projects.
const SCALE = 2;
const units: Unit[] = ['px', 'rem', 'mixed'];
const broken: { defect: Defect; expected: RegExp }[] = [
  { defect: 'fixed-width-overflow', expected: /page scrolls horizontally|extends past the right edge/ },
  { defect: 'clipped-height', expected: /text clipped vertically/ },
  { defect: 'clipped-width', expected: /text clipped horizontally/ },
  { defect: 'ignores-text-size', expected: /body text did not scale|text that ignores the text size/ },
];

test.describe('200% text gate: harness self-check (the gate must have teeth)', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 360, height: 740 }); });

  for (const unit of units) {
    test(`${unit} tokens, sane layout: the gate passes and the scale really took effect`, async ({ page }) => {
      await page.setContent(textScalePage(unit, 'none'));
      const r = await expectTextScaleOk(page, `sane ${unit}`, SCALE);
      expect(r.bodyPx / r.baseBodyPx).toBeGreaterThanOrEqual(1.97);
      expect(r.unscaledText).toEqual([]);
      // px tokens must be overridden, rem tokens must follow the root: both are scaled, whichever unit is used
      const by = Object.fromEntries(r.tokens.map((t) => [t.name, t]));
      for (const t of r.tokens) expect(t.afterPx / t.beforePx, `${t.name} (${t.how})`).toBeGreaterThanOrEqual(1.95);
      if (unit === 'px') expect(by['--app-text-md']!.how).toBe('overridden (px)');
      if (unit === 'rem') { expect(by['--app-text-md']!.how).toBe('follows root font size (rem/em)'); expect(Object.keys(by)).not.toContain('--app-font-size'); }
      if (unit === 'mixed') { expect(by['--app-text-md']!.how).toBe('follows root font size (rem/em)'); expect(by['--app-text-sm']!.how).toBe('overridden (px)'); }
    });

    for (const { defect, expected } of broken) {
      test(`${unit} tokens, ${defect}: the gate FAILS`, async ({ page }) => {
        await page.setContent(textScalePage(unit, defect));
        await expect(expectTextScaleOk(page, `${defect} ${unit}`, SCALE)).rejects.toThrow(expected);
      });
    }
  }

  test('the broken layouts are fine at 100% (the failures come from the text size, not from a broken fixture)', async ({ page }) => {
    for (const { defect } of broken.filter((b) => b.defect !== 'ignores-text-size')) {
      await page.setContent(textScalePage('px', defect));
      const r = await applyTextScale(page, 1);
      expect(r.bodyPx).toBe(r.baseBodyPx);
      await expect(expectTextScaleOk(page, `${defect} at 100%`, 1)).resolves.toBeDefined();
    }
  });

  // The real app after "switching to rem tokens": apply-theme.ts writes the --pn-text-* tokens inline in px, so the test
  // rewrites those inline values to the same sizes in rem. applyTextScale must still scale them (now by following the root).
  test('real app with its text tokens switched from px to rem: applyTextScale still scales every token', async ({ page }) => {
    await launch(page);
    const switched = await page.evaluate(() => {
      const root = document.documentElement; const out: string[] = [];
      for (const n of ['xs', 'sm', 'md', 'lg', 'xl']) {
        const px = parseFloat(getComputedStyle(root).getPropertyValue(`--pn-text-${n}`));
        root.style.setProperty(`--pn-text-${n}`, `${px / 16}rem`); out.push(`${n}=${px / 16}rem`);
      }
      return out;
    });
    expect(switched).toHaveLength(5);
    const r = await applyTextScale(page, SCALE);
    const text = r.tokens.filter((t) => t.name.startsWith('--pn-text-'));
    expect(text, 'the five --pn-text-* tokens were found').toHaveLength(5);
    expect(text.map((t) => t.how), JSON.stringify(text)).toEqual(text.map(() => 'follows root font size (rem/em)'));
    expect(r.tokens.find((t) => t.name === '--pn-font-size')?.how, '--pn-font-size stays a px token and is overridden').toBe('overridden (px)');
    for (const t of r.tokens) expect(t.afterPx / t.beforePx, `${t.name} (${t.how})`).toBeGreaterThanOrEqual(1.95);
    expect(r.bodyPx / r.baseBodyPx).toBeGreaterThanOrEqual(1.97);
  });
});
