import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, ChipGroup, ProgressBar, useReducedMotion } from '@/ui';
import type { AudioController } from '@/engines/audio/types';
import { formatClock } from '@/engines/audio/util';
import { useServices } from '@/app/services-context';
import { usePlayerStore } from './audio-store';
import { addBookmark, listBookmarks, removeBookmark } from './bookmarks';
import { SleepTimerPanel } from '@/features/playback/SleepTimerPanel';

const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/** Shared full-player controls (immersive screen). State comes from the audio controller store only. */
export function FullPlayerContent({ controller }: { controller: AudioController }) {
  const state = usePlayerStore((s) => s.state);
  const reduced = useReducedMotion();
  const { db } = useServices();
  const [bookmarks, setBookmarks] = useState<Awaited<ReturnType<typeof listBookmarks>>>([]);
  const [bookmarkNote, setBookmarkNote] = useState('');

  const item = state.item;
  const chapter = item && state.chapterIndex >= 0 ? item.chapters[state.chapterIndex] : undefined;

  const coverUrl = useMemo(() => (item?.cover ? URL.createObjectURL(item.cover) : undefined), [item?.cover]);

  useEffect(() => {
    if (!item) return;
    void listBookmarks(db, item.bookId).then(setBookmarks);
  }, [item, db]);

  if (!item) return null;

  const progress = state.durationSec > 0 ? state.positionSec / state.durationSec : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="ghost" icon="skipBack" onClick={() => controller.previousChapter()} aria-label="Previous chapter">
          Prev
        </Button>
        <Button
          variant="primary"
          icon={state.status === 'playing' ? 'pause' : 'play'}
          onClick={() => void controller.toggle()}
          aria-label={state.status === 'playing' ? 'Pause' : 'Play'}
        >
          {state.status === 'playing' ? 'Pause' : 'Play'}
        </Button>
        <Button variant="ghost" icon="skipForward" onClick={() => controller.nextChapter()} aria-label="Next chapter">
          Next
        </Button>
      </div>

      <div className="flex gap-4">
        <div
          className="flex h-28 w-28 shrink-0 items-center justify-center rounded-card bg-surface-raised text-accent"
          aria-hidden="true"
        >
          {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full rounded-card object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold break-words">{chapter?.title ?? item.title}</p>
          <p className="text-base text-muted break-words">{item.author ?? 'Audiobook'}</p>
          <p
            className="mt-2 text-base leading-snug text-muted [overflow-wrap:anywhere]"
            data-testid="player-time-remaining"
          >
            <span data-testid="player-time-elapsed">{formatClock(state.positionSec)}</span>
            {' · '}
            <span data-testid="player-time-left">{formatClock(state.bookRemainingSec)} left</span>
            {' at '}
            <span data-testid="player-speed-display">{state.speed}x</span>
          </p>
        </div>
      </div>

      <label className="block">
        <span className="sr-only">Seek in book</span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          className="w-full accent-[var(--pn-accent)]"
          onChange={(e) => {
            const p = Number(e.target.value) / 1000;
            controller.seekTo(p * state.durationSec);
          }}
        />
        <ProgressBar value={progress} label="Book progress" className="mt-2" />
      </label>

        <section aria-label="Playback speed" data-testid="player-speed-section" className="min-w-0">
          <p className="mb-2 text-base font-medium">Speed</p>
          <ChipGroup label="Playback speed" scroll>
          {SPEED_STEPS.map((rate) => (
            <Chip key={rate} selected={state.speed === rate} onClick={() => controller.setSpeed(rate)}>
              {rate}x
            </Chip>
          ))}
        </ChipGroup>
      </section>

        <section aria-label="Sleep timer" data-testid="player-sleep-section" className="min-w-0">
          <p className="mb-2 text-base font-medium">Sleep timer</p>
          <SleepTimerPanel controller={controller} />
        </section>

      <section aria-label="Skip intervals">
        <p className="mb-2 text-sm font-medium">Skip</p>
        <ChipGroup label="Skip interval">
          {([10, 15, 30, 60] as const).map((sec) => (
            <Chip
              key={sec}
              selected={state.options.skipBackSec === sec && state.options.skipForwardSec === sec}
              onClick={() => controller.setOptions({ skipBackSec: sec, skipForwardSec: sec })}
            >
              {sec}s
            </Chip>
          ))}
        </ChipGroup>
      </section>

      <section aria-label="Bookmarks">
        <p className="mb-2 text-sm font-medium">Bookmarks</p>
        <div className="flex gap-2">
          <input
            type="text"
            className="min-h-11 flex-1 rounded-card border border-border bg-surface px-3 text-base"
            placeholder="Label"
            value={bookmarkNote}
            onChange={(e) => setBookmarkNote(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => {
              if (!state.locator) return;
              const label = bookmarkNote.trim() || `Bookmark at ${formatClock(state.positionSec)}`;
              void addBookmark(db, item.bookId, state.locator, label).then((b) => {
                setBookmarks((prev) => [...prev, b]);
                setBookmarkNote('');
              });
            }}
          >
            Save
          </Button>
        </div>
        <ul className="mt-2 space-y-2">
          {bookmarks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                className="text-left text-accent underline-offset-2 hover:underline"
                onClick={() => {
                  if (b.locator.kind === 'audio') {
                    const track = item.tracks[b.locator.trackIndex];
                    if (track) controller.seekTo(track.startOffsetSec + b.locator.positionSec);
                  }
                }}
              >
                {b.label}
              </button>
              <Button
                variant="ghost"
                aria-label="Delete bookmark"
                onClick={() => void removeBookmark(db, b.id).then(() => setBookmarks((prev) => prev.filter((x) => x.id !== b.id)))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {state.errorMessage ? (
        <p className="text-sm text-[var(--pn-danger)]" role="alert">{state.errorMessage}</p>
      ) : null}

      {!reduced ? (
        <p className="text-xs text-muted">
          Space play/pause · J/L skip · arrows seek · N/P chapters · speed with up/down
        </p>
      ) : null}
    </div>
  );
}
