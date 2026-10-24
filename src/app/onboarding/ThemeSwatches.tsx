import { Check } from 'lucide-react';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';
import { THEME_LABELS, THEMES, type ThemeName } from '../themes';

const SWATCHES: readonly ThemeName[] = ['light', 'sepia', 'dark', 'black'];

/**
 * The four theme swatches from blueprint 5.2 plus "Match my phone". Native
 * radio inputs, so arrow keys move the choice and screen readers read each
 * theme by name. The choice is saved at once and applied by ThemeProvider.
 */
export function ThemeSwatches() {
  const { db } = useServices();
  const preference = useSettings((s) => s.themePreference);
  const setPreference = useSettings((s) => s.setThemePreference);

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 font-medium">Theme</legend>
      <div className="grid grid-cols-2 gap-3">
        {SWATCHES.map((name) => {
          const t = THEMES[name];
          return (
            <label key={name} className="relative block">
              <input
                type="radio"
                name="onboarding-theme"
                value={name}
                checked={preference === name}
                onChange={() => void setPreference(db, name)}
                className="peer sr-only"
              />
              <span
                className="flex min-h-[72px] flex-col justify-between rounded-card border-2 p-3 peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                style={{ backgroundColor: t.page, color: t.text, borderColor: t.line }}
              >
                <span className="font-semibold">{THEME_LABELS[name]}</span>
                <span className="mt-2 block h-2 w-10 rounded-full" style={{ backgroundColor: t.accent }} aria-hidden="true" />
              </span>
              {preference === name ? (
                <Check size={20} aria-hidden="true" className="absolute right-2 top-2" style={{ color: t.accent }} />
              ) : null}
            </label>
          );
        })}
      </div>
      <label className="mt-3 flex min-h-touch cursor-pointer items-center gap-3">
        <input
          type="radio"
          name="onboarding-theme"
          value="system"
          checked={preference === 'system'}
          onChange={() => void setPreference(db, 'system')}
          className="h-5 w-5 accent-[rgb(var(--pn-accent))]"
        />
        <span>{THEME_LABELS.system}</span>
      </label>
    </fieldset>
  );
}
