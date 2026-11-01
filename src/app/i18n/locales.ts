/** UI locales (Phase 7). Only English strings ship today; add catalogs before listing more codes. */
export const SUPPORTED_UI_LOCALES = ['en'] as const;
export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

export function uiLocaleLabel(code: UiLocale): string {
  if (code === 'en') return 'English';
  return code;
}

export function defaultUiLocale(): UiLocale {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language?.slice(0, 2);
    if (lang === 'en') return 'en';
  }
  return 'en';
}
