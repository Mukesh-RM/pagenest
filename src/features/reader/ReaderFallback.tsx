import './opening.css';

/** Shown while the reader's code is fetched. Words and a skeleton page, never a bare spinner. */
export function ReaderFallback() {
  return (
    <div className="pn-opening" role="status" aria-live="polite" style={{ position: 'fixed' }}>
      <div className="pn-opening__page" aria-hidden="true">
        <span className="pn-skeleton pn-skeleton--text" style={{ width: '60%' }} />
        <span className="pn-skeleton pn-skeleton--text" />
        <span className="pn-skeleton pn-skeleton--text" />
        <span className="pn-skeleton pn-skeleton--text" style={{ width: '85%' }} />
      </div>
      <p className="pn-opening__message">Getting the reader ready…</p>
    </div>
  );
}
