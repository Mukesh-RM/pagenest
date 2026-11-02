const CHUNK_RELOAD_KEY = 'pn-chunk-reload';

function chunkLoadMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** True when the browser rejected a dynamic `import()` (stale hash after a service worker update, etc.). */
export function isChunkLoadError(err: unknown): boolean {
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    chunkLoadMessage(err),
  );
}

/**
 * Runs a dynamic import with one immediate retry, then a single full reload if both fail in production with a
 * controlling service worker (avoids a stuck shell on stale lazy chunks after an update).
 */
export async function importModule<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (first) {
    if (!isChunkLoadError(first)) throw first;
    try {
      return await loader();
    } catch (second) {
      if (!isChunkLoadError(second)) throw second;
      if (
        import.meta.env.PROD &&
        typeof navigator !== 'undefined' &&
        navigator.serviceWorker?.controller &&
        typeof sessionStorage !== 'undefined' &&
        !sessionStorage.getItem(CHUNK_RELOAD_KEY)
      ) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        location.reload();
        return new Promise(() => undefined as T);
      }
      throw second;
    }
  }
}

/** Clears the one-shot chunk reload guard after a successful boot. */
export function clearChunkReloadGuard(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* private mode */
  }
}
