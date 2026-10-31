import { memo, useMemo } from 'react';
import type { ResumeInfo } from '@/data/resume';
import { ResumeCard } from '@/ui';

/** The design system's "Welcome back" card for the saved position, with where the person was in plain words. */
export const LibraryResume = memo(function LibraryResume({
  info,
  onResume,
  onDismiss,
}: {
  info: ResumeInfo;
  onResume: (info: ResumeInfo) => void;
  onDismiss: () => void;
}) {
  const book = useMemo(
    () => ({
      id: info.bookId,
      title: info.title,
      ...(info.author ? { author: info.author } : {}),
      progress: info.percent / 100,
      audio: info.kind === 'audio',
    }),
    [info],
  );
  const where = info.chapterNumber === undefined ? `${Math.round(info.percent)}%` : `chapter ${info.chapterNumber}`;
  return (
    <ResumeCard book={book} where={where} mode={info.mode === 'read' ? 'read' : 'listen'} onResume={() => onResume(info)} onDismiss={onDismiss} />
  );
});
