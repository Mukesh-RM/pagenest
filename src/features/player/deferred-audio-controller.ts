import type { ProgressService } from '@/app/contracts';
import { createAudioController, createAudioElement } from '@/engines/audio';
import type { AudioController, AudioState } from '@/engines/audio/types';
import { DEFAULT_AUDIO_OPTIONS } from '@/engines/audio/util';

const IDLE_STATE: AudioState = {
  status: 'idle',
  item: undefined,
  positionSec: 0,
  durationSec: 0,
  chapterIndex: -1,
  speed: 1,
  options: { ...DEFAULT_AUDIO_OPTIONS },
  sleep: { active: false },
  errorMessage: undefined,
};

export type AudioActivatedHook = (audio: HTMLAudioElement, controller: AudioController) => void;

/**
 * Controller facade that does not allocate an {@link HTMLAudioElement} until the first load, play,
 * or seek (anything that needs real media). `subscribe` and `getState` work before activation.
 */
export function createDeferredAudioController(
  progress: ProgressService,
  onActivate?: AudioActivatedHook,
): AudioController {
  let inner: AudioController | undefined;
  const pendingListeners = new Set<(state: AudioState) => void>();

  const ensure = (): AudioController => {
    if (inner) return inner;
    const audio = createAudioElement();
    inner = createAudioController({ audio, progress });
    onActivate?.(audio, inner);
    for (const listener of pendingListeners) {
      inner.subscribe(listener);
    }
    pendingListeners.clear();
    return inner;
  };

  const needsHardware = (prop: string | symbol): boolean =>
    prop !== 'getState' && prop !== 'subscribe' && prop !== 'getOptions';

  return new Proxy({} as AudioController, {
    get(_target, prop, receiver) {
      if (prop === 'getState') {
        return () => (inner ? inner.getState() : IDLE_STATE);
      }
      if (prop === 'subscribe') {
        return (listener: (state: AudioState) => void) => {
          if (inner) return inner.subscribe(listener);
          pendingListeners.add(listener);
          listener(IDLE_STATE);
          return () => pendingListeners.delete(listener);
        };
      }
      if (needsHardware(prop)) {
        const active = ensure();
        const value = Reflect.get(active, prop, receiver);
        return typeof value === 'function' ? value.bind(active) : value;
      }
      return Reflect.get(ensure(), prop, receiver);
    },
  });
}
