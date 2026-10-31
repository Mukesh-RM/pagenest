import { Icon, type IconName } from '../icons';

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
  { icon: 'check', before: 'Tap', strong: 'Add', after: 'in the top corner. InkQuiet is now on your home screen.' },
];

/** The three iPhone install steps (Share, Add to Home Screen, Add) as an ordered list with small illustrations. */
export function IosInstallSteps() {
  return (
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
  );
}
