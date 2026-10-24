import '../test/setup';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_MODES, THEME_NAMES, isThemeMode, isThemeName, resolveTheme } from './themes';
import { ThemeProvider, ThemeScope, ThemedPortal, useTheme } from './ThemeProvider';

type Listener = (e: { matches: boolean }) => void;

function mockMatchMedia(initial: { dark?: boolean; reduce?: boolean }) {
  const state = { dark: initial.dark ?? false, reduce: initial.reduce ?? false };
  const listeners = new Set<Listener>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes('prefers-color-scheme: dark') ? state.dark : query.includes('prefers-reduced-motion') ? state.reduce : false;
    },
    media: query,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia;
  return {
    setDark(v: boolean) {
      state.dark = v;
      listeners.forEach((l) => l({ matches: v }));
    },
  };
}

describe('resolveTheme', () => {
  it('follows the system for "system" and keeps fixed themes', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    for (const t of THEME_NAMES) {
      expect(resolveTheme(t, true)).toBe(t);
      expect(resolveTheme(t, false)).toBe(t);
    }
  });

  it('validates theme names and modes', () => {
    expect(THEME_MODES).toEqual(['system', 'light', 'sepia', 'dark', 'black']);
    expect(isThemeName('sepia')).toBe(true);
    expect(isThemeName('system')).toBe(false);
    expect(isThemeMode('system')).toBe(true);
    expect(isThemeMode('neon')).toBe(false);
  });
});

describe('ThemeProvider', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff">';
  });
  afterEach(() => {
    window.matchMedia = original;
    document.head.innerHTML = '';
  });

  function Probe() {
    const { mode, theme, setMode } = useTheme();
    return (
      <div>
        <p data-testid="state">{`${mode}/${theme}`}</p>
        <button onClick={() => setMode('sepia')}>sepia</button>
        <button onClick={() => setMode('system')}>system</button>
      </div>
    );
  }

  it('follows the system preference by default and reacts to changes', () => {
    const media = mockMatchMedia({ dark: false });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(document.documentElement).toHaveAttribute('data-theme-mode', 'system');
    act(() => media.setDark(true));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByTestId('state')).toHaveTextContent('system/dark');
  });

  it('a fixed theme ignores the system, and the page color meta follows', async () => {
    mockMatchMedia({ dark: true });
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await user.click(screen.getByText('sepia'));
    expect(document.documentElement).toHaveAttribute('data-theme', 'sepia');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#f4ecd8');
    await user.click(screen.getByText('system'));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('supports a controlled mode and reports changes', async () => {
    mockMatchMedia({});
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ThemeProvider mode="black" onModeChange={onModeChange}>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'black');
    await user.click(screen.getByText('sepia'));
    expect(onModeChange).toHaveBeenCalledWith('sepia');
    expect(document.documentElement).toHaveAttribute('data-theme', 'black'); // controlled: parent decides
  });

  it('useTheme outside a provider explains what is missing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });
});

describe('ThemeScope and portals', () => {
  it('scopes a theme to a subtree (reader theme separate from the app theme)', () => {
    render(
      <ThemeProvider mode="dark">
        <ThemeScope theme="sepia">
          <p>reader</p>
        </ThemeScope>
      </ThemeProvider>,
    );
    expect(screen.getByText('reader').parentElement).toHaveAttribute('data-theme', 'sepia');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('portals keep the theme of where they were rendered', () => {
    render(
      <ThemeScope theme="black">
        <ThemedPortal>
          <p>sheet content</p>
        </ThemedPortal>
      </ThemeScope>,
    );
    expect(screen.getByText('sheet content').parentElement).toHaveAttribute('data-theme', 'black');
  });
});
