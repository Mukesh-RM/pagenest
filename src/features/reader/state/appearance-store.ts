import { create } from 'zustand';
import type { PageNestDB } from '@/data/db';
import { getSetting, setSetting } from '@/data/settings';
import type { ReaderAppearance } from '@/engines/reader/types';
import { DEFAULT_APPEARANCE, normalizeAppearance } from '../core/appearance';

/** Settings key in the `settings` store. */
export const READER_APPEARANCE_KEY = 'reader.appearance';

interface AppearanceState {
  readonly loaded: boolean;
  readonly appearance: ReaderAppearance;
  /** Read the saved look. Missing or damaged values fall back to the defaults. */
  load(db: PageNestDB): Promise<ReaderAppearance>;
  /** Change the look now and save it. The change shows at once even if saving fails. */
  update(db: PageNestDB, patch: Partial<ReaderAppearance>): Promise<ReaderAppearance>;
}

/** The reader look (theme, font, size, spacing) shared by every book. */
export const useAppearance = create<AppearanceState>((set, get) => ({
  loaded: false,
  appearance: DEFAULT_APPEARANCE,
  async load(db) {
    let saved: unknown;
    try {
      saved = await getSetting<unknown>(db, READER_APPEARANCE_KEY);
    } catch {
      /* storage unavailable: keep defaults */
    }
    const appearance = normalizeAppearance(saved);
    set({ loaded: true, appearance });
    return appearance;
  },
  async update(db, patch) {
    const appearance = normalizeAppearance(patch, get().appearance);
    set({ appearance });
    try {
      await setSetting(db, READER_APPEARANCE_KEY, appearance);
    } catch {
      /* the look still applies for this visit */
    }
    return appearance;
  },
}));
