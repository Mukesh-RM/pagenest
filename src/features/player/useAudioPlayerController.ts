import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AudioPlayerController } from '@/ui/screens/AudioPlayerScreen';
import type { AudioController, AudioOptions } from '@/engines/audio/types';
import { formatClock } from '@/engines/audio/util';
import type { PlayerBookmark } from '@/ui/types';
import { useSnackbar } from '@/ui';
import { useServices } from '@/app/services-context';
import { usePlayerStore } from './audio-store';
import { addBookmark, listBookmarks, removeBookmark } from './bookmarks';
import { bookmarkRecordToPlayer, locatorFromBookPositionSec } from './bookmark-map';
import { persistSkipInterval, type SkipSec } from './skip-settings';

const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function sleepLabelFromState(sleep?: { spec: { kind: string; minutes?: number }; remainingSec: number }): string {
  if (!sleep) return 'Off';
  if (sleep.spec.kind === 'endOfChapter') return 'End of chapter';
  if (sleep.spec.kind === 'minutes' && sleep.spec.minutes) return `${sleep.spec.minutes} min`;
  return formatClock(sleep.remainingSec);
}

export type PlayerSheet = 'sleep' | 'chapters' | null;

export function useAudioPlayerController(
  controller: AudioController,
  openSheet: (sheet: Exclude<PlayerSheet, null>) => void,
): AudioPlayerController {
  const state = usePlayerStore((s) => s.state);
  const { db } = useServices();
  const snackbar = useSnackbar();
  const [bookmarks, setBookmarks] = useState<readonly PlayerBookmark[]>([]);

  const item = state.item;
  const bookId = item?.bookId;

  useEffect(() => {
    if (!bookId || !item) {
      setBookmarks([]);
      return;
    }
    void listBookmarks(db, bookId).then((records) => {
      setBookmarks(
        records
          .map((r) => bookmarkRecordToPlayer(r, item))
          .filter((b): b is PlayerBookmark => b !== null),
      );
    });
  }, [db, bookId, item]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_STEPS.indexOf(state.speed as (typeof SPEED_STEPS)[number]);
    const next = SPEED_STEPS[(idx < 0 ? 2 : idx + 1) % SPEED_STEPS.length] ?? 1;
    controller.setSpeed(next);
  }, [controller, state.speed]);

  const setSkipInterval = useCallback(
    (direction: 'back' | 'forward', seconds: number) => {
      const sec = seconds as SkipSec;
      const partial: Partial<AudioOptions> =
        direction === 'back' ? { skipBackSec: sec } : { skipForwardSec: sec };
      controller.setOptions(partial);
      void persistSkipInterval(db, direction, sec);
    },
    [controller, db],
  );

  const addBookmarkAt = useCallback(
    (positionSec: number) => {
      if (!item) return;
      const locator = locatorFromBookPositionSec(item, positionSec);
      void addBookmark(db, item.bookId, locator, '').then((record) => {
        const mapped = bookmarkRecordToPlayer(record, item);
        if (mapped) setBookmarks((prev) => [...prev, mapped]);
        snackbar.show({
          message: `Bookmark added at ${formatClock(positionSec)}`,
          actionLabel: 'Undo',
          onAction: () => {
            void removeBookmark(db, record.id).then(() => {
              setBookmarks((prev) => prev.filter((b) => b.id !== record.id));
            });
          },
        });
      });
    },
    [db, item, snackbar],
  );

  const removeBookmarkAt = useCallback(
    (bookmark: PlayerBookmark) => {
      if (!item) return;
      const removed = bookmark;
      void removeBookmark(db, bookmark.id).then(() => {
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id));
        snackbar.show({
          message: 'Bookmark removed',
          actionLabel: 'Undo',
          onAction: () => {
            const locator = locatorFromBookPositionSec(item, removed.positionSec);
            void addBookmark(db, item.bookId, locator, removed.label ?? '').then((record) => {
              const mapped = bookmarkRecordToPlayer(record, item);
              if (mapped) setBookmarks((prev) => [...prev, mapped]);
            });
          },
        });
      });
    },
    [db, item, snackbar],
  );

  return useMemo(
    () => ({
      playing: state.status === 'playing',
      position: state.positionSec,
      duration: state.durationSec,
      speed: state.speed,
      sleepLabel: sleepLabelFromState(state.sleep),
      toggle: () => void controller.toggle(),
      seek: (seconds: number) => controller.seekTo(seconds),
      skip: (deltaSeconds: number) => controller.skip(deltaSeconds),
      cycleSpeed,
      openSleep: () => openSheet('sleep'),
      openChapters: () => openSheet('chapters'),
      skipBackSeconds: state.options.skipBackSec,
      skipForwardSeconds: state.options.skipForwardSec,
      setSkipInterval,
      bookmarks: item ? bookmarks : [],
      addBookmark: item ? addBookmarkAt : undefined,
      removeBookmark: item ? removeBookmarkAt : undefined,
      openBookmarks: undefined,
    }),
    [
      addBookmarkAt,
      bookmarks,
      controller,
      cycleSpeed,
      item,
      openSheet,
      removeBookmarkAt,
      setSkipInterval,
      state.durationSec,
      state.options.skipBackSec,
      state.options.skipForwardSec,
      state.positionSec,
      state.sleep,
      state.speed,
      state.status,
    ],
  );
}
