import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, EmptyState } from '@/ui';
import { useServices } from '@/app/services-context';
import { getAudioController } from './PlayerProvider';
import { usePlayerStore } from './audio-store';
import { DEV_FIXTURE_BOOK_ID, loadDevAudioFixture } from './dev/fixtures';
import { chapterForLocator, resumeHeading, type ResumeInfo } from '@/data/resume';

/**
 * Full-screen listen route (`/listen/:id`). Wire in `src/app/routes.tsx` (Architect).
 * In development, `id=dev-fixture-audio` loads the bundled tone fixture without Library.
 */
export function ListenRoute() {
  const { id } = useParams<{ id: string }>();
  const { progress, db } = useServices();
  const state = usePlayerStore((s) => s.state);
  const setFullPlayerOpen = usePlayerStore((s) => s.setFullPlayerOpen);
  const [welcome, setWelcome] = useState<ResumeInfo | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setFullPlayerOpen(true);
    return () => setFullPlayerOpen(false);
  }, [setFullPlayerOpen]);

  useEffect(() => {
    const controller = getAudioController();
    if (!controller || !id) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        if (import.meta.env.DEV && id === DEV_FIXTURE_BOOK_ID) {
          await loadDevAudioFixture(controller);
        } else {
          const saved = await progress.get(id, 'listen');
          const chapters = await db.chapters.where('bookId').equals(id).toArray();
          const book = await db.books.get(id);
          if (!book) {
            setError('This audiobook is not in your library yet.');
            setLoading(false);
            return;
          }
          if (saved?.locator) {
            const chapter = chapterForLocator(chapters, saved.locator);
            setWelcome({
              bookId: id,
              title: book.title,
              ...(book.author ? { author: book.author } : {}),
              mode: 'listen',
              locator: saved.locator,
              percent: saved.percent,
              ...(chapter ? { chapterNumber: chapter.index + 1, chapterTitle: chapter.title } : {}),
              updatedAt: saved.updatedAt,
            });
          }
          setError('Library playback needs imported audio files. Use the dev fixture in development.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load audio');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, progress, db]);

  if (loading) {
    return <p className="text-muted">Loading player…</p>;
  }

  if (error) {
    return (
      <EmptyState
        title="Cannot play yet"
        description={error}
        action={
          import.meta.env.DEV
            ? { label: 'Load dev fixture', onClick: () => void loadDevAudioFixture(getAudioController()!) }
            : undefined
        }
      />
    );
  }

  const heading = welcome ? resumeHeading(welcome) : 'Now playing';

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">{heading}</h1>
        {welcome?.chapterTitle ? <p className="text-muted">{welcome.chapterTitle}</p> : null}
      </header>
      <p className="text-sm text-muted">
        {state.item?.title ?? 'Audio loaded'} · Swipe up on the mini-player or use the sheet controls.
      </p>
      {import.meta.env.DEV ? (
        <Button variant="secondary" onClick={() => void getAudioController()?.play()}>
          Play
        </Button>
      ) : null}
    </div>
  );
}
