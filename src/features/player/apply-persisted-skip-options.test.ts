import { describe, expect, it, vi } from 'vitest';
import { getDb } from '@/data/db';
import { setSetting } from '@/data/settings';
import type { AudioController } from '@/engines/audio/types';
import { SKIP_SEC_KEYS } from './skip-settings';
import { applyPersistedSkipOptions } from './apply-persisted-skip-options';

describe('applyPersistedSkipOptions', () => {
  it('applies skip lengths stored in settings', async () => {
    const db = getDb();
    await db.delete();
    await db.open();
    await setSetting(db, SKIP_SEC_KEYS.skipBackSec, 30);
    const setOptions = vi.fn();
    const controller = { setOptions } as Pick<AudioController, 'setOptions'>;
    await applyPersistedSkipOptions(db, controller);
    expect(setOptions).toHaveBeenCalledWith({ skipBackSec: 30 });
  });
});
