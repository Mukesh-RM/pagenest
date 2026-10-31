import { lazy, Suspense, type ReactNode } from 'react';
import type { AudioController } from '@/engines/audio/types';

const LazyDriveModeView = lazy(() => import('./DriveModeView'));

export function DriveModeOverlay({
  open,
  controller,
  onClose,
}: {
  open: boolean;
  controller: AudioController;
  onClose: () => void;
}): ReactNode {
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <LazyDriveModeView controller={controller} onExit={onClose} />
    </Suspense>
  );
}
