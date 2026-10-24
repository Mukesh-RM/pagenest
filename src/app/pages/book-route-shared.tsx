import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { loadBookPosition, type ResumeInfo } from '@/data/resume';
import type { BookRecord } from '@/data/schema';
import { EmptyState } from '@/ui';
import { Screen } from '../components/PageHeader';
import { ImmersiveFallback } from '../ScreenFallback';
import { pathForBook } from '../route-paths';
import { maybeEnsureSeedAudiobookOnRoute } from './book-route-seed';
import { useServices } from '../services-context';

type Loaded = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; book: BookRecord; position: ResumeInfo | undefined };

export function BookRouteShell({
  expected,
  renderReady,
}: {
  expected: 'read' | 'listen';
  renderReady: (book: BookRecord, position: ResumeInfo | undefined) => ReactNode;
}) {
  const { id = '' } = useParams();
  const { db, progress } = useServices();
  const navigate = useNavigate();
  const [state, setState] = useState<{ id: string; value: Loaded }>({ id, value: { status: 'loading' } });
  const [seedTick, setSeedTick] = useState(0);

  useEffect(() => {
    void maybeEnsureSeedAudiobookOnRoute(db, id).then((seeded) => {
      if (seeded) setSeedTick((n) => n + 1);
    });
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
  return renderReady(book, position);
}
