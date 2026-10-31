import { lazy, Suspense } from 'react';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { ImmersiveFallback } from '../ScreenFallback';
import { BookRouteShell } from './book-route-shared';
import '../screen-styles';

const LiveReader = lazy(() => import('@/features/reader/live/LiveReader'));

export function ReadRoute() {
  return (
    <BookRouteShell
      expected="read"
      renderReady={(book: BookRecord, position: ResumeInfo | undefined) => (
        <Suspense fallback={<ImmersiveFallback />}>
          <LiveReader book={book} position={position} />
        </Suspense>
      )}
    />
  );
}
