import type { AudioState } from '@/engines/audio/types';
import { chapterSubtitle } from '@/engines/audio/media-session';
import type { ChromePlayerSnapshot } from './chrome-store';

let lastCoverUrl: string | undefined;
let lastCoverBlob: Blob | undefined;

function coverUrlForItem(cover?: Blob): string | undefined {
  if (!cover) {
    lastCoverUrl = undefined;
    lastCoverBlob = undefined;
    return undefined;
  }
  if (cover === lastCoverBlob && lastCoverUrl) return lastCoverUrl;
  if (lastCoverUrl) URL.revokeObjectURL(lastCoverUrl);
  lastCoverBlob = cover;
  lastCoverUrl = URL.createObjectURL(cover);
  return lastCoverUrl;
}

/** Maps engine state into the chrome store (called from the lazy runtime only). */
export function chromeSnapshotFromAudioState(state: AudioState): { chrome: ChromePlayerSnapshot; sessionActive: boolean } {
  const item = state.item;
  const sessionActive = item !== undefined && state.status !== 'idle';
  if (!sessionActive || !item) {
    return {
      sessionActive: false,
      chrome: {
        bookId: null,
        title: '',
        subtitle: '',
        playing: false,
        positionSec: 0,
        durationSec: 0,
        skipBackSec: 15,
      },
    };
  }
  return {
    sessionActive: true,
    chrome: {
      bookId: item.bookId,
      title: item.title,
      subtitle: chapterSubtitle(state),
      coverUrl: coverUrlForItem(item.cover),
      playing: state.status === 'playing',
      positionSec: state.positionSec,
      durationSec: state.durationSec,
      skipBackSec: state.options.skipBackSec,
    },
  };
}

/** Test helper: reset blob URL cache. */
export function resetChromeCoverCacheForTests(): void {
  if (lastCoverUrl) URL.revokeObjectURL(lastCoverUrl);
  lastCoverUrl = undefined;
  lastCoverBlob = undefined;
}
