import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * An imported audiobook plays. Real MP3 and M4B files (synthetic tones made by audio-fixtures/make-audio-fixtures.sh)
 * go through the real import path into OPFS; a tap on the book, then Listen, then Play, must make the audio element play.
 * Runs against the whole app, so it covers the Library's `loadAudioItem` and the player's wiring of it.
 */
const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): Buffer => readFileSync(join(here, 'audio-fixtures', name));

interface Probe {
  paused: boolean;
  currentTime: number;
  duration: number;
  readyState: number;
  error: string | null;
  src: string;
}

async function skipOnboarding(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: /^skip$/i });
  const nav = page.getByRole('navigation', { name: /primary|main|tabs/i }).first();
  await expect(skip.or(nav).first()).toBeVisible();
  if (await skip.isVisible()) {
    await skip.click();
    await expect(nav).toBeVisible();
  }
}

/** The player's audio element is not in the page, so remember it when it is asked to play. */
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
      ? { paused: a.paused, currentTime: a.currentTime, duration: a.duration, readyState: a.readyState, error: a.error ? `${a.error.code}: ${a.error.message}` : null, src: a.src }
      : null;
  });

async function importAndListen(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, title: string): Promise<void> {
  await page.goto('/');
  await skipOnboarding(page);
  await page.getByRole('button', { name: 'Add books' }).first().click();
  await page.getByTestId('pick-files').setInputFiles(file);
  const card = page.getByRole('button', { name: new RegExp(title) }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page).toHaveURL(/\/listen\//);
}

async function expectPlays(page: Page): Promise<Probe> {
  const player = page.getByRole('region', { name: 'Audio player' });
  await expect(player.or(page.getByText('Cannot play yet'))).toBeVisible({ timeout: 30_000 });
  await expect(player).toBeVisible();
  // The old failure: the player said it could not play a book that was not the review seed.
  await expect(page.getByText(/cannot play|could not be opened|needs imported audio/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await probe(page))?.currentTime ?? 0, { timeout: 15_000 }).toBeGreaterThan(0.5);
  const first = (await probe(page)) as Probe;
  await page.waitForTimeout(1500);
  const second = (await probe(page)) as Probe;
  expect(second.paused).toBe(false);
  expect(second.error).toBeNull();
  expect(second.readyState).toBeGreaterThanOrEqual(2);
  expect(second.currentTime).toBeGreaterThan(first.currentTime + 0.5);
  expect(second.duration).toBeGreaterThan(15);
  expect(second.src.startsWith('blob:')).toBe(true);
  await expect(page.getByText(/cannot play|could not be opened|needs imported audio/i)).toHaveCount(0);
  return second;
}

test.beforeEach(async ({ page }) => {
  await trackAudioElement(page);
});

test('an MP3 with an odd name and a wrong type plays from the Library\'s Listen button', async ({ page }) => {
  await importAndListen(page, { name: 'weird name (2).dat', mimeType: 'application/octet-stream', buffer: fixture('tone-book.mp3') }, 'Tone Book');
  await expectPlays(page);
  await expect(page.getByRole('heading', { name: 'Tone Book' })).toBeVisible();
});

test('an M4B with chapters, named like an MP3, plays and shows its chapters', async ({ page }) => {
  await importAndListen(page, { name: 'talk.mp3', mimeType: 'audio/mpeg', buffer: fixture('chaptered-tale.m4b') }, 'Chaptered Tale');
  await expectPlays(page);
  await expect(page.getByRole('heading', { name: 'Chaptered Tale' })).toBeVisible();
  await expect(page.getByText('Opening tones').first()).toBeVisible();
});

test('the mini-player keeps playing after leaving the player for the Library', async ({ page }) => {
  await importAndListen(page, { name: 'tone-book.mp3', mimeType: 'audio/mpeg', buffer: fixture('tone-book.mp3') }, 'Tone Book');
  const first = await expectPlays(page);
  await page.getByRole('button', { name: 'Minimize player' }).click();
  const mini = page.getByRole('region', { name: 'Mini player' });
  await expect(mini).toBeVisible();
  await page.waitForTimeout(1200);
  const later = (await probe(page)) as Probe;
  expect(later.paused).toBe(false);
  expect(later.currentTime).toBeGreaterThan(first.currentTime);
});
