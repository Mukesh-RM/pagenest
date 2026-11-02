import type { BookmarkRecord, HighlightRecord } from '@/data/schema';

export interface MarksExportInput {
  readonly bookTitle: string;
  readonly exportedAt: Date;
  readonly bookmarks: readonly BookmarkRecord[];
  readonly highlights: readonly HighlightRecord[];
}

/** Plain-text export for highlights, notes and bookmarks (blueprint §5: tap-to-jump list with export). */
export function buildMarksExportText(input: MarksExportInput): string {
  const { bookTitle, exportedAt, bookmarks, highlights } = input;
  const lines: string[] = [
    `InkQuiet marks export`,
    `Book: ${bookTitle}`,
    `Exported: ${exportedAt.toISOString()}`,
    '',
  ];
  if (highlights.length) {
    lines.push('## Highlights and notes', '');
    for (const row of highlights) {
      lines.push(`- [${row.color}] ${row.text.replace(/\s+/g, ' ').trim()}`);
      if (row.note?.trim()) lines.push(`  Note: ${row.note.trim()}`);
      lines.push('');
    }
  } else {
    lines.push('No highlights yet.', '');
  }
  if (bookmarks.length) {
    lines.push('## Bookmarks', '');
    for (const row of bookmarks) {
      lines.push(`- ${row.label || 'Bookmark'}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function marksExportFileName(bookTitle: string, now: Date = new Date()): string {
  const safe = bookTitle.replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 48) || 'book';
  const day = now.toISOString().slice(0, 10);
  return `InkQuiet marks ${safe} ${day}.txt`;
}

export function downloadMarksExport(input: MarksExportInput): void {
  const body = buildMarksExportText(input);
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = marksExportFileName(input.bookTitle, input.exportedAt);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
