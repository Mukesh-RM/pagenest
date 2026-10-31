import { act, render, renderHook, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode, useRef, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RouteChrome } from './RouteChrome';
import { resetRouteChromeForTests, resolveChrome, useCurrentChrome, useRouteChrome } from './route-chrome';

beforeEach(resetRouteChromeForTests);
afterEach(resetRouteChromeForTests);

function Probe() {
  return <p data-testid="chrome">{useCurrentChrome()}</p>;
}

function Screen({ chrome, children }: { chrome: 'full' | 'immersive'; children?: ReactNode }) {
  useRouteChrome(chrome);
  return <>{children}</>;
}

const current = () => screen.getByTestId('chrome').textContent;

describe('useRouteChrome', () => {
  it('is full when nothing registered', () => {
    render(<Probe />);
    expect(current()).toBe('full');
  });

  it('applies on mount and restores on unmount', () => {
    render(<Probe />);
    const view = render(<Screen chrome="immersive" />);
    expect(current()).toBe('immersive');
    view.unmount();
    expect(current()).toBe('full');
  });

  it('follows a changing value without leaving stale entries', () => {
    render(<Probe />);
    const view = render(<Screen chrome="immersive" />);
    view.rerender(<Screen chrome="full" />);
    expect(current()).toBe('full');
    view.rerender(<Screen chrome="immersive" />);
    expect(current()).toBe('immersive');
    view.unmount();
    expect(current()).toBe('full');
  });

  it('is safe in StrictMode (mount, unmount, mount leaves one entry and cleans up)', () => {
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    const view = render(
      <StrictMode>
        <Screen chrome="immersive" />
      </StrictMode>,
    );
    expect(current()).toBe('immersive');
    view.unmount();
    expect(current()).toBe('full');
  });

  it('nested: the deepest screen wins, and leaving it restores the parent', () => {
    render(<Probe />);
    function Tree({ inner }: { inner: boolean }) {
      return <Screen chrome="immersive">{inner ? <Screen chrome="full" /> : null}</Screen>;
    }
    const view = render(<Tree inner />);
    expect(current()).toBe('full');
    view.rerender(<Tree inner={false} />);
    expect(current()).toBe('immersive');
    view.unmount();
    expect(current()).toBe('full');
  });

  it('nested: leaving the parent first keeps the child in effect', () => {
    render(<Probe />);
    function Tree({ outer }: { outer: boolean }) {
      return (
        <>
          {outer ? <Screen chrome="full" /> : null}
          <Screen chrome="immersive" />
        </>
      );
    }
    const view = render(<Tree outer />);
    view.rerender(<Tree outer={false} />);
    expect(current()).toBe('immersive');
  });

  it('route default applies, a screen overrides it, and removing the override restores the default', () => {
    render(<Probe />);
    function Page({ override }: { override: boolean }) {
      return <RouteChrome chrome="immersive">{override ? <Screen chrome="full" /> : <p>screen</p>}</RouteChrome>;
    }
    const view = render(<Page override={false} />);
    expect(current()).toBe('immersive');
    view.rerender(<Page override />);
    expect(current()).toBe('full');
    view.rerender(<Page override={false} />);
    expect(current()).toBe('immersive');
    view.unmount();
    expect(current()).toBe('full');
  });

  it('works through renderHook too', () => {
    const { result, unmount } = renderHook(() => {
      useRouteChrome('immersive');
      return useCurrentChrome();
    });
    expect(result.current).toBe('immersive');
    unmount();
    expect(renderHook(() => useCurrentChrome()).result.current).toBe('full');
  });

  it('does not re-render subscribers when the answer stays the same', () => {
    let renders = 0;
    function Counter() {
      renders += 1;
      useCurrentChrome();
      return null;
    }
    render(<Counter />);
    const first = render(<Screen chrome="immersive" />);
    const base = renders;
    // A second screen asking for the same thing changes the entries but not the answer.
    const second = render(<Screen chrome="immersive" />);
    second.unmount();
    expect(renders).toBe(base);
    first.unmount();
    expect(renders).toBe(base + 1);
  });

  it('does not re-render the screen that registers when the chrome changes', () => {
    let renders = 0;
    function Registering() {
      renders += 1;
      useRouteChrome('immersive');
      return null;
    }
    function Host() {
      const [n, setN] = useState(0);
      const ref = useRef(0);
      ref.current = n;
      return (
        <>
          <Registering />
          <button onClick={() => setN(1)}>x</button>
        </>
      );
    }
    render(<Host />);
    expect(renders).toBe(1);
    act(() => resetRouteChromeForTests());
    expect(renders).toBe(1);
  });
});

describe('resolveChrome', () => {
  it('prefers screens over route defaults, then the later one', () => {
    expect(resolveChrome({})).toBe('full');
    expect(resolveChrome({ 1: { chrome: 'immersive', source: 'route', order: 1 }, 2: { chrome: 'full', source: 'screen', order: 0 } })).toBe('full');
    expect(resolveChrome({ 1: { chrome: 'immersive', source: 'screen', order: 1 }, 2: { chrome: 'full', source: 'screen', order: 2 } })).toBe('full');
  });
});

describe('the frame follows the chrome prop, not app CSS', () => {
  const css = readFileSync(join(process.cwd(), 'src', 'app', 'theme.css'), 'utf8');
  it('has no rules of its own for the rail, the bottom bar or the chrome attribute', () => {
    expect(css).not.toMatch(/pn-rail|pn-shell__bottom|data-chrome|pn-chrome-scope/);
  });
});
