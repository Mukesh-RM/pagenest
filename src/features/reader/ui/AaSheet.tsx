import { useEffect, type CSSProperties } from 'react';
import { BottomSheet, Chip, ChipGroup, cx, type SheetCloseReason } from '@/ui';
import type { ReaderAppearance } from '@/engines/reader/types';
import { LIMITS, THEME_ORDER, textContrast, themeColors } from '../core/appearance';
import { contrast, isSafeColor, parseColor, toHex } from '../core/color';
import { fontFaceCss, fontForFamily, READING_FONTS } from '../core/fonts';
import { THEME_PALETTE } from '@/ui/theme/palette';
import { Minus, Plus, ZoomIn, ZoomOut } from './icons';
import { IconButton } from './IconButton';
import { Slider } from './Slider';

interface Props {
  readonly open: boolean;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly appearance: ReaderAppearance;
  readonly onChange: (patch: Partial<ReaderAppearance>) => void;
  /** Fixed-layout books (PDF, comics) zoom instead of changing the font. */
  readonly fixed: boolean;
  readonly zoom?: { get(): number; set(zoom: number): void };
}

const THEME_LABEL: Record<(typeof THEME_ORDER)[number], string> = { light: 'Light', sepia: 'Sepia', dark: 'Dark', black: 'Black', custom: 'Custom' };
const DEFAULT_CUSTOM = { page: '#f0eadc', text: '#2b2b2b', accent: '#1d5fa8' };

function swatch(theme: (typeof THEME_ORDER)[number], appearance: ReaderAppearance): { page: string; text: string } {
  if (theme === 'custom') {
    const c = appearance.custom ?? DEFAULT_CUSTOM;
    return { page: c.page, text: c.text };
  }
  return { page: THEME_PALETTE[theme].page, text: THEME_PALETTE[theme].text };
}

function hex(value: string): string {
  const rgb = parseColor(value);
  return rgb ? toHex(rgb) : '#000000';
}

