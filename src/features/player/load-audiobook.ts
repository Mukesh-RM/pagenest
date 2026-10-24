import type { Locator } from '@/app/contracts';
import type { AudioController } from '@/engines/audio/types';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import type { AudioItemSource } from '@/features/library/audio-item';
import { DEV_FIXTURE_BOOK_ID, loadDevAudioFixture } from './dev/fixtures';
import { loadReviewSeedAudiobook, SEED_AUDIO_BOOK_ID } from './seed/seed-audiobook';

export type LoadAudiobookResult =
  | { ok: true; welcome?: ResumeInfo }
  | { ok: false; message: string; devFixtureAvailable: boolean };

/**
 * Prepare the controller for `book`. Does not start playback (user gesture required).
 */
export async function loadAudiobookForBook(
  controller: AudioController,
  book: BookRecord,
  position: ResumeInfo | undefined,
  data?: AudioItemSource,
): Promise<LoadAudiobookResult> {
  if (book.id === SEED_AUDIO_BOOK_ID) {
    await loadReviewSeedAudiobook(controller);
    return { ok: true, welcome: position };
  }

  if (import.meta.env.DEV && book.id === DEV_FIXTURE_BOOK_ID) {
    await loadDevAudioFixture(controller);
    return { ok: true, welcome: position };
  }

  if (book.kind !== 'audio') {
    return { ok: false, message: 'This item is not an audiobook.', devFixtureAvailable: false };
  }

  if (!data) {
    return { ok: false, message: 'The library is not ready yet.', devFixtureAvailable: import.meta.env.DEV };
  }

  const { loadAudioItem, AudioItemError } = await import('@/features/library/audio-item');
  try {
    await controller.load(await loadAudioItem(data, book.id), startLocator(position));
    return { ok: true, welcome: position };
  } catch (error) {
    const message = error instanceof AudioItemError ? error.message : 'This audiobook could not be opened.';
    return { ok: false, message, devFixtureAvailable: import.meta.env.DEV };
  }
}

/** Resume where the listener left off, when the saved place is an audio place. */
function startLocator(position: ResumeInfo | undefined): Locator | undefined {
  return position?.locator?.kind === 'audio' ? position.locator : undefined;
}
