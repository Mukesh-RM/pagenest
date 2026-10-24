import { useId } from 'react';

interface Props {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  readonly onChange: (value: number) => void;
  readonly disabled?: boolean;
}

/** Labelled range input with its value spelled out, for the Aa sheet. */
export function Slider({ label, value, min, max, step, format, onChange, disabled }: Props) {
  const id = useId();
  return (
    <div className="pn-aa__row">
      <label htmlFor={id} className="pn-aa__label">
        {label}
        <span className="pn-aa__value">{format(value)}</span>
      </label>
      <input
        id={id}
        type="range"
        className="pn-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={format(value)}
        style={{ ['--f' as string]: (value - min) / (max - min) }}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}
