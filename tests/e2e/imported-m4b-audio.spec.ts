import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { skipOnboarding } from './support/app';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const chapteredM4b = readFileSync(
  join(repoRoot, 'src/features/library/e2e/audio-fixtures/chaptered-tale.m4b'),
);

interface Probe {
  paused: boolean;
  currentTime: number;
  duration: number;
  readyState: number;
  error: string | null;
  src: string;
}

async function trackAudioElement(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __audio?: HTMLAudioElement };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLAudioElement) {
      w.__audio = this;
      return play.call(this);
    };
  });
}

const probe = (page: Page): Promise<Probe | null> =>
  page.evaluate(() => {
    const a = (window as unknown as { __audio?: HTMLAudioElement }).__audio;
    return a
      ? {
          paused: a.paused,
          currentTime: a.currentTime,
          duration: a.duration,
          readyState: a.readyState,
          error: a.error ? `${a.error.code}: ${a.error.message}` : null,
          src: a.src,
        }
      : null;
  });

async function importChapteredM4b(page: Page): Promise<string> {
  await page.goto('/');
  await skipOnboarding(page);
  await page.getByRole('button', { name: 'Add books' }).first().click();
  await page.getByTestId('pick-files').setInputFiles({
    name: 'talk.mp3',
    mimeType: 'audio/mpeg',
    buffer: chapteredM4b,
  });
  const card = page.getByRole('button', { name: /Chaptered Tale/i }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page).toHaveURL(/\/listen\//);
  const match = page.url().match(/\/listen\/([^/?#]+)/);
  if (!match?.[1]) throw new Error('Expected listen URL with book id');
  return match[1];
}

test.describe('imported M4B audiobook (OPFS import, not seed)', () => {
  test.beforeEach(async ({ page }) => {
    await trackAudioElement(page);
  });

  test('chaptered M4B plays, shows chapters, and resumes after reload', async ({ page }) => {
    const bookId = await importChapteredM4b(page);
    const player = page.getByRole('region', { name: 'Audio player' });
    await expect(player).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/cannot play|needs imported audio/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Chaptered Tale' })).toBeVisible();
    await expect(page.getByText('Opening tones').first()).toBeVisible();

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => (await probe(page))?.currentTime ?? 0, { timeout: 15_000 }).toBeGreaterThan(0.5);
    const mid = (await probe(page)) as Probe;
    expect(mid.error).toBeNull();
    expect(mid.duration).toBeGreaterThan(15);
    await page.waitForTimeout(2000);
    const beforePause = (await probe(page)) as Probe;
    expect(beforePause.currentTime).toBeGreaterThan(mid.currentTime + 0.5);

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const savedAt = (await probe(page))?.currentTime ?? 0;
    expect(savedAt).toBeGreaterThan(1.5);

    await page.reload();
    await expect(player).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Opening tones').first()).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => (await probe(page))?.currentTime ?? 0, { timeout: 15_000 })
      .toBeGreaterThan(savedAt - 1.5);
    await expect(page).toHaveURL(new RegExp(`/listen/${bookId}`));
  });
});
