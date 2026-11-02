import { Suspense, type ComponentProps } from 'react';
import { importModule } from '@/app/chunk-import';
import { lazyWithRetry } from '@/app/lazy-with-retry';
import { ScreenFallback } from '@/app/ScreenFallback';

const VoiceStudioApp = lazyWithRetry(() => import('./VoiceStudioApp'));

export function preloadVoiceStudio(): void {
  void importModule(() => import('./VoiceStudioApp'));
}

export function LazyVoiceStudioRoot(props: ComponentProps<typeof VoiceStudioApp>) {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <VoiceStudioApp {...props} />
    </Suspense>
  );
}

export { VoiceStudioApp };
