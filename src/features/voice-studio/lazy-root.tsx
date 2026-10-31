import { lazy, Suspense, type ComponentProps } from 'react';
import { ScreenFallback } from '@/app/ScreenFallback';

const VoiceStudioApp = lazy(() => import('./VoiceStudioApp'));

export function preloadVoiceStudio(): void {
  void import('./VoiceStudioApp');
}

export function LazyVoiceStudioRoot(props: ComponentProps<typeof VoiceStudioApp>) {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <VoiceStudioApp {...props} />
    </Suspense>
  );
}

export { VoiceStudioApp };
