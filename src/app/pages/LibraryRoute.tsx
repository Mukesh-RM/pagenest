import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LibraryScreen } from '@/features/library';
import { loadResume, type ResumeInfo } from '@/data/resume';
import { LibraryResume, LibraryResumeSkeleton } from '../components/LibraryResume';
import { Screen } from '../components/PageHeader';
import { hadResumeCard, rememberResumeCard } from '../resume-hint';
import { pathForBook } from '../route-paths';
import { useServices } from '../services-context';
import '../screen-styles';

/**
 * The "Welcome back" card for the last saved position (design system `ResumeCard`). It reserves its
 * space from the first frame when the last visit showed one, so nothing moves when it arrives.
 */
function ResumeSlot() {
  const { db, progress } = useServices();
  const navigate = useNavigate();
  const resume = useLiveQuery(async () => ({ value: await loadResume(db) }), [db, progress]);
  const [hadCard] = useState(hadResumeCard);
  const [dismissed, setDismissed] = useState(false);
  const shown = resume?.value !== undefined;
  useEffect(() => {
    if (resume) rememberResumeCard(shown);
  }, [resume, shown]);
  const info = resume?.value;
  const go = useCallback((i: ResumeInfo) => navigate(pathForBook({ id: i.bookId, kind: i.kind })), [navigate]);
  const dismiss = useCallback(() => setDismissed(true), []);
  return useMemo(
    () => (resume === undefined ? hadCard ? <LibraryResumeSkeleton /> : null : info && !dismissed ? <LibraryResume info={info} onResume={go} onDismiss={dismiss} /> : null),
    [resume, hadCard, info, dismissed, go, dismiss],
  );
}

/**
 * Library home (route `/`): the Library's windowed `LibraryScreen` (search, filters, grid or list of
 * every book, importing, selecting, organizing, sample-book card) in the design system's page
 * frame, with the resume card on top.
 */
export function LibraryRoute() {
  return (
    <Screen>
      <ResumeSlot />
      <LibraryScreen />
    </Screen>
  );
}
