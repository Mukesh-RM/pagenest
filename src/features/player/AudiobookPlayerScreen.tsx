import { useEffect, useState } from 'react';
import { EmptyState } from '@/ui';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { getAudioController } from './PlayerProvider';
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

  useEffect(() => {
    const controller = getAudioController();
    if (!controller) {
      setError('Audio is not ready yet.');
      setLoading(false);
      return;
    }
    const loaded = controller.getState().item;
    if (loaded?.bookId === book.id && controller.getState().status !== 'idle') {
      setWelcome(position);
      setError(undefined);
      setLoading(false);
      return;
    }
    void loadAudiobookForBook(controller, book, position).then((result) => {
      if (result.ok) {
        setWelcome(result.welcome ?? position);
        setError(undefined);
      } else {
        setError(result.message);
        setDevFixture(result.devFixtureAvailable);
      }
      setLoading(false);
    });
  }, [book, position]);

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
