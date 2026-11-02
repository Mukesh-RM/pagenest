import { Suspense } from 'react';
import { lazyWithRetry } from '@/app/lazy-with-retry';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { PlayerProvider } from '@/features/player/PlayerProvider';
import { NarrationReaderBridgeProvider } from '@/features/narration/narration-reader-bridge';

const LiveReader = lazyWithRetry(() => import('@/features/reader/live/LiveReader'));

/** Reader plus narration controls (ReadRoute only; ListenRoute uses PlayerScreen). */
export function ReadRouteInner({ book, position }: { book: BookRecord; position: ResumeInfo | undefined }) {
  return (
    <PlayerProvider>
      <NarrationReaderBridgeProvider>
        <Suspense fallback={null}>
          <LiveReader book={book} position={position} />
        </Suspense>
      </NarrationReaderBridgeProvider>
    </PlayerProvider>
  );
}