/** The Aa sheet: theme, font, size, spacing, margins, alignment and page turn. Changes apply live. */
export function AaSheet({ open, onClose, appearance, onChange, fixed, zoom }: Props) {
  // The sheet previews each font in its own face; the faces are only requested once the sheet opens.
  useEffect(() => {
    if (!open) return undefined;
    const style = document.createElement('style');
    style.dataset['pnReaderFonts'] = '';
    style.textContent = READING_FONTS.map(fontFaceCss).join('\n');
    document.head.append(style);
    return () => style.remove();
  }, [open]);

  const custom = appearance.custom ?? DEFAULT_CUSTOM;
  const colors = themeColors(appearance);
  const textRatio = textContrast(appearance);
  const accentRatio = contrast(colors.accent, colors.page) ?? 1;
  const weak = appearance.theme === 'custom' && (textRatio < 4.5 || accentRatio < 4.5);
  const currentFont = fontForFamily(appearance.fontFamily);
  const setCustom = (key: 'page' | 'text' | 'accent', value: string): void => {
    if (!isSafeColor(value)) return;
    onChange({ theme: 'custom', custom: { ...custom, [key]: value } });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Text and look" className="pn-aa">
      <div className="pn-aa__body">
        <div role="radiogroup" aria-label="Theme" className="pn-aa__themes">
          {THEME_ORDER.map((theme) => {
            const s = swatch(theme, appearance);
            const selected = appearance.theme === theme;
            return (
              <button
                key={theme}
                type="button"
                role="radio"
                aria-checked={selected}
                className={cx('pn-aa__theme', selected && 'pn-aa__theme--selected')}
                style={{ ['--sw-page' as string]: s.page, ['--sw-text' as string]: s.text } as CSSProperties}
                onClick={() => onChange({ theme, ...(theme === 'custom' && !appearance.custom ? { custom: DEFAULT_CUSTOM } : {}) })}
              >
                <span className="pn-aa__swatch" aria-hidden="true">
                  Aa
                </span>
                <span className="pn-aa__theme-name">{THEME_LABEL[theme]}</span>
              </button>
            );
          })}
        </div>

        {appearance.theme === 'custom' ? (
          <div className="pn-aa__custom">
            {(['page', 'text', 'accent'] as const).map((key) => (
              <label key={key} className="pn-aa__color">
                <span>{key === 'page' ? 'Page' : key === 'text' ? 'Text' : 'Links'}</span>
                <input type="color" value={hex(custom[key])} onChange={(e) => setCustom(key, e.currentTarget.value)} />
              </label>
            ))}
            <p className={cx('pn-aa__hint', weak && 'pn-aa__hint--warn')} role={weak ? 'alert' : undefined}>
              {weak
                ? `Hard to read: text is ${textRatio.toFixed(1)} to 1 on the page and links are ${accentRatio.toFixed(1)} to 1. Aim for at least 4.5 to 1.`
                : `Good contrast: ${textRatio.toFixed(1)} to 1.`}
            </p>
          </div>
        ) : null}

        {fixed ? (
          <div className="pn-aa__row">
            <span className="pn-aa__label">
              Zoom
              <span className="pn-aa__value">{zoom ? `${Math.round(zoom.get() * 100)}%` : ''}</span>
            </span>
            <div className="pn-aa__stepper">
              <IconButton icon={ZoomOut} label="Zoom out" disabled={!zoom} onClick={() => zoom?.set(zoom.get() / 1.2)} />
              <IconButton icon={ZoomIn} label="Zoom in" disabled={!zoom} onClick={() => zoom?.set(zoom.get() * 1.2)} />
            </div>
            <p className="pn-aa__hint">Pages keep their own fonts. Pinch or press plus and minus to zoom.</p>
          </div>
        ) : (
          <>
            <div className="pn-aa__row">
              <span className="pn-aa__label" id="pn-aa-font">
                Font
              </span>
              <div className="pn-aa__fonts" role="radiogroup" aria-labelledby="pn-aa-font">
                {READING_FONTS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    role="radio"
                    aria-checked={currentFont.id === font.id}
                    className={cx('pn-chip', currentFont.id === font.id && 'pn-chip--selected')}
                    style={{ fontFamily: font.family }}
                    onClick={() => onChange({ fontFamily: font.family })}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pn-aa__row">
              <span className="pn-aa__label">
                Text size
                <span className="pn-aa__value">{appearance.fontSizePx} px</span>
              </span>
              <div className="pn-aa__stepper">
                <IconButton
                  icon={Minus}
                  label="Smaller text"
                  shortcut="-"
                  disabled={appearance.fontSizePx <= LIMITS.fontSizePx.min}
                  onClick={() => onChange({ fontSizePx: appearance.fontSizePx - 2 })}
                />
                <input
                  type="range"
                  className="pn-slider"
                  aria-label="Text size"
                  min={LIMITS.fontSizePx.min}
                  max={LIMITS.fontSizePx.max}
                  step={LIMITS.fontSizePx.step}
                  value={appearance.fontSizePx}
                  aria-valuetext={`${appearance.fontSizePx} pixels`}
                  style={{ ['--f' as string]: (appearance.fontSizePx - LIMITS.fontSizePx.min) / (LIMITS.fontSizePx.max - LIMITS.fontSizePx.min) }}
                  onChange={(e) => onChange({ fontSizePx: Number(e.currentTarget.value) })}
                />
                <IconButton
                  icon={Plus}
                  label="Larger text"
                  shortcut="+"
                  disabled={appearance.fontSizePx >= LIMITS.fontSizePx.max}
                  onClick={() => onChange({ fontSizePx: appearance.fontSizePx + 2 })}
                />
              </div>
            </div>

            <Slider
              label="Line spacing"
              value={appearance.lineHeight}
              min={LIMITS.lineHeight.min}
              max={LIMITS.lineHeight.max}
              step={LIMITS.lineHeight.step}
              format={(v) => v.toFixed(2)}
              onChange={(lineHeight) => onChange({ lineHeight })}
            />
            <Slider
              label="Paragraph spacing"
              value={appearance.paragraphSpacingEm}
              min={LIMITS.paragraphSpacingEm.min}
              max={LIMITS.paragraphSpacingEm.max}
              step={LIMITS.paragraphSpacingEm.step}
              format={(v) => `${v.toFixed(1)} em`}
              onChange={(paragraphSpacingEm) => onChange({ paragraphSpacingEm })}
            />

            <div className="pn-aa__row">
              <span className="pn-aa__label" id="pn-aa-margins">
                Margins
              </span>
              <ChipGroup label="Margins">
                {(['narrow', 'normal', 'wide'] as const).map((m) => (
                  <Chip key={m} selected={appearance.margins === m} onClick={() => onChange({ margins: m })}>
                    {m === 'narrow' ? 'Narrow' : m === 'normal' ? 'Normal' : 'Wide'}
                  </Chip>
                ))}
              </ChipGroup>
            </div>

            <div className="pn-aa__row">
              <span className="pn-aa__label">Alignment</span>
              <ChipGroup label="Alignment">
                <Chip selected={appearance.align === 'left'} onClick={() => onChange({ align: 'left' })}>
                  Left
                </Chip>
                <Chip selected={appearance.align === 'justify'} onClick={() => onChange({ align: 'justify' })}>
                  Justified
                </Chip>
                <Chip selected={appearance.hyphenate} onClick={() => onChange({ hyphenate: !appearance.hyphenate })}>
                  Hyphenation
                </Chip>
              </ChipGroup>
            </div>

            <div className="pn-aa__row">
              <span className="pn-aa__label">Page turn</span>
              <ChipGroup label="Page turn">
                {(['slide', 'scroll', 'none'] as const).map((t) => (
                  <Chip key={t} selected={appearance.pageTurn === t} onClick={() => onChange({ pageTurn: t })}>
                    {t === 'slide' ? 'Slide' : t === 'scroll' ? 'Scroll' : 'Instant'}
                  </Chip>
                ))}
              </ChipGroup>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
