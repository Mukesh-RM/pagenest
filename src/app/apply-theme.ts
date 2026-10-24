import { THEMES, themeCssVariables, type ThemeName } from './themes';

/** Write a theme onto the document root: CSS variables, `data-theme` and the browser chrome color. */
export function applyTheme(theme: ThemeName, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(themeCssVariables(theme))) root.style.setProperty(name, value);
  root.dataset['theme'] = theme;
  root.style.colorScheme = THEMES[theme].scheme;
}
