import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { chapterSubtitle } from '@/engines/audio/media-session';
import { useCoverUrl } from '@/app/library-hooks';
import { useAudioController } from './PlayerProvider';
import { usePlayerStore } from './audio-store';
import { useAudioPlayerController, type PlayerSheet } from './useAudioPlayerController';
import { ChaptersSheet, SleepTimerSheet } from './player-sheets';

const AudioPlayerScreen = lazy(() =>
  import('@/ui/screens/AudioPlayerScreen').then((m) => ({ default: m.AudioPlayerScreen })),
);

function bookSummaryFromRecord(book: BookRecord, coverUrl: string | undefined, progress: number) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl,
    progress,
    audio: book.kind === 'audio',
  };
}

/** Immersive player using the design-system AudioPlayerScreen plus feature-layer sheets. */
export function IntegratedPlayerView({ book, welcome }: { book: BookRecord; welcome?: ResumeInfo }) {
  const controller = useAudioController();
  const navigate = useNavigate();
  const state = usePlayerStore((s) => s.state);
  const [sheet, setSheet] = useState<PlayerSheet>(null);
  const openSheet = useCallback((s: Exclude<PlayerSheet, null>) => setSheet(s), []);
  const playerController = useAudioPlayerController(controller, openSheet);

  const hasCover = Boolean(book.coverRef);
  const coverUrlFromCache = useCoverUrl(book.id, hasCover);
  const coverUrl = useMemo(() => {
    if (coverUrlFromCache) return coverUrlFromCache;
    if (state.item?.cover) return URL.createObjectURL(state.item.cover);
    return undefined;
  }, [coverUrlFromCache, state.item?.cover]);

  const progress =
    state.durationSec > 0 ? state.positionSec / state.durationSec : (welcome?.percent ?? 0) / 100;
  const summary = bookSummaryFromRecord(book, coverUrl, progress);
  const chapter =
    state.item && state.chapterIndex >= 0
      ? chapterSubtitle(state)
      : welcome?.chapterTitle ?? 'Chapter 1';

  const onCollapse = () => navigate('/');

  return (
    <>
      <Suspense fallback={<p className="px-[var(--pn-margin)] pt-[calc(1rem+var(--pn-safe-top))] text-muted">Loading player…</p>}>
        <AudioPlayerScreen book={summary} chapter={chapter} controller={playerController} onCollapse={onCollapse} />
      </Suspense>
      <SleepTimerSheet open={sheet === 'sleep'} onClose={() => setSheet(null)} controller={controller} />
      <ChaptersSheet open={sheet === 'chapters'} onClose={() => setSheet(null)} controller={controller} />
      {state.errorMessage ? (
        <p className="px-[var(--pn-margin)] text-sm text-[var(--pn-danger)]" role="alert">{state.errorMessage}</p>
      ) : null}
    </>
  );
}
