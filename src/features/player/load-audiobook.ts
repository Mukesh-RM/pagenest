import type { AudioController } from '@/engines/audio/types';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { DEV_FIXTURE_BOOK_ID, loadDevAudioFixture } from './dev/fixtures';

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
): Promise<LoadAudiobookResult> {
  if (import.meta.env.DEV && book.id === DEV_FIXTURE_BOOK_ID) {
    await loadDevAudioFixture(controller);
    return { ok: true, welcome: position };
  }

  if (book.kind !== 'audio') {
    return { ok: false, message: 'This item is not an audiobook.', devFixtureAvailable: false };
  }

  return {
    ok: false,
    message: 'Library playback needs imported audio files. Use the dev fixture in development.',
    devFixtureAvailable: import.meta.env.DEV,
  };
}
