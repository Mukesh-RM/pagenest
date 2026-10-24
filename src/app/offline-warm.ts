import { whenIdle } from './idle';

/**
 * Offline warm-up (Decision 15). The Reader's engines (pdf.js, foliate-js, docx) and the sample book are not precached, so the service
 * worker keeps them in a runtime cache the first time they are fetched (cache first, docs/DEPLOY.md). This module fetches them once, when
 * the browser is idle shortly after the first Library render, so the first sample book or first PDF works offline too.
 *
 * Rules: only our own assets (every task is a same-origin URL or a dynamic import of our own chunk), never on a metered or offline
 * connection, only when a service worker is in control (otherwise nothing would keep the files), once per page load, and it draws nothing,
 * so it cannot move the layout.
 */
export interface WarmTask {
  readonly name: string;
  readonly run: () => Promise<unknown>;
}

export interface WarmEnv {
  online: boolean;
  /** `navigator.connection.saveData`: the person asked for less data. */
  saveData: boolean;
  /** A service worker controls this page, so what is fetched now lands in its cache. */
  swControlled: boolean;
}

export function currentWarmEnv(): WarmEnv {
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  return {
    online: navigator.onLine !== false,
    saveData: connection?.saveData === true,
    swControlled: 'serviceWorker' in navigator && navigator.serviceWorker.controller != null,
  };
}

/** How long after the Library is drawn the warm-up waits, so it never competes with the first screen or the first taps. */
export const WARM_DELAY_MS = 5000;

let startedThisLoad = false;

/** Test-only: forget that the warm-up already ran. */
export function resetWarmForTests(): void {
  startedThisLoad = false;
}

/** Run the tasks one after the other (never in parallel). A failed task is skipped: warming is best effort and silent. */
export async function runWarmTasks(tasks: readonly WarmTask[]): Promise<string[]> {
  const done: string[] = [];
  for (const task of tasks) {
    try {
      await task.run();
      done.push(task.name);
    } catch {
      // Offline again, blocked or a missing file: nothing to tell the person; the file is simply fetched when it is needed.
    }
  }
  return done;
}

/** Schedule the warm-up. Returns a cancel function. Does nothing when the environment says it should not run. */
export function scheduleOfflineWarm(
  tasks: () => readonly WarmTask[] | Promise<readonly WarmTask[]>,
  env: () => WarmEnv = currentWarmEnv,
  delayMs: number = WARM_DELAY_MS,
): () => void {
  if (startedThisLoad) return () => {};
  let cancelIdle = (): void => {};
  const timer = window.setTimeout(() => {
    cancelIdle = whenIdle(() => {
      const e = env();
      if (startedThisLoad || !e.online || e.saveData || !e.swControlled) return;
      startedThisLoad = true;
      void Promise.resolve(tasks()).then(runWarmTasks);
    });
  }, delayMs);
  return () => {
    window.clearTimeout(timer);
    cancelIdle();
  };
}
