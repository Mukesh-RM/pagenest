import { BottomSheet, type SheetCloseReason } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { Range } from '../components/Range';
import { THEME_PALETTE } from '../theme/palette';
import { THEME_LABELS, THEME_NAMES, type ThemeName } from '../theme/themes';
import type { LineSpacing, MarginSize, ReaderFontOption, ReaderSettings } from '../types';
import '../styles/screens.css';
import '../styles/surfaces.css';

export const READER_MIN_FONT = 14;
export const READER_MAX_FONT = 32;

export const LINE_HEIGHT: Record<LineSpacing, number> = { compact: 1.4, comfortable: 1.6, airy: 1.85 };
export const MARGIN_PX: Record<MarginSize, number> = { narrow: 16, medium: 24, wide: 40 };

export interface ReaderSettingsSheetProps {
  open: boolean;
  onClose: (reason: SheetCloseReason) => void;
  settings: ReaderSettings;
  fonts: readonly ReaderFontOption[];
  onChange: (next: ReaderSettings) => void;
}

function Swatch({ theme }: { theme: ThemeName }) {
  const p = THEME_PALETTE[theme];
  return (
    <span className="pn-swatch" style={{ background: p.page, color: p.text, borderColor: p['border-strong'] }}>
      Aa
    </span>
  );
}

/**
 * The "Aa" sheet (blueprint 5.7): text size, font, theme, line spacing and margins, with a live sample that uses the
 * chosen settings. Controlled: the reader owns the settings; every change is one call to `onChange`.
 */
export function ReaderSettingsSheet({ open, onClose, settings, fonts, onChange }: ReaderSettingsSheetProps) {
  const set = (patch: Partial<ReaderSettings>) => onChange({ ...settings, ...patch });
  const font = fonts.find((f) => f.id === settings.fontId) ?? fonts[0];
  return (
    <BottomSheet
      open={open}
      title="Reading settings"
      onClose={onClose}
      className="pn-reader-settings"
      footer={
        <Button block variant="secondary" onClick={() => onClose('close-button')}>
          Done
        </Button>
      }
    >
      <div className="pn-aa">
        <p
          className="pn-aa__sample"
          style={{ fontFamily: font?.family, fontSize: settings.fontSize, lineHeight: LINE_HEIGHT[settings.lineSpacing] }}
        >
          The orchard was quiet that morning, and the light came through the leaves in long, slow bars.
        </p>

        <section className="pn-aa__group" aria-labelledby="pn-aa-size">
          <h3 id="pn-aa-size" className="pn-aa__heading">
            Text size
          </h3>
          <div className="pn-aa__size">
            <Button
              iconOnly
              variant="ghost"
              icon="minus"
              aria-label="Smaller text"
              disabled={settings.fontSize <= READER_MIN_FONT}
              onClick={() => set({ fontSize: Math.max(READER_MIN_FONT, settings.fontSize - 1) })}
            />
            <Range
              label="Text size"
              min={READER_MIN_FONT}
              max={READER_MAX_FONT}
              value={settings.fontSize}
              valueText={`${settings.fontSize} pixels`}
              onChange={(fontSize) => set({ fontSize })}
            />
            <Button
              iconOnly
              variant="ghost"
              icon="plus"
              aria-label="Larger text"
              disabled={settings.fontSize >= READER_MAX_FONT}
              onClick={() => set({ fontSize: Math.min(READER_MAX_FONT, settings.fontSize + 1) })}
            />
          </div>
        </section>

        <section className="pn-aa__group" aria-labelledby="pn-aa-font">
          <h3 id="pn-aa-font" className="pn-aa__heading">
            Font
          </h3>
          <ChoiceGroup
            label="Font"
            value={settings.fontId}
            options={fonts.map((f) => ({
              value: f.id,
              label: f.label,
              preview: (
                <span className="pn-aa__font-sample" style={{ fontFamily: f.family }}>
                  Ag
                </span>
              ),
            }))}
            onChange={(fontId) => set({ fontId })}
            variant="tiles"
          />
        </section>

        <section className="pn-aa__group" aria-labelledby="pn-aa-theme">
          <h3 id="pn-aa-theme" className="pn-aa__heading">
            Page color
          </h3>
          <ChoiceGroup
            label="Page color"
            value={settings.theme}
            options={THEME_NAMES.map((t) => ({ value: t, label: THEME_LABELS[t], preview: <Swatch theme={t} /> }))}
            onChange={(theme) => set({ theme })}
            variant="tiles"
          />
        </section>

        <section className="pn-aa__group" aria-labelledby="pn-aa-leading">
          <h3 id="pn-aa-leading" className="pn-aa__heading">
            Line spacing
          </h3>
          <ChoiceGroup
            label="Line spacing"
            value={settings.lineSpacing}
            options={[
              { value: 'compact', label: 'Tight' },
              { value: 'comfortable', label: 'Normal' },
              { value: 'airy', label: 'Roomy' },
            ]}
            onChange={(lineSpacing) => set({ lineSpacing })}
          />
        </section>

        <section className="pn-aa__group" aria-labelledby="pn-aa-margins">
          <h3 id="pn-aa-margins" className="pn-aa__heading">
            Margins
          </h3>
          <ChoiceGroup
            label="Margins"
            value={settings.margins}
            options={[
              { value: 'narrow', label: 'Narrow' },
              { value: 'medium', label: 'Medium' },
              { value: 'wide', label: 'Wide' },
            ]}
            onChange={(margins) => set({ margins })}
          />
        </section>
      </div>
    </BottomSheet>
  );
}

export default ReaderSettingsSheet;
