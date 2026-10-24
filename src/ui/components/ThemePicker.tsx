import { useEffect, useId, useMemo, useState } from 'react';
import { Icon } from '../icons';
import {
  DEFAULT_CUSTOM_THEME,
  normalizeHex,
  resolveCustomTheme,
  type CustomThemeInput,
} from '../theme/custom';
import { THEME_PALETTE } from '../theme/palette';
import { THEME_NAMES, type ThemeChoice, type ThemeName } from '../theme/themes';
import { cx } from '../utils/cx';

export interface ThemePickerProps {
  value: ThemeChoice;
  onChange: (choice: ThemeChoice) => void;
  /** The three Custom colors (any shape; invalid ones are corrected for display). */
  custom?: Partial<CustomThemeInput>;
  onCustomChange: (next: CustomThemeInput) => void;
  /** Show the "Match my phone" row. Default true. */
  includeSystem?: boolean;
  /** Visible group name. Default "Theme". */
  legend?: string;
  className?: string;
}

const LABELS: Record<ThemeName | 'custom', string> = { light: 'Light', sepia: 'Sepia', dark: 'Dark', black: 'Black', custom: 'Custom' };

interface Face {
  page: string;
  text: string;
  accent: string;
  line: string;
}

function faceOf(name: ThemeName): Face {
  const p = THEME_PALETTE[name];
  return { page: p.page, text: p.text, accent: p.accent, line: p['border-strong'] };
}

/**
 * The five themes of blueprint 5.2 as cards, plus "Match my phone". Native radio inputs inside labels, so arrow keys
 * move the choice and each card is named by the theme alone ("Light", "Custom"). The chosen card has a thick accent
 * ring AND a check badge, so selection never relies on color alone. Choosing Custom opens three color fields (page,
 * text, accent); the colors are corrected on the fly when they would be hard to read, and the picker says so.
 */
export function ThemePicker({ value, onChange, custom, onCustomChange, includeSystem = true, legend = 'Theme', className }: ThemePickerProps) {
  const group = useId();
  const resolved = useMemo(() => resolveCustomTheme(custom), [custom]);
  const customFace: Face = { page: resolved.palette.page, text: resolved.palette.text, accent: resolved.palette.accent, line: resolved.palette['border-strong'] };
  return (
    <fieldset className={cx('pn-themes', className)}>
      <legend className="pn-themes__legend">{legend}</legend>
      <div className="pn-themes__grid">
        {([...THEME_NAMES, 'custom'] as const).map((name) => {
          const face = name === 'custom' ? customFace : faceOf(name);
          const selected = value === name;
          return (
            <label key={name} className={cx('pn-theme-card', selected && 'pn-theme-card--selected')}>
              <input type="radio" name={group} value={name} checked={selected} onChange={() => onChange(name)} className="pn-theme-card__input" />
              <span className="pn-theme-card__face" style={{ background: face.page, color: face.text, borderColor: face.line }}>
                <span className="pn-theme-card__name">{LABELS[name]}</span>
                <span className="pn-theme-card__sample" aria-hidden="true">
                  <span className="pn-theme-card__bar" style={{ background: face.accent }} />
                  <span className="pn-theme-card__bar pn-theme-card__bar--short" style={{ background: face.text }} />
                </span>
              </span>
              {selected ? (
                <span className="pn-theme-card__check" aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      {includeSystem ? (
        <label className="pn-themes__system">
          <input type="radio" name={group} value="system" checked={value === 'system'} onChange={() => onChange('system')} />
          <span>Match my phone</span>
        </label>
      ) : null}
      {value === 'custom' ? <CustomColors input={resolved.input} adjusted={resolved.adjusted.text || resolved.adjusted.accent} onChange={onCustomChange} /> : null}
    </fieldset>
  );
}

const FIELDS: ReadonlyArray<{ key: keyof CustomThemeInput; label: string }> = [
  { key: 'page', label: 'Page' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Accent' },
];

function CustomColors({ input, adjusted, onChange }: { input: CustomThemeInput; adjusted: boolean; onChange: (next: CustomThemeInput) => void }) {
  return (
    <div className="pn-custom" role="group" aria-label="Custom colors">
      {FIELDS.map((f) => (
        <ColorField key={f.key} label={f.label} value={input[f.key]} onChange={(hex) => onChange({ ...input, [f.key]: hex })} />
      ))}
      <p className="pn-custom__note" role="status">
        {adjusted ? 'We nudged a color a little so your text stays easy to read.' : 'Every color you pick is checked so your text stays easy to read.'}
      </p>
      <button type="button" className="pn-custom__reset" onClick={() => onChange({ ...DEFAULT_CUSTOM_THEME })}>
        Reset to the starting colors
      </button>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  // The saved value is the source of truth: show it again after an outside change.
  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);
  const commit = (text: string) => {
    setDraft(text);
    const hex = normalizeHex(text, '');
    setInvalid(text.trim() !== '' && !hex);
    if (hex && hex !== value) onChange(hex);
  };
  return (
    <div className="pn-custom__row">
      <label htmlFor={id} className="pn-custom__label">
        {label}
      </label>
      <input id={id} type="color" className="pn-custom__swatch" value={value} onChange={(event) => commit(event.target.value)} />
      <input
        type="text"
        className="pn-custom__hex"
        aria-label={`${label} color as a hex code`}
        aria-invalid={invalid || undefined}
        value={draft}
        maxLength={7}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        onChange={(event) => commit(event.target.value)}
        onBlur={() => {
          setDraft(value);
          setInvalid(false);
        }}
      />
      {invalid ? (
        <span className="pn-custom__error" role="alert">
          Use a code like #1e2230
        </span>
      ) : null}
    </div>
  );
}
