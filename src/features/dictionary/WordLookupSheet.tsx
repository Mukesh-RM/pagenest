import type { HighlightColor, ReaderSelection } from '@/engines/reader/types';
import { BottomSheet } from '@/ui';
import { SelectionActions } from '@/features/reader/live/SelectionActions';
import { useWordLookup } from './useWordLookup';
import './dictionary.css';

export interface WordLookupSheetProps {
  readonly open: boolean;
  readonly selection?: ReaderSelection;
  readonly wordTap?: { readonly token: number; readonly word: string; readonly anchor: DOMRect };
  readonly bookLanguage?: string;
  readonly lookupToken: number;
  readonly lookupMode: 'define' | 'translate' | undefined;
  readonly onLookupClose: () => void;
  readonly onHighlight: (color: HighlightColor) => void;
  readonly onCopy?: () => void;
  readonly onNote?: () => void;
  readonly onReadAloud?: () => void;
  readonly onDefine?: () => void;
  readonly onTranslate?: () => void;
  readonly onDismissSelection: () => void;
}

/** Opaque bottom sheet: word, definition / offline pack row, then selection actions and highlight swatches. */
export default function WordLookupSheet({
  open,
  selection,
  wordTap,
  bookLanguage,
  lookupToken,
  lookupMode,
  onLookupClose,
  onHighlight,
  onCopy,
  onNote,
  onReadAloud,
  onDefine,
  onTranslate,
  onDismissSelection,
}: WordLookupSheetProps) {
  const lookup = useWordLookup({
    selection,
    ...(wordTap ? { wordTap } : {}),
    ...(bookLanguage ? { bookLanguage } : {}),
    lookupToken,
    lookupMode,
  });

  const title = lookup.showLookup ? lookup.displayWord : selection?.text.slice(0, 48) ?? lookup.displayWord;

  const closeAll = (): void => {
    lookup.reset();
    onLookupClose();
    onDismissSelection();
  };

  return (
    <BottomSheet
      open={open}
      onClose={closeAll}
      title={title}
      hideTitle={false}
      className="pn-word-sheet"
      footer={
        selection ? (
          <SelectionActions
            onHighlight={onHighlight}
            {...(onCopy ? { onCopy } : {})}
            {...(onNote ? { onNote } : {})}
            {...(onReadAloud ? { onReadAloud } : {})}
            {...(onDefine ? { onDefine } : {})}
            {...(onTranslate ? { onTranslate } : {})}
          />
        ) : null
      }
    >
      {selection && !lookup.showLookup ? (
        <p className="pn-word-sheet__preview">
          {selection.text.slice(0, 200)}
          {selection.text.length > 200 ? '…' : ''}
        </p>
      ) : null}
      {lookup.showLookup ? (
        <div className="pn-word-sheet__lookup" role="region" aria-label={`Definition of ${lookup.displayWord}`}>
          {lookup.loading ? <p className="pn-word-sheet__muted">Looking up…</p> : null}
          {lookup.needsDownload ? (
            <button type="button" className="pn-word-sheet__offline-row" onClick={lookup.handleDownload}>
              <span className="pn-word-sheet__offline-title">Get offline dictionary</span>
              <span className="pn-word-sheet__offline-sub">
                Free pack for lookups without internet
                {lookup.downloadLabel ? ` · ${lookup.downloadLabel}` : ''}
              </span>
            </button>
          ) : null}
          {!lookup.loading && !lookup.needsDownload && lookup.definition?.senses.length ? (
            <ul className="pn-dict-popup__list">
              {lookup.definition.senses.map((sense, i) => (
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
          ) : null}
          {!lookup.loading && !lookup.needsDownload && lookup.definition && !lookup.definition.senses.length ? (
            <p className="pn-word-sheet__muted">No definition found in the offline dictionary.</p>
          ) : null}
          {lookup.translation?.translation ? (
            <section className="pn-dict-popup__section" aria-label="Translation">
              <h3 className="pn-dict-popup__label">Translation</h3>
              <p className="pn-dict-popup__translation" lang={lookup.translation.targetLang}>
                {lookup.translation.translation}
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
      {!lookup.showLookup && selection ? (
        <p className="pn-word-sheet__hint">Choose Define or Translate, or highlight the selection below.</p>
      ) : null}
    </BottomSheet>
  );
}
