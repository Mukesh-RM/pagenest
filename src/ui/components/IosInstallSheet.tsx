import { BottomSheet, type SheetCloseReason } from './BottomSheet';
import { Button } from './Button';
import { IosInstallSteps } from './IosInstallSteps';

export interface IosInstallSheetProps {
  open: boolean;
  /** Called for every dismissal (back, Esc, scrim, swipe, Got it). */
  onClose: (reason: SheetCloseReason | 'done') => void;
  title?: string;
  doneLabel?: string;
}

/**
 * One-time iPhone install sheet with three steps and a small illustration (blueprint 5.6).
 * Built on {@link BottomSheet}, so back, Esc, swipe down and focus handling come for free.
 * Props only: the Shell decides when to show it and remembers that it was shown.
 */
export function IosInstallSheet({
  open,
  onClose,
  title = 'Add InkQuiet to your iPhone',
  doneLabel = 'Got it',
}: IosInstallSheetProps) {
  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <Button block onClick={() => onClose('done')}>
          {doneLabel}
        </Button>
      }
    >
      <p className="pn-ios-install__intro">Installing lets InkQuiet open full screen and keep playing with the screen locked.</p>
      <IosInstallSteps />
    </BottomSheet>
  );
}
