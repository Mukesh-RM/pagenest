import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { THEME_PAGE_COLOR, resolveTheme, type ThemeMode, type ThemeName } from './themes';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Subscribe to the system dark-mode preference. */
export function useSystemPrefersDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(DARK_QUERY);
    const update = () => setDark(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return dark;
}

export interface ThemeContextValue {
  /** The setting: a fixed theme or "system". */
  mode: ThemeMode;
  /** The concrete theme in effect. */
  theme: ThemeName;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Theme of the nearest provider or scope; portals use it so sheets match their surroundings. */
const PortalThemeContext = createContext<ThemeName | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return ctx;
}

export interface ThemeProviderProps {
  /** Controlled app theme setting. */
  mode?: ThemeMode;
  /** Initial setting when uncontrolled. Defaults to "system". */
  defaultMode?: ThemeMode;
  onModeChange?: (mode: ThemeMode) => void;
  children?: ReactNode;
}

/**
 * Applies the app theme to the document root (`data-theme`, `data-theme-mode`) and keeps
 * `<meta name="theme-color">` in step when the page already has one. Storing the setting is
 * the app's job (pass `mode` and `onModeChange`).
 */
export function ThemeProvider({ mode: controlled, defaultMode = 'system', onModeChange, children }: ThemeProviderProps) {
  const [internal, setInternal] = useState<ThemeMode>(defaultMode);
  const mode = controlled ?? internal;
  const systemDark = useSystemPrefersDark();
  const theme = resolveTheme(mode, systemDark);

  const setMode = useCallback(
    (next: ThemeMode) => {
      if (controlled === undefined) setInternal(next);
      onModeChange?.(next);
    },
    [controlled, onModeChange],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', mode);
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_PAGE_COLOR[theme]);
  }, [mode, theme]);

  const value = useMemo(() => ({ mode, theme, setMode }), [mode, theme, setMode]);
  return (
    <ThemeContext.Provider value={value}>
      <PortalThemeContext.Provider value={theme}>{children}</PortalThemeContext.Provider>
    </ThemeContext.Provider>
  );
}

export interface ThemeScopeProps {
  theme: ThemeName;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

/** Render a subtree in a fixed theme, independent of the app theme (for example the reader). */
export function ThemeScope({ theme, as: Tag = 'div', className, children }: ThemeScopeProps) {
  return (
    <Tag data-theme={theme} className={className ? `pn-theme-scope ${className}` : 'pn-theme-scope'}>
      <PortalThemeContext.Provider value={theme}>{children}</PortalThemeContext.Provider>
    </Tag>
  );
}

/** Portal to document.body that keeps the surrounding theme, so sheets and snackbars match. */
export function ThemedPortal({ children }: { children: ReactNode }) {
  const theme = useContext(PortalThemeContext);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="pn-portal" data-theme={theme ?? undefined}>
      {children}
    </div>,
    document.body,
  );
}
