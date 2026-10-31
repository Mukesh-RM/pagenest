import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface ChoiceOption<T extends string> {
  value: T;
  /** Visible label, also the accessible name unless `ariaLabel` is given. */
  label: ReactNode;
  ariaLabel?: string;
  /** Extra visual (a swatch, a type sample) shown above the label. */
  preview?: ReactNode;
}

export interface ChoiceGroupProps<T extends string> {
  /** Accessible name of the group: "Font", "Theme", "Line spacing". */
  label: string;
  value: T;
  options: ReadonlyArray<ChoiceOption<T>>;
  onChange: (value: T) => void;
  /** "segmented": equal-width pills in one row. "tiles": preview tiles that wrap. */
  variant?: 'segmented' | 'tiles';
  className?: string;
}

/**
 * Single choice from a few options, as a radio group (role="radiogroup", role="radio", aria-checked) with the
 * arrow-key behavior of native radios: Left/Right/Up/Down move and select, Home/End jump. Only the selected option
 * is in the tab order. 44 px targets.
 */
export function ChoiceGroup<T extends string>({ label, value, options, onChange, variant = 'segmented', className }: ChoiceGroupProps<T>) {
  const name = useId();
  const select = (index: number, focus: boolean, event: KeyboardEvent<HTMLElement>) => {
    const wrapped = (index + options.length) % options.length;
    const next = options[wrapped];
    if (!next) return;
    event.preventDefault();
    onChange(next.value);
    if (focus) {
      const group = event.currentTarget.parentElement;
      window.requestAnimationFrame(() => group?.querySelectorAll<HTMLElement>('[role="radio"]')[wrapped]?.focus());
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') select(index + 1, true, event);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') select(index - 1, true, event);
    else if (event.key === 'Home') select(0, true, event);
    else if (event.key === 'End') select(options.length - 1, true, event);
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx('pn-choice', `pn-choice--${variant}`, className)}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            id={`${name}-${option.value}`}
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            className={cx('pn-choice__option', checked && 'pn-choice__option--checked')}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.preview ? <span className="pn-choice__preview" aria-hidden="true">{option.preview}</span> : null}
            <span className="pn-choice__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
