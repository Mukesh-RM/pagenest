import type { PageNestDB } from '@/data/db';
import { isDatabaseClosedError } from '@/data/db-errors';
import type { AudioController } from '@/engines/audio/types';
import { loadAudioSkipOptions } from './skip-settings';

/** Dexie can answer before the `settings` store is readable on a cold load (WebKit, reload). */
async function waitForSettingsStore(db: PageNestDB): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await db.settings.limit(1).first();
      return;
    } catch (error) {
      if (isDatabaseClosedError(error)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

/** Load skip lengths from IndexedDB and apply them to the shared audio controller. */
export async function applyPersistedSkipOptions(
  db: PageNestDB,
  controller: Pick<AudioController, 'setOptions'>,
): Promise<void> {
  await waitForSettingsStore(db);
  for (let attempt = 0; attempt < 8; attempt++) {
    const opts = await loadAudioSkipOptions(db);
    if (Object.keys(opts).length > 0) {
      controller.setOptions(opts);
      return;
    }
    await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
  }
}
