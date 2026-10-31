import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LibraryScreen } from '@/features/library';
import { loadResume, type ResumeInfo } from '@/data/resume';
import { LibraryResume } from '../components/LibraryResume';
import { Screen } from '../components/PageHeader';
import { scheduleOfflineWarm } from '../offline-warm';
import { pathForBook } from '../route-paths';
import { ScreenFallback } from '../ScreenFallback';
import { useServices } from '../services-context';
import '../screen-styles';

/**
 * The "Welcome back" card for the last saved position (design system `ResumeCard`), or nothing. The
 * Library is drawn only once the saved position has been read, with the card already in its header
 * slot (under the filter row, above the books), so the page title and the toolbar never move when the card arrives (layout shift 0). Until
 * then the route shows its skeleton, which has the same frame.
 */
function useResumeHeader(): { ready: boolean; header: ReactNode } {
  const { db, progress } = useServices();
  const navigate = useNavigate();
  const resume = useLiveQuery(async () => ({ value: await loadResume(db) }), [db, progress]);
  const [dismissed, setDismissed] = useState(false);
  const info = resume?.value;
  const go = useCallback((i: ResumeInfo) => navigate(pathForBook({ id: i.bookId, kind: i.kind })), [navigate]);
  const dismiss = useCallback(() => setDismissed(true), []);
  const header = useMemo(
    () => (info && !dismissed ? <LibraryResume info={info} onResume={go} onDismiss={dismiss} /> : undefined),
    [info, dismissed, go, dismiss],
  );
  return { ready: resume !== undefined, header };
}

/**
 * Library home (route `/`): the Library's windowed `LibraryScreen` (search, filters, grid or list of
 * every book, importing, selecting, organizing, sample-book card) in the design system's page
 * frame, with the resume card under the filter row.
 *
 * Header slot contract: the route passes the resume card as `header` (the Library renders it under
 * the filter row, above the books), and only draws the Library once the card question is answered,
 * so nothing moves when the card arrives.
 */
export function LibraryRoute() {
  const { ready, header } = useResumeHeader();
  const services = useServices();
  useEffect(() => {
    if (!ready) return undefined;
    return scheduleOfflineWarm(async () => (await import('../offline-assets')).offlineWarmTasks(services));
  }, [ready, services]);
  if (!ready) return <ScreenFallback />;
  return (
    <Screen>
      <LibraryScreen {...(header ? { header } : {})} />
    </Screen>
  );
}
