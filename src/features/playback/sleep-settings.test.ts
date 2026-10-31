import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageNestDB } from '@/data/db';
import { parseSleepTimerSpec, persistLastSleepTimerSpec, loadLastSleepTimerSpec } from './sleep-settings';

describe('sleep-settings', () => {
  let db: PageNestDB;
  let n = 0;
  beforeEach(() => {
    db = new PageNestDB(`sleep-settings-${(n += 1)}`);
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('parses preset minutes, custom minutes and end of chapter', () => {
    expect(parseSleepTimerSpec({ kind: 'minutes', minutes: 10 })).toEqual({ kind: 'minutes', minutes: 10 });
    expect(parseSleepTimerSpec({ kind: 'minutes', minutes: 90 })).toEqual({ kind: 'minutes', minutes: 90 });
    expect(parseSleepTimerSpec({ kind: 'endOfChapter' })).toEqual({ kind: 'endOfChapter' });
    expect(parseSleepTimerSpec({ kind: 'minutes', minutes: 0 })).toBeUndefined();
  });

  it('persists and reloads the last sleep timer choice', async () => {
    const spec = { kind: 'minutes' as const, minutes: 45 };
    await persistLastSleepTimerSpec(db, spec);
    await expect(loadLastSleepTimerSpec(db)).resolves.toEqual(spec);
  });
});
