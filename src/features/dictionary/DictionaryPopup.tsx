import type { CSSProperties } from 'react';
import type { DefinitionResult, TranslationResult } from '@/engines/dictionary/types';
import { Button } from '@/ui';
import './dictionary.css';

export interface DictionaryPopupProps {
  readonly word: string;
  readonly anchor?: DOMRect;
  readonly definition?: DefinitionResult;
  readonly translation?: TranslationResult;
  readonly loading?: boolean;
  readonly needsDownload?: boolean;
  readonly downloadLabel?: string;
  readonly onDownload?: () => void;
  readonly onClose: () => void;
}

/** Warm-paper popup for definitions and translation beside the reading surface. */
export function DictionaryPopup({
  word,
  anchor,
  definition,
  translation,
  loading,
  needsDownload,
  downloadLabel,
  onDownload,
  onClose,
}: DictionaryPopupProps) {
  const style = anchor
    ? {
        top: Math.max(8, anchor.bottom + 8),
        left: Math.min(Math.max(8, anchor.left), window.innerWidth - 280),
      }
    : { top: '30%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="pn-dict-popup" role="dialog" aria-label={`Definition of ${word}`} style={style as CSSProperties}>
      <header className="pn-dict-popup__head">
        <h2 className="pn-dict-popup__word">{word}</h2>
        <Button iconOnly variant="ghost" icon="close" aria-label="Close" onClick={onClose} />
      </header>
      {loading ? <p className="pn-dict-popup__muted">Looking up…</p> : null}
      {needsDownload ? (
        <div className="pn-dict-popup__cta">
          <p className="pn-dict-popup__muted">Download the free offline pack to look up words without internet.</p>
          {downloadLabel ? <p className="pn-dict-popup__size">{downloadLabel}</p> : null}
          <Button variant="primary" onClick={onDownload}>
            Download
          </Button>
        </div>
      ) : null}
      {!loading && !needsDownload && definition?.senses.length ? (
        <section className="pn-dict-popup__section" aria-label="Definition">
          <h3 className="pn-dict-popup__label">Definition</h3>
          <ul className="pn-dict-popup__list">
            {definition.senses.map((sense, i) => (
              <li key={i}>
                <span className="pn-dict-popup__pos">{sense.pos}</span>
                {sense.glosses.map((g, j) => (
                  <p key={j} className="pn-dict-popup__gloss">
                    {g}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!loading && !needsDownload && definition && !definition.senses.length ? (
        <p className="pn-dict-popup__muted">No definition found in the offline dictionary.</p>
      ) : null}
      {translation?.translation ? (
        <section className="pn-dict-popup__section" aria-label="Translation">
          <h3 className="pn-dict-popup__label">Translation</h3>
          <p className="pn-dict-popup__translation" lang={translation.targetLang}>
            {translation.translation}
          </p>
        </section>
      ) : null}
    </div>
  );
}
