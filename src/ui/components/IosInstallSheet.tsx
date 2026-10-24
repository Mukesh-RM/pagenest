import { Icon, type IconName } from '../icons';
import { BottomSheet, type SheetCloseReason } from './BottomSheet';
import { Button } from './Button';

export interface IosInstallSheetProps {
  open: boolean;
  /** Called for every dismissal (back, Esc, scrim, swipe, Got it). */
  onClose: (reason: SheetCloseReason | 'done') => void;
  title?: string;
  doneLabel?: string;
}

interface Step {
  icon: IconName;
  /** Plain words; the bold part is the exact label iOS shows. */
  before: string;
  strong: string;
  after: string;
}

const STEPS: readonly Step[] = [
  { icon: 'share', before: 'Tap', strong: 'Share', after: 'in the Safari toolbar.' },
  { icon: 'squarePlus', before: 'Scroll and tap', strong: 'Add to Home Screen', after: '.' },
  { icon: 'check', before: 'Tap', strong: 'Add', after: 'in the top corner. PageNest is now on your home screen.' },
];

/**
 * One-time iPhone install sheet with three steps and a small illustration (blueprint 5.6).
 * Built on {@link BottomSheet}, so back, Esc, swipe down and focus handling come for free.
 * Props only: the Shell decides when to show it and remembers that it was shown.
 */
export function IosInstallSheet({
  open,
  onClose,
  title = 'Add PageNest to your iPhone',
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
      <p className="pn-ios-install__intro">Installing lets PageNest open full screen and keep playing with the screen locked.</p>
      <ol className="pn-ios-install__steps">
        {STEPS.map((step, index) => (
          <li key={step.strong} className="pn-ios-install__step">
            <span className="pn-ios-install__art" aria-hidden="true">
              <Icon name={step.icon} size={28} />
            </span>
            <span className="pn-ios-install__label">
              <span className="pn-visually-hidden">{`Step ${index + 1}: `}</span>
              {step.before} <strong>{step.strong}</strong> {step.after}
            </span>
          </li>
        ))}
      </ol>
    </BottomSheet>
  );
}
