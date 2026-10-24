import { useId, useRef, type FormEvent } from 'react';
import { MAX_SHELF_NAME_LENGTH } from '../screens/collectionsOptions';
import { BottomSheet, type SheetCloseReason } from './BottomSheet';
import { Button } from './Button';

export interface CollectionNameSheetProps {
  open: boolean;
  /** `create` titles the sheet "New collection", `rename` "Rename collection". */
  mode: 'create' | 'rename';
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  onClose: (reason: SheetCloseReason) => void;
  /** Plain-word problem from the data layer ("You already have a collection called that."). */
  error?: string;
  /** Saving: the button is disabled and says so. */
  busy?: boolean;
  maxLength?: number;
}

/** Name field in a bottom sheet for making or renaming a collection. Focus starts in the field; Enter saves. */
export function CollectionNameSheet({
  open,
  mode,
  name,
  onNameChange,
  onSubmit,
  onClose,
  error,
  busy = false,
  maxLength = MAX_SHELF_NAME_LENGTH,
}: CollectionNameSheetProps) {
  const fieldId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() !== '' && !busy) onSubmit();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={mode === 'create' ? 'New collection' : 'Rename collection'} initialFocusRef={inputRef}>
      <form className="pn-nameform" onSubmit={submit}>
        <label htmlFor={fieldId} className="pn-nameform__label">
          Name
        </label>
        <input
          ref={inputRef}
          id={fieldId}
          className="pn-textfield"
          value={name}
          maxLength={maxLength}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onNameChange(event.target.value)}
        />
        {error ? (
          <p id={errorId} role="alert" className="pn-nameform__error">
            {error}
          </p>
        ) : null}
        <Button type="submit" block disabled={name.trim() === '' || busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </BottomSheet>
  );
}
