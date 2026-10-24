/** Lightweight HTMLAudioElement stand-in for Vitest (jsdom has no real media). */

export interface MockAudioHandlers {
  onPlay?: () => void;
  onPause?: () => void;
}

export function createMockAudioElement(handlers: MockAudioHandlers = {}): HTMLAudioElement {
  let paused = true;
  let currentTime = 0;
  let duration = 120;
  let playbackRate = 1;
  let src = '';
  const listeners = new Map<string, Set<EventListener>>();

  const el = {
    preload: 'auto',
    crossOrigin: 'anonymous',
    volume: 1,
    error: null as MediaError | null,
    preservesPitch: true,
    get paused() {
      return paused;
    },
    get currentTime() {
      return currentTime;
    },
    set currentTime(v: number) {
      currentTime = v;
      dispatch('timeupdate');
    },
    get duration() {
      return duration;
    },
    set duration(v: number) {
      duration = v;
    },
    get playbackRate() {
      return playbackRate;
    },
    set playbackRate(v: number) {
      playbackRate = v;
    },
    get src() {
      return src;
    },
    set src(v: string) {
      src = v;
      queueMicrotask(() => {
        dispatch('loadedmetadata');
        if (!paused) dispatch('timeupdate');
      });
    },
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      dispatch(event.type);
      return true;
    },
    load() {
      queueMicrotask(() => dispatch('loadedmetadata'));
    },
    async play() {
      paused = false;
      handlers.onPlay?.();
      dispatch('playing');
      return undefined;
    },
    pause() {
      paused = true;
      handlers.onPause?.();
    },
    /** Test helper: advance playback time. */
    _tick(seconds: number) {
      if (paused) return;
      currentTime += seconds;
      dispatch('timeupdate');
      if (currentTime >= duration) dispatch('ended');
    },
    /** Test helper: fire ended. */
    _end() {
      dispatch('ended');
    },
  };

  function dispatch(type: string) {
    const evt = new Event(type);
    for (const l of listeners.get(type) ?? []) l(evt);
  }

  return el as unknown as HTMLAudioElement;
}
