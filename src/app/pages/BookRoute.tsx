import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { loadBookPosition, type ResumeInfo } from '@/data/resume';
import type { BookRecord } from '@/data/schema';
import { EmptyState } from '@/ui';
import { Screen } from '../components/PageHeader';
import { ImmersiveFallback } from '../ScreenFallback';
import { pathForBook } from '../route-paths';
import { ensureSeedAudiobookBookRecord, isSeedAudiobookRequest, SEED_AUDIO_BOOK_ID } from '@/features/player/seed/seed-audiobook';
import { useServices } from '../services-context';
import '../screen-styles';

const ReaderScreen = lazy(() => import('@/features/reader/live/LiveReader'));
const PlayerScreen = lazy(() => import('./PlayerScreen'));

type Loaded = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; book: BookRecord; position: ResumeInfo | undefined };

/**
 * Shared by `/read/:id` and `/listen/:id`: loads the book by id from the database, shows a real
 * "not found" for an unknown id, sends a book opened on the wrong route to the right one, and
 * otherwise renders the reader or player screen with the book and its saved position.
 */
function BookRoute({ expected }: { expected: 'read' | 'listen' }) {
  const { id = '' } = useParams();
  const { db, progress } = useServices();
  const navigate = useNavigate();
  const [state, setState] = useState<{ id: string; value: Loaded }>({ id, value: { status: 'loading' } });
  const [seedTick, setSeedTick] = useState(0);

  useEffect(() => {
    if (id === SEED_AUDIO_BOOK_ID && isSeedAudiobookRequest()) {
      void ensureSeedAudiobookBookRecord(db).then(() => setSeedTick((n) => n + 1));
    }
  }, [db, id]);

  useEffect(() => {
    let current = true;
    const done = (value: Loaded): void => {
      if (current) setState({ id, value });
    };
    db.books.get(id).then(
      async (book) => {
        if (!book) return done({ status: 'missing' });
        const position = await loadBookPosition(db, progress, id).catch(() => undefined);
        done({ status: 'ready', book, position });
      },
      () => done({ status: 'missing' }),
    );
    return () => {
      current = false;
    };
  }, [db, progress, id, seedTick]);

  // A different id than the one loaded means the new book is still loading.
  const loaded = state.id === id ? state.value : ({ status: 'loading' } as const);

  if (loaded.status === 'loading') return <ImmersiveFallback />;
  if (loaded.status === 'missing') {
    return (
      <Screen>
        <EmptyState
          art="bookOpen"
          title="We can't find that book"
          description="It may have been removed from this device. Your library still has everything else."
          action={{ label: 'Go to Library', onClick: () => navigate('/', { replace: true }) }}
        />
      </Screen>
    );
  }
  const { book, position } = loaded;
  const rightPath = pathForBook(book);
  const wrongKind = (book.kind === 'audio') !== (expected === 'listen');
  if (wrongKind) return <Navigate to={rightPath} replace />;
  return (
    <Suspense fallback={<ImmersiveFallback />}>
      {expected === 'listen' ? <PlayerScreen book={book} position={position} /> : <ReaderScreen book={book} position={position} />}
    </Suspense>
  );
}

export function ReadRoute() {
  return <BookRoute expected="read" />;
}

export function ListenRoute() {
  return <BookRoute expected="listen" />;
}
