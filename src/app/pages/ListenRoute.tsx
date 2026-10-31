import { lazy, Suspense } from 'react';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { ImmersiveFallback } from '../ScreenFallback';
import { BookRouteShell } from './book-route-shared';
import '../screen-styles';

const PlayerScreen = lazy(() => import('./PlayerScreen'));

export function ListenRoute() {
  return (
    <BookRouteShell
      expected="listen"
      renderReady={(book: BookRecord, position: ResumeInfo | undefined) => (
        <Suspense fallback={<ImmersiveFallback />}>
          <PlayerScreen book={book} position={position} />
        </Suspense>
      )}
    />
  );
}
