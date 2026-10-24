import { memo, useMemo } from 'react';
import type { ResumeInfo } from '@/data/resume';
import { ResumeCard, Skeleton } from '@/ui';

/**
 * Height reserved for the "Welcome back" card while it is not there yet, in `rem` so it follows
 * the text size. It is the card's measured height at 360 px (cover 64 px, heading, one line,
 * progress bar, buttons, 16 px padding), so nothing moves when the real card replaces it.
 */
export const RESUME_CARD_HEIGHT_REM = 10;

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

/** Same size as {@link LibraryResume}, shown while the saved position is being read. */
export function LibraryResumeSkeleton() {
  return (
    <div aria-hidden="true" style={{ height: `${RESUME_CARD_HEIGHT_REM}rem` }}>
      <Skeleton variant="rect" height="100%" className="w-full" />
    </div>
  );
}
