import { useEffect, useState } from 'react';
import { EmptyState } from '@/ui';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { useServices } from '@/app/services-context';
import { getAudioController } from './PlayerProvider';
import { preloadPlayerEngine, waitForAudioController } from './lazy-runtime';
import { loadAudiobookForBook } from './load-audiobook';
import { loadDevAudioFixture } from './dev/fixtures';
import { IntegratedPlayerView } from './integrated-player-view';

export interface AudiobookPlayerScreenProps {
  readonly book: BookRecord;
  readonly position: ResumeInfo | undefined;
}

/**
 * Immersive audiobook player for `/listen/:id`. Drop-in replacement for `src/app/pages/PlayerScreen.tsx`.
 */
export default function AudiobookPlayerScreen({ book, position }: AudiobookPlayerScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [welcome, setWelcome] = useState<ResumeInfo | undefined>(position);
  const [devFixture, setDevFixture] = useState(false);
  const { data } = useServices();

  useEffect(() => {
    preloadPlayerEngine();
    let cancelled = false;
    void waitForAudioController()
      .then((controller) => {
        if (cancelled) return;
        const loaded = controller.getState().item;
        if (loaded?.bookId === book.id && controller.getState().status !== 'idle') {
          setWelcome(position);
          setError(undefined);
          setLoading(false);
          return;
        }
        return loadAudiobookForBook(controller, book, position, data).then((result) => {
          if (cancelled) return;
          if (result.ok) {
            setWelcome(result.welcome ?? position);
            setError(undefined);
          } else {
            setError(result.message);
            setDevFixture(result.devFixtureAvailable);
          }
          setLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError('Audio is not ready yet.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [book, position, data]);

  if (loading) {
    return <p className="px-[var(--pn-margin)] pt-[calc(1rem+var(--pn-safe-top))] text-muted">Loading player…</p>;
  }

  if (error) {
    return (
      <div className="px-[var(--pn-margin)] pt-[calc(1rem+var(--pn-safe-top))]">
        <EmptyState
          title="Cannot play yet"
          description={error}
          action={
            devFixture
              ? {
                  label: 'Load dev fixture',
                  onClick: () => {
                    const controller = getAudioController();
                    if (!controller) return;
                    void loadDevAudioFixture(controller).then(() => setError(undefined));
                  },
                }
              : undefined
          }
        />
      </div>
    );
  }

  return <IntegratedPlayerView book={book} welcome={welcome} />;
}
