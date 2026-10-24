import { expect, type Locator, type Page } from '@playwright/test';

export async function expectVisibleAndNotClipped(locator: Locator, page: Page): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.width).toBeGreaterThan(2);
  expect(box.height).toBeGreaterThan(2);
  const vp = page.viewportSize();
  if (!vp) return;
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 2);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 2);
  const text = (await locator.innerText()).trim();
  expect(text.length).toBeGreaterThan(0);
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export async function expectNoVerticalOverlap(a: Locator, b: Locator): Promise<void> {
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  expect(boxA).not.toBeNull();
  expect(boxB).not.toBeNull();
  if (!boxA || !boxB) return;
  expect(overlaps(boxA, boxB)).toBe(false);
}
