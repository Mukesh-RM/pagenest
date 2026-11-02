import { describe, expect, it } from 'vitest';
import { buildMarksExportText, marksExportFileName } from './marks-export';
import type { HighlightRecord } from '@/data/schema';

const hl = (partial: Partial<HighlightRecord> & Pick<HighlightRecord, 'text'>): HighlightRecord => ({
  id: 'h1',
  bookId: 'b1',
  range: {
    start: { kind: 'reflow', section: 0, textOffset: 0 },
    end: { kind: 'reflow', section: 0, textOffset: 10 },
  },
  text: partial.text,
  color: partial.color ?? 'yellow',
  note: partial.note,
  createdAt: 1,
});

describe('marks export', () => {
  it('includes highlights, notes and bookmarks in plain text', () => {
    const text = buildMarksExportText({
      bookTitle: 'Alice',
      exportedAt: new Date('2026-11-02T12:00:00.000Z'),
      bookmarks: [{ id: 'bm1', bookId: 'b1', locator: { kind: 'reflow', section: 0, textOffset: 0 }, label: 'Chapter 2', createdAt: 1 }],
      highlights: [hl({ text: 'Curiouser', note: 'Remember this', color: 'green' })],
    });
    expect(text).toContain('Book: Alice');
    expect(text).toContain('[green] Curiouser');
    expect(text).toContain('Note: Remember this');
    expect(text).toContain('- Chapter 2');
  });

  it('builds a safe download file name', () => {
    expect(marksExportFileName('Alice / Wonderland!!!')).toMatch(/^InkQuiet marks Alice-Wonderland 20\d{2}-\d{2}-\d{2}\.txt$/);
  });
});
