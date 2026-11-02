/** UI locales (Phase 7). Only English strings ship today; add catalogs before listing more codes. */
import { enMessages, type UiMessageKey } from './messages/en';

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

/** Resolve a UI string for the active locale (English only until more catalogs exist). */
export function uiMessage(key: UiMessageKey, _locale: UiLocale = 'en'): string {
  return enMessages[key];
}
