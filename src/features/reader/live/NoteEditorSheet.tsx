import { useEffect, useId, useState } from 'react';
import type { HighlightRecord } from '@/data/schema';
import { BottomSheet, Button, type SheetCloseReason } from '@/ui';

interface Props {
  readonly open: boolean;
  readonly highlight: HighlightRecord | undefined;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly onSave: (text: string) => void;
  readonly onDeleteNote: () => void;
  readonly onDeleteHighlight: () => void;
}

/** Add or edit the note on a highlight; delete note or whole highlight. */
export function NoteEditorSheet({ open, highlight, onClose, onSave, onDeleteNote, onDeleteHighlight }: Props) {
  const fieldId = useId();
  const [text, setText] = useState('');
  useEffect(() => {
    if (open && highlight) setText(highlight.note ?? '');
  }, [open, highlight]);
  if (!highlight) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title="Note" className="pn-live-note">
      <p className="pn-live-note__quote">{highlight.text.slice(0, 160)}{highlight.text.length > 160 ? '…' : ''}</p>
      <label className="pn-visually-hidden" htmlFor={fieldId}>
        Note for this highlight
      </label>
      <textarea
        id={fieldId}
        className="pn-live-note__field"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="pn-live-note__actions">
        <Button variant="primary" onClick={() => onSave(text)}>
          Save note
        </Button>
        {highlight.note ? (
          <Button variant="secondary" onClick={onDeleteNote}>
            Delete note
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onDeleteHighlight}>
          Delete highlight
        </Button>
      </div>
    </BottomSheet>
  );
}
