import '../test/setup';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPalette, THEME_PALETTE, HIGH_CONTRAST_PALETTE } from './palette';
import {
  CONTRAST_LEVELS,
  CONTRAST_MODES,
  THEME_NAMES,
  isContrastLevel,
  isContrastMode,
  resolveContrast,
} from './themes';
import { ThemeProvider, ThemeScope, ThemedPortal, useTheme } from './ThemeProvider';

type Listener = (e: { matches: boolean }) => void;

function mockMatchMedia(initial: { dark?: boolean; more?: boolean }) {
  const state = { dark: initial.dark ?? false, more: initial.more ?? false };
  const listeners = new Set<Listener>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query.includes('prefers-color-scheme: dark')) return state.dark;
      if (query.includes('prefers-contrast: more')) return state.more;
      return false;
    },
    media: query,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia;
  return {
    setMore(v: boolean) {
      state.more = v;
      listeners.forEach((l) => l({ matches: v }));
    },
  };
}

describe('contrast helpers', () => {
  it('resolves the setting to a level', () => {
    expect(resolveContrast('system', false)).toBe('standard');
    expect(resolveContrast('system', true)).toBe('high');
    expect(resolveContrast('high', false)).toBe('high');
    expect(resolveContrast('standard', true)).toBe('standard');
  });

  it('validates levels and modes', () => {
    expect(CONTRAST_LEVELS).toEqual(['standard', 'high']);
    expect(CONTRAST_MODES).toEqual(['system', 'standard', 'high']);
    expect(isContrastLevel('high')).toBe(true);
    expect(isContrastLevel('system')).toBe(false);
    expect(isContrastMode('system')).toBe(true);
    expect(isContrastMode('max')).toBe(false);
  });

  it('getPalette returns the base palette for standard and the merged one for high', () => {
    for (const theme of THEME_NAMES) {
      expect(getPalette(theme)).toBe(THEME_PALETTE[theme]);
      expect(getPalette(theme, 'standard')).toBe(THEME_PALETTE[theme]);
      const high = getPalette(theme, 'high');
      expect(high.text).toBe(HIGH_CONTRAST_PALETTE[theme].text);
      expect(high.page).toBe(THEME_PALETTE[theme].page);
      expect(Object.keys(high).sort()).toEqual(Object.keys(THEME_PALETTE[theme]).sort());
    }
  });
});

describe('ThemeProvider contrast', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    document.head.innerHTML = '';
  });
  afterEach(() => {
    window.matchMedia = original;
    for (const a of ['data-theme', 'data-theme-mode', 'data-contrast', 'data-contrast-mode']) {
      document.documentElement.removeAttribute(a);
    }
  });

  function Probe() {
    const { contrast, contrastMode, setContrastMode } = useTheme();
    return (
      <div>
        <p data-testid="state">{`${contrastMode}/${contrast}`}</p>
        <button onClick={() => setContrastMode('high')}>high</button>
        <button onClick={() => setContrastMode('standard')}>standard</button>
        <button onClick={() => setContrastMode('system')}>system</button>
      </div>
    );
  }

  it('defaults to following the system and writes data-contrast on the root', () => {
    mockMatchMedia({ more: false });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveAttribute('data-contrast', 'standard');
    expect(document.documentElement).toHaveAttribute('data-contrast-mode', 'system');
    expect(screen.getByTestId('state')).toHaveTextContent('system/standard');
  });

  it('turns high contrast on when the system asks for more contrast, and reacts to changes', () => {
    const media = mockMatchMedia({ more: true });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high');
    act(() => media.setMore(false));
    expect(document.documentElement).toHaveAttribute('data-contrast', 'standard');
    act(() => media.setMore(true));
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high');
  });

  it('a forced setting wins over the system preference, in both directions', async () => {
    mockMatchMedia({ more: true });
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'standard' }));
    expect(document.documentElement).toHaveAttribute('data-contrast', 'standard');
    expect(document.documentElement).toHaveAttribute('data-contrast-mode', 'standard');
    await user.click(screen.getByRole('button', { name: 'high' }));
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high');
    await user.click(screen.getByRole('button', { name: 'system' }));
    expect(screen.getByTestId('state')).toHaveTextContent('system/high');
  });

  it('composes with every theme: data-theme and data-contrast are independent', async () => {
    mockMatchMedia({});
    for (const theme of THEME_NAMES) {
      const { unmount } = render(
        <ThemeProvider mode={theme} contrastMode="high">
          <Probe />
        </ThemeProvider>,
      );
      expect(document.documentElement).toHaveAttribute('data-theme', theme);
      expect(document.documentElement).toHaveAttribute('data-contrast', 'high');
      unmount();
    }
  });

  it('supports a controlled contrast mode and reports changes', async () => {
    mockMatchMedia({});
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ThemeProvider contrastMode="standard" onContrastModeChange={onChange}>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'high' }));
    expect(onChange).toHaveBeenCalledWith('high');
    expect(document.documentElement).toHaveAttribute('data-contrast', 'standard');
  });
});

describe('ThemeScope and ThemedPortal contrast', () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it('inherits the contrast of the provider, so scopes and portals match', () => {
    mockMatchMedia({});
    render(
      <ThemeProvider mode="light" contrastMode="high">
        <ThemeScope theme="sepia" className="reader">
          <ThemedPortal>
            <p>portal content</p>
          </ThemedPortal>
        </ThemeScope>
      </ThemeProvider>,
    );
    const scope = document.querySelector('.reader')!;
    expect(scope).toHaveAttribute('data-theme', 'sepia');
    expect(scope).toHaveAttribute('data-contrast', 'high');
    const portal = screen.getByText('portal content').closest('.pn-portal')!;
    expect(portal).toHaveAttribute('data-theme', 'sepia');
    expect(portal).toHaveAttribute('data-contrast', 'high');
  });

  it('a scope can set its own contrast', () => {
    mockMatchMedia({});
    render(
      <ThemeProvider mode="dark" contrastMode="high">
        <ThemeScope theme="light" contrast="standard" className="reader">
          x
        </ThemeScope>
      </ThemeProvider>,
    );
    expect(document.querySelector('.reader')).toHaveAttribute('data-contrast', 'standard');
  });

  it('without a provider or setting, no data-contrast is written (the CSS follows the system)', () => {
    mockMatchMedia({});
    render(
      <ThemeScope theme="black" className="reader">
        <ThemedPortal>
          <p>p</p>
        </ThemedPortal>
      </ThemeScope>,
    );
    expect(document.querySelector('.reader')).not.toHaveAttribute('data-contrast');
    expect(screen.getByText('p').closest('.pn-portal')).not.toHaveAttribute('data-contrast');
  });
});
