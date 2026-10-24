import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// Blueprint 19 quality gate: "contrast checks on every theme"; blueprint 5.8: accessibility rules.
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Violations = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'];

export function summarize(violations: Violations): string {
  return violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `  ${n.target.join(' ')}`).join('\n')}`)
    .join('\n');
}

/** Contrast hook: axe's color-contrast rule only, on whatever is currently on screen. */
export async function expectNoContrastViolations(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(violations, `${label}\n${summarize(violations)}`).toEqual([]);
}

/** Axe with the full WCAG A and AA rule set. */
export async function expectNoA11yViolations(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(violations, `${label}\n${summarize(violations)}`).toEqual([]);
}

/**
 * WCAG 2.5.3 "Label in Name": a control's accessible name (aria-label) must contain its visible text, or speech-control
 * users cannot say what they see. axe's `label-content-name-mismatch` rule is experimental (off by default), so it is
 * enabled explicitly. Lighthouse reports the same rule under best practices.
 */
export async function expectLabelInName(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).options({ runOnly: { type: 'rule', values: ['label-content-name-mismatch'] } }).analyze();
  const nodes = violations.flatMap((v) => v.nodes);
  const lines: string[] = [];
  for (const n of nodes.slice(0, 6)) {
    const sel = n.target[n.target.length - 1];
    const visible = typeof sel === 'string' ? await page.evaluate((q) => (document.querySelector(q) as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ').trim() ?? '', sel).catch(() => '') : '';
    lines.push(`  ${n.target.join(' ')}\n    ${n.html.slice(0, 160)}\n    visible text: "${visible}"`);
  }
  const detail = `${lines.join('\n')}${nodes.length > 6 ? `\n  ... and ${nodes.length - 6} more` : ''}`;
  expect(nodes.length, `${label}: ${nodes.length} control(s), visible text is missing from the accessible name (aria-label must contain the visible text)\n${detail}`).toBe(0);
}
