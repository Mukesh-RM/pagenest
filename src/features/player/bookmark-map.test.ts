import { describe, expect, it } from 'vitest';
import type { AudioItem } from '@/engines/audio/types';
import type { BookmarkRecord } from '@/data/schema';
import { bookmarkRecordToPlayer, locatorFromBookPositionSec } from './bookmark-map';

const item: AudioItem = {
  bookId: 'b1',
  title: 'T',
  tracks: [
    { index: 0, title: 'A', durationSec: 100, startOffsetSec: 0, open: async () => new Blob([]) },
    { index: 1, title: 'B', durationSec: 50, startOffsetSec: 100, open: async () => new Blob([]) },
  ],
  chapters: [
    { index: 0, title: 'Ch 1', startSec: 0 },
    { index: 1, title: 'Ch 2', startSec: 120 },
  ],
};

describe('bookmarkRecordToPlayer', () => {
  it('adds track startOffsetSec to locator.positionSec', () => {
    const record: BookmarkRecord = {
      id: 'm1',
      bookId: 'b1',
      label: 'Note',
      createdAt: 1,
      locator: { kind: 'audio', trackIndex: 1, positionSec: 10 },
    };
    expect(bookmarkRecordToPlayer(record, item)).toEqual({
      id: 'm1',
      positionSec: 110,
      label: 'Note',
      chapter: 'Ch 1',
    });
  });

  it('omits empty labels', () => {
    const record: BookmarkRecord = {
      id: 'm2',
      bookId: 'b1',
      label: '   ',
      createdAt: 1,
      locator: { kind: 'audio', trackIndex: 0, positionSec: 5 },
    };
    expect(bookmarkRecordToPlayer(record, item)?.label).toBeUndefined();
  });
});

describe('locatorFromBookPositionSec', () => {
  it('is the inverse of book position mapping', () => {
    const locator = locatorFromBookPositionSec(item, 110);
    expect(locator).toEqual({ kind: 'audio', trackIndex: 1, positionSec: 10 });
  });
});
