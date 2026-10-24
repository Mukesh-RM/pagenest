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
