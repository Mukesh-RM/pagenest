import { lazy, Suspense, useEffect, useState, type ComponentProps } from 'react';
import { whenIdle } from '../idle';
import type { BookDetailHost as Host } from './BookDetailHost';

const loadHost = () => import('./BookDetailHost').then((m) => ({ default: m.BookDetailHost }));
const BookDetailHost = lazy(loadHost);

/**
 * The detail sheet and its confirmation are not part of the Library's first paint. Their code
 * (bottom sheet, dialog, detail view) is fetched when the browser is idle after the grid is up, so
 * the first tap on a book normally finds it ready. The sheet is an overlay: while it loads nothing
 * in the page moves.
 */
export function LazyBookDetailHost(props: ComponentProps<typeof Host>) {
  const [wanted, setWanted] = useState(false);
  useEffect(() => whenIdle(() => void loadHost()), []);
  useEffect(() => {
    if (props.opened) setWanted(true);
  }, [props.opened]);
  return props.opened || wanted ? (
    <Suspense fallback={null}>
      <BookDetailHost {...props} />
    </Suspense>
  ) : null;
}
