import { describe, expect, it } from 'vitest';
import { SUPPORTED_UI_LOCALES, defaultUiLocale, uiLocaleLabel, uiMessage } from './locales';

describe('UI locales (Phase 7 structure)', () => {
  it('ships English only until catalogs exist', () => {
    expect(SUPPORTED_UI_LOCALES).toEqual(['en']);
    expect(uiLocaleLabel('en')).toBe('English');
    expect(defaultUiLocale()).toBe('en');
    expect(uiMessage('libraryTitle')).toBe('Library');
  });
});
