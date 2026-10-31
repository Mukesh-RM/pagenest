import { lazy, Suspense } from 'react';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { ImmersiveFallback } from '../ScreenFallback';
import { BookRouteShell } from './book-route-shared';
import '../screen-styles';

const ReadRouteInner = lazy(() => import('./ReadRouteInner').then((m) => ({ default: m.ReadRouteInner })));

export function ReadRoute() {
  return (
    <BookRouteShell
      expected="read"
      renderReady={(book: BookRecord, position: ResumeInfo | undefined) => (
        <Suspense fallback={<ImmersiveFallback />}>
          <ReadRouteInner book={book} position={position} />
        </Suspense>
      )}
    />
  );
}
