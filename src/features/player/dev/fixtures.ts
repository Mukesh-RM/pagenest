import { audioItemFromFolder, audioItemFromSingleFile } from '@/engines/audio';
import type { AudioController } from '@/engines/audio/types';
import toneUrl from '../fixtures/short-tone.wav?url';

export const DEV_FIXTURE_BOOK_ID = 'dev-fixture-audio';

const TONE_DURATION_SEC = 1.2;

async function fetchToneBlob(): Promise<Blob> {
  const res = await fetch(toneUrl);
  return res.blob();
}

/**
 * Load a tiny public-domain tone for local development until Library import lands.
 * Tree-shaken from production (`import.meta.env.DEV` guard required at call site).
 */
export async function loadDevAudioFixture(controller: AudioController): Promise<void> {
  const blob = await fetchToneBlob();
  const item = audioItemFromFolder(
    DEV_FIXTURE_BOOK_ID,
    'PageNest test tone',
    [
      { blob, fileName: '01-chapter-one.wav', durationSec: TONE_DURATION_SEC, trackNumber: 1 },
      {
        blob: await fetchToneBlob(),
        fileName: '02-chapter-two.wav',
        durationSec: TONE_DURATION_SEC,
        trackNumber: 2,
      },
    ],
    [],
    { author: 'PageNest QA', narrator: 'Synthetic tone' },
  );
  await controller.load(item);
}

export async function loadDevSingleFileFixture(controller: AudioController): Promise<void> {
  const blob = await fetchToneBlob();
  const item = audioItemFromSingleFile(
    DEV_FIXTURE_BOOK_ID,
    'Single file tone',
    async () => blob,
    TONE_DURATION_SEC,
    [
      { index: 0, title: 'Opening', startSec: 0 },
      { index: 1, title: 'Closing', startSec: 0.6 },
    ],
    { author: 'PageNest QA' },
  );
  await controller.load(item);
}
