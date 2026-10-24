import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CUSTOM_THEME_ID, customThemeStyle, resolveCustomTheme, type CustomThemeInput, type ResolvedCustomTheme } from './custom';
import { getPalette, type ColorToken } from './palette';
import {
  THEME_PAGE_COLOR,
  resolveContrast,
  resolveTheme,
  type ContrastLevel,
  type ContrastMode,
  type ThemeChoice,
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
  /** The setting: a fixed theme, "system", or "custom". */
  mode: ThemeChoice;
  /**
   * The built-in theme in effect. For "custom" this is the built-in with the same scheme (Dark or Light), so code
   * that only knows the four names still behaves sensibly; read `custom` for the person's own colors.
   */
  theme: ThemeName;
  /** The resolved Custom theme when `mode` is "custom", else null. */
  custom: ResolvedCustomTheme | null;
  setMode: (mode: ThemeChoice) => void;
  /** The high-contrast setting: "system", "standard" or "high". */
  contrastMode: ContrastMode;
  /** The concrete contrast level in effect. */
  contrast: ContrastLevel;
  setContrastMode: (mode: ContrastMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** What a portal needs to look like its surroundings: the `data-theme` value and, for Custom, its inline colors. */
interface PortalTheme {
  name: string;
  base: ThemeName;
  style?: CSSProperties;
  palette: Readonly<Record<ColorToken, string>>;
  /** Undefined when no provider or scope chose one (the system setting then applies in CSS). */
  contrast: ContrastLevel | undefined;
}

/** Theme of the nearest provider or scope; portals use it so sheets match their surroundings. */
const PortalThemeContext = createContext<PortalTheme | null>(null);

function portalFor(
  theme: ThemeName | typeof CUSTOM_THEME_ID,
  custom: ResolvedCustomTheme | null,
  contrast: ContrastLevel | undefined,
): PortalTheme {
  if (theme === CUSTOM_THEME_ID && custom) {
    return {
      name: CUSTOM_THEME_ID,
      base: custom.scheme === 'dark' ? 'dark' : 'light',
      style: customThemeStyle(custom),
      palette: custom.palette,
      contrast,
    };
  }
  const base = theme === CUSTOM_THEME_ID ? 'dark' : theme;
  return { name: base, base, palette: getPalette(base, contrast), contrast };
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return ctx;
}

export interface ThemeProviderProps {
  /** Controlled app theme setting. `"custom"` uses `customTheme`. */
  mode?: ThemeChoice;
  /** Initial setting when uncontrolled. Defaults to "system". */
  defaultMode?: ThemeChoice;
  /** Method syntax on purpose: an app handler typed with the narrower `ThemeMode` stays assignable. */
  onModeChange?(mode: ThemeChoice): void;
  /** Controlled high-contrast setting. */
  contrastMode?: ContrastMode;
  /** Initial contrast setting when uncontrolled. Defaults to "system" (follows `prefers-contrast`). */
  defaultContrastMode?: ContrastMode;
  onContrastModeChange?(mode: ContrastMode): void;
  /** The three colors for the Custom theme. Invalid or unreadable colors are corrected (see `resolveCustomTheme`). */
  customTheme?: Partial<CustomThemeInput>;
  children?: ReactNode;
}

/**
 * Applies the app theme to the document root (`data-theme`, `data-theme-mode`) and keeps
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
  customTheme,
  children,
}: ThemeProviderProps) {
  const [internal, setInternal] = useState<ThemeChoice>(defaultMode);
  const mode = controlled ?? internal;
  const systemDark = useSystemPrefersDark();
  const [internalContrast, setInternalContrast] = useState<ContrastMode>(defaultContrastMode);
  const contrastMode = controlledContrast ?? internalContrast;
  const systemMoreContrast = useSystemPrefersMoreContrast();
  const contrast = resolveContrast(contrastMode, systemMoreContrast);
  const isCustom = mode === CUSTOM_THEME_ID;
  const custom = useMemo(
    () => (isCustom ? resolveCustomTheme(customTheme, contrast) : null),
    // The three colors, not the object identity: a new literal each render must not recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCustom, contrast, customTheme?.page, customTheme?.text, customTheme?.accent],
  );
  const theme = isCustom ? (custom?.scheme === 'light' ? 'light' : 'dark') : resolveTheme(mode as ThemeMode, systemDark);

  const setMode = useCallback(
    (next: ThemeChoice) => {
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
    root.setAttribute('data-theme', custom ? CUSTOM_THEME_ID : theme);
    root.setAttribute('data-theme-mode', mode);
    root.setAttribute('data-contrast', contrast);
    root.setAttribute('data-contrast-mode', contrastMode);
    // Custom colors go on the root as inline variables; switching away removes every one of them again.
    const written: string[] = [];
    if (custom) {
      for (const [name, value] of Object.entries(customThemeStyle(custom))) {
        const prop = name === 'colorScheme' ? 'color-scheme' : name;
        root.style.setProperty(prop, String(value));
        written.push(prop);
      }
    }
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', custom ? custom.palette.page : THEME_PAGE_COLOR[theme]);
    return () => {
      for (const prop of written) root.style.removeProperty(prop);
    };
  }, [mode, theme, custom, contrast, contrastMode]);

  const value = useMemo(
    () => ({ mode, theme, custom, setMode, contrastMode, contrast, setContrastMode }),
    [mode, theme, custom, setMode, contrastMode, contrast, setContrastMode],
  );
  const portal = useMemo(() => portalFor(custom ? CUSTOM_THEME_ID : theme, custom, contrast), [theme, custom, contrast]);
  return (
    <ThemeContext.Provider value={value}>
      <PortalThemeContext.Provider value={portal}>{children}</PortalThemeContext.Provider>
    </ThemeContext.Provider>
  );
}

export interface ThemeScopeProps {
  /** A built-in theme, or `"custom"` together with `custom`. */
  theme: ThemeName | typeof CUSTOM_THEME_ID;
  /** The person's three colors, for `theme="custom"`. */
  custom?: Partial<CustomThemeInput>;
  /** Contrast level of this subtree. Omit to inherit from the surrounding provider or scope. */
  contrast?: ContrastLevel;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

/** Render a subtree in a fixed theme, independent of the app theme (for example the reader). */
export function ThemeScope({ theme, custom, contrast, as: Tag = 'div', className, children }: ThemeScopeProps) {
  const outer = useContext(PortalThemeContext);
  const level = contrast ?? outer?.contrast;
  const resolved = useMemo(
    () => (theme === CUSTOM_THEME_ID ? resolveCustomTheme(custom, level) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, level, custom?.page, custom?.text, custom?.accent],
  );
  const portal = useMemo(() => portalFor(theme, resolved, level), [theme, resolved, level]);
  return (
    <Tag
      data-theme={portal.name}
      data-contrast={level}
      style={portal.style}
      className={className ? `pn-theme-scope ${className}` : 'pn-theme-scope'}
    >
      <PortalThemeContext.Provider value={portal}>{children}</PortalThemeContext.Provider>
    </Tag>
  );
}

/** Portal to document.body that keeps the surrounding theme, so sheets and snackbars match. */
export function ThemedPortal({ children }: { children: ReactNode }) {
  const theme = useContext(PortalThemeContext);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="pn-portal" data-theme={theme?.name} data-contrast={theme?.contrast} style={theme?.style}>
      {children}
    </div>,
    document.body,
  );
}

/**
 * Name of the theme in effect for the calling component: the nearest `<ThemeScope>` or `<ThemeProvider>`,
 * else the `data-theme` on the document root, else "light". Components that compute colors in script
 * (cover tint) use it so they match their surroundings.
 */
export function useThemeName(): ThemeName {
  const scoped = useContext(PortalThemeContext);
  if (scoped) return scoped.base;
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'sepia' || attr === 'dark' || attr === 'black') return attr;
  }
  return 'light';
}

/** The color palette (hex) of the theme in effect, including the person's Custom colors. */
export function useThemePalette(): Readonly<Record<ColorToken, string>> {
  const scoped = useContext(PortalThemeContext);
  const name = useThemeName();
  const root =
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-contrast') === 'high' ? 'high' : 'standard';
  return scoped ? scoped.palette : getPalette(name, root);
}
