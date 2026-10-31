import { useEffect, useRef, useState } from 'react';
import type { SearchHit } from '@/engines/reader/types';
import { BottomSheet, Button, cx, type SheetCloseReason } from '@/ui';
import type { ReaderDocumentExt } from '../core/ext-types';
import { collectSearchHits } from './marks';

interface Props {
  readonly open: boolean;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly doc: ReaderDocumentExt | undefined;
  readonly onJump: (hit: SearchHit) => void;
}

/** In-book search: results list with jump and transient hit marks on the page. */
export function SearchSheet({ open, onClose, doc, onJump }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<readonly SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | undefined>();

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setHits([]);
      setQuery('');
      doc?.showSearchHits([]);
      return;
    }
    return () => abortRef.current?.abort();
  }, [open, doc]);

  const runSearch = (): void => {
    if (!doc || !query.trim()) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    void collectSearchHits(doc, query.trim(), ac.signal)
      .then((list) => {
        setHits(list);
        doc.showSearchHits(list.map((h) => h.range));
      })
      .finally(() => setBusy(false));
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Search in this book" className="pn-live-search">
      <form
        className="pn-live-search__form"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <label className="pn-visually-hidden" htmlFor="pn-live-search-q">Search in this book</label>
        <input
          id="pn-live-search-q"
          type="search"
          className="pn-live-search__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" disabled={busy || !query.trim()}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>
      {hits.length ? (
        <ul className="pn-live-list" aria-label="Search results">
          {hits.map((hit, i) => (
            <li key={i}>
              <button
                type="button"
                className="pn-live-list__row"
                onClick={() => {
                  onJump(hit);
                  doc?.showSearchHits([hit.range]);
                }}
              >
                <span className={cx('pn-live-search__excerpt')}>
                  {hit.excerpt.slice(0, hit.matchStart)}
                  <mark>{hit.excerpt.slice(hit.matchStart, hit.matchEnd)}</mark>
                  {hit.excerpt.slice(hit.matchEnd)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pn-live-search__hint">{query.trim() ? (busy ? 'Searching…' : 'No matches in this book.') : 'Type a word or phrase.'}</p>
      )}
    </BottomSheet>
  );
}
