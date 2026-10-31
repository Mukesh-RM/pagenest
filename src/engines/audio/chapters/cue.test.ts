import { describe, expect, it } from 'vitest';
import { parseCueSheet } from './cue';

describe('parseCueSheet', () => {
  it('reads TRACK and INDEX markers', () => {
    const cue = `
FILE "book.mp3" MP3
  TRACK 01 AUDIO
    TITLE "Chapter One"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Chapter Two"
    INDEX 01 05:00:00
`;
    const chapters = parseCueSheet(cue);
    expect(chapters).toHaveLength(2);
    expect(chapters[0]?.title).toBe('Chapter One');
    expect(chapters[0]?.startSec).toBe(0);
    expect(chapters[1]?.startSec).toBe(300);
  });
});
