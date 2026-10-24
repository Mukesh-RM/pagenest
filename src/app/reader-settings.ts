import { getSetting, setSetting, SETTING_KEYS } from '@/data/settings';
import type { PageNestDB } from '@/data/db';
import { isThemeName, READER_MAX_FONT, READER_MIN_FONT, type ReaderFontOption, type ReaderSettings } from '@/ui';

/**
 * The fonts the reader offers. Literata and Inter ship with the app (SIL OFL); the others are
 * the device's own families, so no font is downloaded and nothing needs a license.
 */
export const READER_FONTS: readonly ReaderFontOption[] = [
  { id: 'literata', label: 'Literata', family: 'var(--pn-font-serif)' },
  { id: 'inter', label: 'Inter', family: 'var(--pn-font-sans)' },
  {
    id: 'system-serif',
    label: 'Georgia',
    family: 'Georgia, "Times New Roman", serif',
  },
  { id: 'system-sans', label: 'System', family: 'system-ui, sans-serif' },
];

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 18,
  fontId: 'literata',
  theme: 'light',
  lineSpacing: 'comfortable',
  margins: 'medium',
};

const SPACINGS = ['compact', 'comfortable', 'airy'] as const;
const MARGINS = ['narrow', 'medium', 'wide'] as const;

/** Read a saved value: every field is checked, and anything wrong falls back to its default. */
export function parseReaderSettings(value: unknown, fallback: ReaderSettings = DEFAULT_READER_SETTINGS): ReaderSettings {
  if (typeof value !== 'object' || value === null) return fallback;
  const v = value as Record<string, unknown>;
  return {
    fontSize:
      typeof v.fontSize === 'number' && Number.isFinite(v.fontSize)
        ? Math.min(READER_MAX_FONT, Math.max(READER_MIN_FONT, Math.round(v.fontSize)))
        : fallback.fontSize,
    fontId: typeof v.fontId === 'string' && READER_FONTS.some((f) => f.id === v.fontId) ? v.fontId : fallback.fontId,
    theme: typeof v.theme === 'string' && isThemeName(v.theme) ? v.theme : fallback.theme,
    lineSpacing: SPACINGS.find((s) => s === v.lineSpacing) ?? fallback.lineSpacing,
    margins: MARGINS.find((m) => m === v.margins) ?? fallback.margins,
  };
}

/** The saved reader settings, or `undefined` if none were saved (so the caller can start from the app theme). */
export async function loadReaderSettings(db: PageNestDB, fallback?: ReaderSettings): Promise<ReaderSettings | undefined> {
  const saved = await getSetting<unknown>(db, SETTING_KEYS.readerSettings).catch(() => undefined);
  return saved === undefined ? undefined : parseReaderSettings(saved, fallback);
}

export async function saveReaderSettings(db: PageNestDB, settings: ReaderSettings): Promise<void> {
  try {
    await setSetting(db, SETTING_KEYS.readerSettings, settings);
  } catch {
    // Storage blocked: the choice still holds for this visit.
  }
}
