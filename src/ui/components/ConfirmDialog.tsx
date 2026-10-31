import { useRef, type ReactNode } from 'react';
import { BottomSheet, type SheetCloseReason } from './BottomSheet';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  /** Plain question: "Remove this book?" */
  title: string;
  /** What will happen, in plain words, including what is kept: "Your notes stay in your backup." */
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * Destructive confirmations get the one filled red button in the app. Everything else uses the primary teal
   * button. Cancel is always the calm default and receives focus first.
   */
  destructive?: boolean;
  onConfirm: () => void;
  /** Cancel button, Esc, the back gesture, a tap outside, or a swipe down. */
  onCancel: (reason: SheetCloseReason | 'cancel') => void;
}

/**
 * Confirmation dialog (role="dialog", aria-modal) built on {@link BottomSheet}: focus trap, Esc and back close it,
 * focus returns to the control that opened it. The ONLY place a filled red button appears.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      className="pn-confirm"
      footer={
        <div className="pn-confirm__actions">
          <Button ref={cancelRef} variant="secondary" onClick={() => onCancel('cancel')}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger-solid' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description ? <p className="pn-confirm__description">{description}</p> : null}
    </BottomSheet>
  );
}
