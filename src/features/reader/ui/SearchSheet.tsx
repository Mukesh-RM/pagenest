import { useEffect, useRef, useState } from 'react';
import type { TextRange } from '@/app/contracts';
import type { SearchHit } from '@/engines/reader/types';
import { BottomSheet, EmptyState, type SheetCloseReason } from '@/ui';
import { frameThrottle } from '../core/emitter';
import type { ReaderDocumentExt } from '../core/ext-types';
import { Search } from './icons';

interface Props {
  readonly open: boolean;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly doc: ReaderDocumentExt | undefined;
  /** A result was chosen: go there and mark every hit on the pages. */
  readonly onPick: (hit: SearchHit, all: readonly TextRange[]) => void;
}

const MAX_HITS = 500;
const DEBOUNCE_MS = 250;

type Status = 'idle' | 'searching' | 'done';

/** In-book search. Results stream in while the rest of the book is still being read. */
export function SearchSheet({ open, onClose, doc, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<readonly SearchHit[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const input = useRef<HTMLInputElement>(null);

  // A different book starts with a clean search.
  useEffect(() => {
    setQuery('');
    setHits([]);
    setStatus('idle');
  }, [doc]);

  useEffect(() => {
    const q = query.trim();
    if (!doc || q.length < 2) {
      setHits([]);
      setStatus('idle');
      return undefined;
    }
    const abort = new AbortController();
    const found: SearchHit[] = [];
    const publish = frameThrottle(() => setHits(found.slice()));
    setStatus('searching');
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          for await (const hit of doc.search(q, abort.signal)) {
            found.push(hit);
            publish();
            if (found.length >= MAX_HITS) break;
          }
        } catch {
          /* a damaged section ends the search with what was found */
        }
        if (abort.signal.aborted) return;
        publish.cancel();
        setHits(found.slice());
        setStatus('done');
      })();
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
      publish.cancel();
    };
  }, [doc, query]);

  const summary =
    status === 'searching'
      ? `Searching the whole book… ${hits.length} ${hits.length === 1 ? 'match' : 'matches'} so far`
      : status === 'done'
        ? hits.length === 0
          ? `No matches for “${query.trim()}”`
          : `${hits.length >= MAX_HITS ? `First ${MAX_HITS}` : hits.length} ${hits.length === 1 ? 'match' : 'matches'}`
        : '';

  return (
    <BottomSheet open={open} onClose={onClose} title="Search in book" initialFocusRef={input} className="pn-search">
      <div className="pn-search__field">
        <Search size={20} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          className="pn-search__input"
          placeholder="Search words or phrases"
          aria-label="Search in this book"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>
      <p className="pn-search__status" role="status" aria-live="polite">
        {summary}
      </p>
      {hits.length ? (
        <ul className="pn-list" aria-label="Search results">
          {hits.map((hit, i) => (
            <li key={`${i}-${hit.matchStart}`}>
              <button type="button" className="pn-list__row" onClick={() => onPick(hit, hits.map((h) => h.range))}>
                <span className="pn-list__quote">
                  {hit.excerpt.slice(0, hit.matchStart)}
                  <mark className="pn-mark">{hit.excerpt.slice(hit.matchStart, hit.matchEnd)}</mark>
                  {hit.excerpt.slice(hit.matchEnd)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : status === 'idle' ? (
        <EmptyState art={<Search size={40} aria-hidden="true" />} title="Search this book" description="Type at least two letters. Matches are marked on the page." headingLevel={3} />
      ) : null}
    </BottomSheet>
  );
}
