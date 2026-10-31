import { describe, expect, it, beforeEach } from 'vitest';
import { getDb } from '@/data/db';
import { setSetting } from '@/data/settings';
import { loadAudioSkipOptions, parseSkipSec, persistSkipInterval, SKIP_SEC_KEYS } from './skip-settings';

describe('parseSkipSec', () => {
  it('accepts engine skip lengths only', () => {
    expect(parseSkipSec(15)).toBe(15);
    expect(parseSkipSec(45)).toBeUndefined();
    expect(parseSkipSec('15')).toBeUndefined();
  });
});

describe('loadAudioSkipOptions', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete();
    await db.open();
  });

  it('reads persisted skip seconds', async () => {
    const db = getDb();
    await setSetting(db, SKIP_SEC_KEYS.skipBackSec, 30);
    await setSetting(db, SKIP_SEC_KEYS.skipForwardSec, 10);
    await expect(loadAudioSkipOptions(db)).resolves.toEqual({
      skipBackSec: 30,
      skipForwardSec: 10,
    });
  });

  it('ignores invalid stored values', async () => {
    const db = getDb();
    await setSetting(db, SKIP_SEC_KEYS.skipBackSec, 99);
    await expect(loadAudioSkipOptions(db)).resolves.toEqual({});
  });
});

describe('persistSkipInterval', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete();
    await db.open();
  });

  it('stores back and forward separately', async () => {
    const db = getDb();
    await persistSkipInterval(db, 'back', 60);
    await persistSkipInterval(db, 'forward', 15);
    await expect(loadAudioSkipOptions(db)).resolves.toEqual({
      skipBackSec: 60,
      skipForwardSec: 15,
    });
  });
});
