import { SleepTimerPanel } from '@/features/playback/SleepTimerPanel';
import { BottomSheet } from '@/ui';
import type { AudioController } from '@/engines/audio/types';

export function SharedSleepTimerSheet({
  open,
  onClose,
  controller,
}: {
  open: boolean;
  onClose: () => void;
  controller: AudioController;
}) {
  return (
    <BottomSheet open={open} onClose={() => onClose()} title="Sleep timer">
      <SleepTimerPanel controller={controller} onApplied={() => onClose()} />
    </BottomSheet>
  );
}
