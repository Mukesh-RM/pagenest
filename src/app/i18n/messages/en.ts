/** English UI strings (Phase 7). Add sibling catalogs before listing more locales in `locales.ts`. */
export const enMessages = {
  libraryTitle: 'Library',
  languageHeading: 'Language',
  languageNote: 'English UI today. More languages will appear here as translations ship.',
} as const;

export type UiMessageKey = keyof typeof enMessages;
