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
import {
  THEME_PAGE_COLOR,
  resolveContrast,
  resolveTheme,
  type ContrastLevel,
  type ContrastMode,
  type ThemeMode,
  type ThemeName,
} from './themes';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const MORE_CONTRAST_QUERY = '(prefers-contrast: more)';

function matchesQuery(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** Subscribe to a media query, safely when `matchMedia` is missing. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchesQuery(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Subscribe to the system dark-mode preference. */
export function useSystemPrefersDark(): boolean {
  return useMediaQuery(DARK_QUERY);
}

/** Subscribe to the system "more contrast" preference (`prefers-contrast: more`). */
export function useSystemPrefersMoreContrast(): boolean {
  return useMediaQuery(MORE_CONTRAST_QUERY);
}

export interface ThemeContextValue {
  /** The setting: a fixed theme or "system". */
  mode: ThemeMode;
  /** The concrete theme in effect. */
  theme: ThemeName;
  setMode: (mode: ThemeMode) => void;
  /** The high-contrast setting: "system", "standard" or "high". */
  contrastMode: ContrastMode;
  /** The concrete contrast level in effect. */
  contrast: ContrastLevel;
  setContrastMode: (mode: ContrastMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface Surroundings {
  theme: ThemeName;
  /** Undefined when no provider or scope chose one (the system setting then applies in CSS). */
  contrast: ContrastLevel | undefined;
}

/** Theme and contrast of the nearest provider or scope; portals use it so sheets match their surroundings. */
const PortalThemeContext = createContext<Surroundings | null>(null);

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
  /** Controlled high-contrast setting. */
  contrastMode?: ContrastMode;
  /** Initial contrast setting when uncontrolled. Defaults to "system" (follows `prefers-contrast`). */
  defaultContrastMode?: ContrastMode;
  onContrastModeChange?: (mode: ContrastMode) => void;
  children?: ReactNode;
}

/**
 * Applies the app theme to the document root (`data-theme`, `data-theme-mode`, `data-contrast`, `data-contrast-mode`) and keeps
 * `<meta name="theme-color">` in step when the page already has one. Storing the setting is
 * the app's job (pass `mode` and `onModeChange`).
 */
export function ThemeProvider({
  mode: controlled,
  defaultMode = 'system',
  onModeChange,
  contrastMode: controlledContrast,
  defaultContrastMode = 'system',
  onContrastModeChange,
  children,
}: ThemeProviderProps) {
  const [internal, setInternal] = useState<ThemeMode>(defaultMode);
  const mode = controlled ?? internal;
  const systemDark = useSystemPrefersDark();
  const theme = resolveTheme(mode, systemDark);

  const [internalContrast, setInternalContrast] = useState<ContrastMode>(defaultContrastMode);
  const contrastMode = controlledContrast ?? internalContrast;
  const systemMoreContrast = useSystemPrefersMoreContrast();
  const contrast = resolveContrast(contrastMode, systemMoreContrast);

  const setMode = useCallback(
    (next: ThemeMode) => {
      if (controlled === undefined) setInternal(next);
      onModeChange?.(next);
    },
    [controlled, onModeChange],
  );

  const setContrastMode = useCallback(
    (next: ContrastMode) => {
      if (controlledContrast === undefined) setInternalContrast(next);
      onContrastModeChange?.(next);
    },
    [controlledContrast, onContrastModeChange],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', mode);
    root.setAttribute('data-contrast', contrast);
    root.setAttribute('data-contrast-mode', contrastMode);
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_PAGE_COLOR[theme]);
  }, [mode, theme, contrast, contrastMode]);

  const value = useMemo(
    () => ({ mode, theme, setMode, contrastMode, contrast, setContrastMode }),
    [mode, theme, setMode, contrastMode, contrast, setContrastMode],
  );
  const surroundings = useMemo(() => ({ theme, contrast }), [theme, contrast]);
  return (
    <ThemeContext.Provider value={value}>
      <PortalThemeContext.Provider value={surroundings}>{children}</PortalThemeContext.Provider>
    </ThemeContext.Provider>
  );
}

export interface ThemeScopeProps {
  theme: ThemeName;
  /** Contrast level of this subtree. Omit to inherit from the surrounding provider or scope. */
  contrast?: ContrastLevel;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

/** Render a subtree in a fixed theme, independent of the app theme (for example the reader). */
export function ThemeScope({ theme, contrast, as: Tag = 'div', className, children }: ThemeScopeProps) {
  const outer = useContext(PortalThemeContext);
  const level = contrast ?? outer?.contrast;
  const surroundings = useMemo(() => ({ theme, contrast: level }), [theme, level]);
  return (
    <Tag
      data-theme={theme}
      data-contrast={level}
      className={className ? `pn-theme-scope ${className}` : 'pn-theme-scope'}
    >
      <PortalThemeContext.Provider value={surroundings}>{children}</PortalThemeContext.Provider>
    </Tag>
  );
}

/** Portal to document.body that keeps the surrounding theme, so sheets and snackbars match. */
export function ThemedPortal({ children }: { children: ReactNode }) {
  const surroundings = useContext(PortalThemeContext);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="pn-portal" data-theme={surroundings?.theme} data-contrast={surroundings?.contrast}>
      {children}
    </div>,
    document.body,
  );
}
