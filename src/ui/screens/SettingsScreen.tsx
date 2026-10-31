import type { ReactNode } from 'react';
import { Button } from '../components/Button';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { TextSizeControl } from '../components/TextSizeControl';
import { ThemePicker } from '../components/ThemePicker';
import type { CustomThemeInput } from '../theme/custom';
import { CONTRAST_LABELS, CONTRAST_MODES, type ContrastMode, type ThemeChoice } from '../theme/themes';
import '../styles/screens.css';
import '../styles/surfaces.css';

export interface SettingsStorage {
  /** "InkQuiet uses 12 MB of about 40 GB available." Plain words, already formatted. */
  usageText: string;
  /** The browser promised to keep the data (true), may clear it (false), or does not say (undefined). */
  persisted?: boolean;
  /** Ask the browser to keep the data. Shown only when `persisted` is false. */
  onKeepData?: () => void;
}

export interface SettingsScreenProps {
  theme: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
  /** The three Custom colors (any shape; invalid ones are corrected for display). */
  customTheme?: Partial<CustomThemeInput>;
  onCustomThemeChange: (next: CustomThemeInput) => void;
  /** High contrast: "System" follows the device, or force Standard or High contrast. Leave both out to hide the row. */
  contrastMode?: ContrastMode;
  onContrastModeChange?: (mode: ContrastMode) => void;
  /** Text size in px, 14 to 32 on a 16 px base (87% to 200%). */
  textSize: number;
  onTextSizeChange: (px: number) => void;
  /** The Install help control: `<InstallHelp />` from `@/ui/pwa/InstallHelp`, or any node. Leave out to hide the group. */
  install?: ReactNode;
  /** Storage figures. `undefined` shows "Checking…". Pass `null` to hide the group. */
  storage?: SettingsStorage | null;
  /** More groups, rendered as cards between Storage and About. */
  children?: ReactNode;
}

/**
 * Settings (blueprint 5.6) in grouped cards: Appearance (theme cards with a clear selected state, Custom colors and contrast),
 * Reading (text size to 200% with a live sample), Install help, Storage and About. Presentational: the app saves what changes.
 * Every group is a labelled section, so a screen reader can jump between them.
 */
export function SettingsScreen({
  theme,
  onThemeChange,
  customTheme,
  onCustomThemeChange,
  contrastMode,
  onContrastModeChange,
  textSize,
  onTextSizeChange,
  install,
  storage,
  children,
}: SettingsScreenProps) {
  return (
    <div className="pn-screen pn-settings">
      <header className="pn-screen__header">
        <h1 className="pn-screen__title" tabIndex={-1}>
          Settings
        </h1>
      </header>

      <section aria-labelledby="pn-set-appearance" className="pn-set-card">
        <h2 id="pn-set-appearance" className="pn-set-card__title">
          Appearance
        </h2>
        <ThemePicker value={theme} onChange={onThemeChange} custom={customTheme} onCustomChange={onCustomThemeChange} />
        {contrastMode && onContrastModeChange ? (
          <ChoiceGroup
            label="Contrast"
            value={contrastMode}
            options={CONTRAST_MODES.map((m) => ({ value: m, label: CONTRAST_LABELS[m] }))}
            onChange={onContrastModeChange}
          />
        ) : null}
      </section>

      <section aria-labelledby="pn-set-reading" className="pn-set-card">
        <h2 id="pn-set-reading" className="pn-set-card__title">
          Reading
        </h2>
        <TextSizeControl value={textSize} onChange={onTextSizeChange} />
        <p className="pn-set-card__sample" data-testid="text-sample">
          The orchard was quiet that morning, and the light came through the leaves in long, slow bars.
        </p>
      </section>

      {install ? (
        <section aria-labelledby="pn-set-install" className="pn-set-card">
          <h2 id="pn-set-install" className="pn-set-card__title">
            Install help
          </h2>
          <p className="pn-set-card__text">Add InkQuiet to your home screen and it opens like any other app.</p>
          {install}
        </section>
      ) : null}

      {storage === null ? null : (
        <section aria-labelledby="pn-set-storage" className="pn-set-card">
          <h2 id="pn-set-storage" className="pn-set-card__title">
            Storage used
          </h2>
          {storage === undefined ? (
            <p className="pn-set-card__text">Checking…</p>
          ) : (
            <>
              <p className="pn-set-card__strong">{storage.usageText}</p>
              {storage.persisted === true ? (
                <p className="pn-set-card__text">Your browser will keep your books and progress.</p>
              ) : storage.persisted === false ? (
                <>
                  <p className="pn-set-card__text">Your browser may clear your books if space runs low. Asking it to keep them helps.</p>
                  {storage.onKeepData ? (
                    <Button variant="secondary" onClick={storage.onKeepData}>
                      Keep my data
                    </Button>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </section>
      )}

      {children}

      <section aria-labelledby="pn-set-about" className="pn-set-card">
        <h2 id="pn-set-about" className="pn-set-card__title">
          About
        </h2>
        <p className="pn-set-card__text">InkQuiet collects nothing. Your books, notes and settings stay on this device. There is no account, no ads and no tracking.</p>
      </section>
    </div>
  );
}

export default SettingsScreen;
