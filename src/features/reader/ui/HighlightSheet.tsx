import { useEffect, useRef, useState } from 'react';
import type { HighlightRecord } from '@/data/schema';
import type { HighlightColor } from '@/engines/reader/types';
import { BottomSheet, Button, cx, type SheetCloseReason } from '@/ui';
import { HIGHLIGHT_FILL } from '../core/appearance';
import { HIGHLIGHT_COLORS, HIGHLIGHT_LABEL } from './highlight-colors';

interface Props {
  readonly highlight: HighlightRecord | undefined;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly onColor: (color: HighlightColor) => void;
  /** Save the note (an empty text removes it). */
  readonly onNote: (note: string) => void;
  readonly onDelete: () => void;
  readonly onCopy: () => void;
}

/** Edit one highlight: color, note, copy, delete. The note saves when the sheet closes. */
export function HighlightSheet({ highlight, onClose, onColor, onNote, onDelete, onCopy }: Props) {
  const [note, setNote] = useState(highlight?.note ?? '');
  const area = useRef<HTMLTextAreaElement>(null);
  const lastId = useRef<string>();
  const latest = useRef({ note, highlight, onNote });
  latest.current = { note, highlight, onNote };

  useEffect(() => {
    if (highlight && lastId.current !== highlight.id) setNote(highlight.note ?? '');
    lastId.current = highlight?.id;
  }, [highlight]);

  const close = (reason: SheetCloseReason): void => {
    const { note: text, highlight: h } = latest.current;
    if (h && text.trim() !== (h.note ?? '')) latest.current.onNote(text);
    onClose(reason);
  };

  return (
    <BottomSheet open={Boolean(highlight)} onClose={close} title="Highlight" initialFocusRef={area} className="pn-hlsheet">
      {highlight ? (
        <div className="pn-hlsheet__body">
          <blockquote className="pn-hlsheet__quote" style={{ ['--pn-hl' as string]: HIGHLIGHT_FILL[highlight.color] }}>
            {highlight.text}
          </blockquote>
          <div role="radiogroup" aria-label="Highlight color" className="pn-hlsheet__colors">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={highlight.color === c}
                aria-label={HIGHLIGHT_LABEL[c]}
                className={cx('pn-dot', highlight.color === c && 'pn-dot--selected')}
                style={{ ['--pn-hl' as string]: HIGHLIGHT_FILL[c] }}
                onClick={() => onColor(c)}
              />
            ))}
          </div>
          <label className="pn-hlsheet__label" htmlFor="pn-note">
            Note
          </label>
          <textarea
            id="pn-note"
            ref={area}
            className="pn-hlsheet__note"
            rows={4}
            placeholder="Write a note (saved on this device)"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <div className="pn-hlsheet__actions">
            <Button variant="secondary" onClick={onCopy}>
              Copy text
            </Button>
            <Button variant="danger" onClick={onDelete}>
              Delete highlight
            </Button>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
