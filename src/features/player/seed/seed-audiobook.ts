import { audioItemFromFolder } from '@/engines/audio';
import type { AudioController } from '@/engines/audio/types';
import type { PageNestDB } from '@/data/db';
import type { BookRecord } from '@/data/schema';
import openingAsset from '../fixtures/seed/01-opening.wav?url';
import middleAsset from '../fixtures/seed/02-middle.wav?url';
import closingAsset from '../fixtures/seed/03-closing.wav?url';
import coverAsset from '../fixtures/seed/cover.png?url';

/** Stable id for Playwright and design review (query `?pn_seed_audio=1` seeds the library). */
export const SEED_AUDIO_BOOK_ID = 'pn-review-seed-audiobook';

const CHAPTER_SEC = 0.8;

const SEED_TITLE =
  'The Extraordinarily Long Title Of A Synthetic Audiobook Used For Layout And Screenshot Review';

async function loadFixtureFile(url: string, vitestName: string): Promise<Blob> {
  if (import.meta.env.VITEST) {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    return new Blob([readFileSync(join(process.cwd(), 'src/features/player/fixtures/seed', vitestName))]);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load seed fixture ${vitestName}`);
  return res.blob();
}

export async function loadReviewSeedAudiobook(controller: AudioController): Promise<void> {
  const [opening, middle, closing, cover] = await Promise.all([
    loadFixtureFile(openingAsset, '01-opening.wav'),
    loadFixtureFile(middleAsset, '02-middle.wav'),
    loadFixtureFile(closingAsset, '03-closing.wav'),
    loadFixtureFile(coverAsset, 'cover.png'),
  ]);
  const item = audioItemFromFolder(
    SEED_AUDIO_BOOK_ID,
    SEED_TITLE,
    [
      { blob: opening, fileName: '01-opening.wav', durationSec: CHAPTER_SEC, trackNumber: 1 },
      { blob: middle, fileName: '02-middle.wav', durationSec: CHAPTER_SEC, trackNumber: 2 },
      { blob: closing, fileName: '03-closing.wav', durationSec: CHAPTER_SEC, trackNumber: 3 },
    ],
    [
      { index: 0, title: 'Opening tones', startSec: 0 },
      { index: 1, title: 'Middle passage', startSec: CHAPTER_SEC },
      { index: 2, title: 'Closing tones', startSec: CHAPTER_SEC * 2 },
    ],
    { author: 'InkQuiet QA', narrator: 'Synthetic waveform', cover },
  );
  await controller.load(item);
}

/** Inserts the seed book record when `?pn_seed_audio=1` is present (production-safe, idempotent). */
export async function ensureSeedAudiobookBookRecord(db: PageNestDB): Promise<void> {
  const existing = await db.books.get(SEED_AUDIO_BOOK_ID);
  if (existing) return;
  const book: BookRecord = {
    id: SEED_AUDIO_BOOK_ID,
    fingerprint: 'pn-seed-audiobook-cc0',
    kind: 'audio',
    format: 'wav',
    title: SEED_TITLE,
    author: 'InkQuiet QA',
    narrator: 'Synthetic waveform',
    durationSec: CHAPTER_SEC * 3,
    addedAt: Date.now(),
    favorite: false,
    finished: false,
  };
  await db.books.put(book);
}

export function isSeedAudiobookRequest(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('pn_seed_audio') === '1';
}
