import type { AudioItem, AudioState } from './types';
import { formatClock } from './util';

export interface MediaSessionActions {
  play(): Promise<void>;
  pause(): void;
  skipBack(): void;
  skipForward(): void;
  previousChapter(): void;
  nextChapter(): void;
  seekTo(bookPositionSec: number): void;
}

export interface MediaSessionBridge {
  sync(state: AudioState, item: AudioItem | undefined, coverUrl: string | undefined): void;
  clear(): void;
}

function artworkFromUrl(url: string): MediaImage[] {
  return [{ src: url, sizes: '512x512', type: 'image/png' }];
}

/**
 * Keeps lock-screen / notification controls in sync with the audio controller.
 */
export function createMediaSessionBridge(actions: MediaSessionActions): MediaSessionBridge {
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  if (!session) {
    return {
      sync: () => undefined,
      clear: () => undefined,
    };
  }

  session.setActionHandler('play', () => void actions.play());
  session.setActionHandler('pause', () => actions.pause());
  session.setActionHandler('seekbackward', () => actions.skipBack());
  session.setActionHandler('seekforward', () => actions.skipForward());
  session.setActionHandler('previoustrack', () => actions.previousChapter());
  session.setActionHandler('nexttrack', () => actions.nextChapter());
  session.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) actions.seekTo(details.seekTime);
  });

  return {
    sync(state, item, coverUrl) {
      if (!item || state.status === 'idle') {
        session.metadata = null;
        session.playbackState = 'none';
        return;
      }
      const chapter = item.chapters[state.chapterIndex];
      session.metadata = new MediaMetadata({
        title: chapter?.title ?? item.title,
        artist: item.author ?? 'Audiobook',
        album: item.title,
        ...(coverUrl ? { artwork: artworkFromUrl(coverUrl) } : {}),
      });
      session.playbackState = state.status === 'playing' ? 'playing' : 'paused';
      if ('setPositionState' in session && state.durationSec > 0) {
        try {
          session.setPositionState({
            duration: state.durationSec,
            playbackRate: state.speed,
            position: Math.min(state.positionSec, state.durationSec),
          });
        } catch {
          // Some browsers reject position updates while idle.
        }
      }
    },
    clear() {
      session.metadata = null;
      session.playbackState = 'none';
    },
  };
}

export function chapterSubtitle(state: AudioState): string {
  const item = state.item;
  if (!item) return '';
  const ch = item.chapters[state.chapterIndex];
  const left = formatClock(state.chapterRemainingSec);
  return ch ? `${ch.title} · ${left} left` : `${left} left`;
}
