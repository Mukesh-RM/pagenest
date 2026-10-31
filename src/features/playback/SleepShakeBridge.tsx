import { useAudioController } from '@/features/player/PlayerProvider';
import { usePlayerStore } from '@/features/player/audio-store';
import { SHAKE_EXTEND_SEC } from './sleep-timer-presets';
import { useShakeToExtendSleep } from './useShakeToExtendSleep';

/** Extends the active sleep timer when the user shakes the device. */
export function SleepShakeBridge() {
  const controller = useAudioController();
  const sleepActive = usePlayerStore((s) => Boolean(s.state.sleep));
  useShakeToExtendSleep(sleepActive, () => controller.extendSleepTimer(SHAKE_EXTEND_SEC));
  return null;
}
