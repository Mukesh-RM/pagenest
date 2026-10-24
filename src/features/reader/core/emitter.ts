import type { Unsubscribe } from '@/app/contracts';

/** Tiny typed listener list. A listener that throws never stops the others. */
export class Emitter<T> {
  readonly #listeners = new Set<(value: T) => void>();

  on(listener: (value: T) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  emit(value: T): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener(value);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  get size(): number {
    return this.#listeners.size;
  }

  clear(): void {
    this.#listeners.clear();
  }
}

/** Run `fn` at most once per animation frame with the latest arguments. */
export function frameThrottle<A extends unknown[]>(fn: (...args: A) => void): { (...args: A): void; cancel(): void } {
  let frame = 0;
  let latest: A | undefined;
  const run = (): void => {
    frame = 0;
    if (latest) fn(...latest);
  };
  const wrapped = (...args: A): void => {
    latest = args;
    if (!frame) frame = requestAnimationFrame(run);
  };
  wrapped.cancel = (): void => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    latest = undefined;
  };
  return wrapped;
}

/** Plain-language reading time. */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  if (minutes < 1) return 'less than a minute';
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}
