import '../test/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '../test/user';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installViewport } from '../test/viewport';
import { AppShell } from './AppShell';
import { DEFAULT_NAV_ITEMS, Rail, TabBar, type NavItem } from './navigation';

describe.each([
  ['TabBar', TabBar, 'pn-tabbar'],
  ['Rail', Rail, 'pn-rail'],
] as const)('%s', (_name, Component, className) => {
  it('is a labelled navigation landmark with the four blueprint destinations', () => {
    render(<Component items={DEFAULT_NAV_ITEMS} value="library" onSelect={() => undefined} />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav).toHaveClass(className);
    const names = within(nav)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual(['Library', 'Collections', 'Stats', 'Settings']);
    expect(DEFAULT_NAV_ITEMS.map((i) => i.label)).toEqual(['Library', 'Collections', 'Stats', 'Settings']);
  });

  it('every destination has an accessible name from its visible label; icons are decorative', () => {
    render(<Component items={DEFAULT_NAV_ITEMS} value="library" onSelect={() => undefined} />);
    for (const label of ['Library', 'Collections', 'Stats', 'Settings']) {
      const button = screen.getByRole('button', { name: label });
      expect(button).toHaveClass('pn-nav__item'); // carries the 44 px min size in CSS (tokens.test)
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('marks only the current destination with aria-current="page"', () => {
    const { rerender } = render(<Component items={DEFAULT_NAV_ITEMS} value="stats" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Stats' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-current'))).toHaveLength(1);
    rerender(<Component items={DEFAULT_NAV_ITEMS} value="settings" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Stats' })).not.toHaveAttribute('aria-current');
  });

  it('calls onSelect with the id and works from the keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Component items={DEFAULT_NAV_ITEMS} value="library" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Collections' }));
    expect(onSelect).toHaveBeenLastCalledWith('collections');
    screen.getByRole('button', { name: 'Stats' }).focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('stats');
  });

  it('renders real links when items have an href and lets modified clicks through', () => {
    const items: NavItem[] = [{ id: 'library', label: 'Library', icon: 'library', href: '/library' }];
    const onSelect = vi.fn();
    render(<Component items={items} value="library" onSelect={onSelect} label="Primary" />);
    const link = screen.getByRole('link', { name: 'Library' });
    expect(link).toHaveAttribute('href', '/library');
    expect(link).toHaveAttribute('aria-current', 'page');
    // Record whether the component prevented the default, then stop jsdom from navigating.
    let preventedByComponent = false;
    const record = (event: Event) => {
      preventedByComponent = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', record);
    fireEvent.click(link);
    expect(preventedByComponent).toBe(true); // the router handles a plain click
    expect(onSelect).toHaveBeenCalledWith('library');
    onSelect.mockClear();
    fireEvent.click(link, { ctrlKey: true });
    expect(preventedByComponent).toBe(false); // open in new tab untouched
    expect(onSelect).not.toHaveBeenCalled();
    document.removeEventListener('click', record);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });
});

describe('Rail slots', () => {
  it('renders header and footer content', () => {
    render(
      <Rail
        items={DEFAULT_NAV_ITEMS}
        value="library"
        onSelect={() => undefined}
        header={<span>Mark</span>}
        footer={<button>Add</button>}
      />,
    );
    expect(screen.getByText('Mark')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('AppShell', () => {
  it('contains the rail, a main landmark, the mini-player slot and the tab bar', () => {
    render(
      <AppShell items={DEFAULT_NAV_ITEMS} value="library" onSelect={() => undefined} miniPlayer={<p>player slot</p>}>
        <p>page</p>
      </AppShell>,
    );
    expect(screen.getByRole('main')).toHaveTextContent('page');
    expect(screen.getAllByRole('navigation')).toHaveLength(1); // one navigation per breakpoint, never both
    expect(screen.getByText('player slot').compareDocumentPosition(screen.getByTestId('pn-tabbar'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    ); // mini-player sits above the tab bar
  });

  it('publishes --pn-bottom-chrome on the document root and removes it on unmount', () => {
    const { unmount } = render(<AppShell items={DEFAULT_NAV_ITEMS} value="library" onSelect={() => undefined} />);
    expect(document.documentElement.style.getPropertyValue('--pn-bottom-chrome')).toMatch(/^\d+px$/);
    unmount();
    expect(document.documentElement.style.getPropertyValue('--pn-bottom-chrome')).toBe('');
  });
});

describe('AppShell breakpoint switching', () => {
  let viewport: ReturnType<typeof installViewport> | undefined;
  afterEach(() => viewport?.restore());

  const shell = () => (
    <AppShell items={DEFAULT_NAV_ITEMS} value="library" onSelect={() => undefined}>
      <p>page</p>
    </AppShell>
  );

  it.each([
    [360, 'pn-tabbar'],
    [430, 'pn-tabbar'],
    [767, 'pn-tabbar'],
    [768, 'pn-rail'],
    [1024, 'pn-rail'],
    [1440, 'pn-rail'],
  ])('at %i px exactly one navigation is in the DOM: %s', (width, expected) => {
    viewport = installViewport(width);
    render(shell());
    const navs = screen.getAllByRole('navigation');
    expect(navs).toHaveLength(1);
    expect(navs[0]).toHaveClass(expected);
  });

  it('swaps the rail and tab bar when the viewport crosses 768 px, keeping the page and the mini-player', () => {
    viewport = installViewport(430);
    render(
      <AppShell items={DEFAULT_NAV_ITEMS} value="library" onSelect={() => undefined} miniPlayer={<p>player slot</p>}>
        <p>page</p>
      </AppShell>,
    );
    expect(screen.getByTestId('pn-tabbar')).toBeInTheDocument();
    viewport.setWidth(1280);
    expect(screen.queryByTestId('pn-tabbar')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toHaveClass('pn-rail');
    expect(screen.getByText('page')).toBeInTheDocument();
    expect(screen.getByText('player slot')).toBeInTheDocument();
    viewport.setWidth(400);
    expect(screen.getByTestId('pn-tabbar')).toBeInTheDocument();
  });

  it('measures the bottom chrome with the observed border box and batches writes into one frame', async () => {
    const callbacks: ResizeObserverCallback[] = [];
    const original = window.ResizeObserver;
    window.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        callbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      render(shell());
      const root = document.documentElement;
      const spy = vi.spyOn(root.style, 'setProperty');
      const entry = (h: number) =>
        ({ borderBoxSize: [{ blockSize: h, inlineSize: 10 }], contentRect: { height: 1 } }) as unknown as ResizeObserverEntry;
      callbacks[0]!([entry(70)], {} as ResizeObserver);
      callbacks[0]!([entry(81)], {} as ResizeObserver);
      expect(spy).not.toHaveBeenCalled();
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(root.style.getPropertyValue('--pn-bottom-chrome')).toBe('81px');
    } finally {
      window.ResizeObserver = original;
    }
  });
});

describe('AppShell chrome="immersive"', () => {
  let viewport: ReturnType<typeof installViewport> | undefined;
  afterEach(() => viewport?.restore());

  const items = DEFAULT_NAV_ITEMS;
  const mini = <p>player slot</p>;

  it.each([430, 1280])('renders neither the rail nor the tab bar at %i px, only the content', (width) => {
    viewport = installViewport(width);
    render(
      <AppShell items={items} value="library" onSelect={() => undefined} chrome="immersive" miniPlayer={mini}>
        <p>page</p>
      </AppShell>,
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByTestId('pn-tabbar')).toBeNull();
    expect(screen.queryByTestId('pn-rail')).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('page');
  });

  it('marks the frame with data-chrome and defaults to full', () => {
    const { container, rerender } = render(
      <AppShell items={items} value="library" onSelect={() => undefined}>
        <p>page</p>
      </AppShell>,
    );
    expect(container.querySelector('.pn-shell')).toHaveAttribute('data-chrome', 'full');
    rerender(
      <AppShell items={items} value="library" onSelect={() => undefined} chrome="immersive">
        <p>page</p>
      </AppShell>,
    );
    expect(container.querySelector('.pn-shell')).toHaveAttribute('data-chrome', 'immersive');
  });

  it('hides the mini-player slot by default when immersive, and shows it when asked', () => {
    const { rerender } = render(
      <AppShell items={items} value="library" onSelect={() => undefined} chrome="immersive" miniPlayer={mini}>
        <p>page</p>
      </AppShell>,
    );
    expect(screen.queryByText('player slot')).toBeNull();
    rerender(
      <AppShell items={items} value="library" onSelect={() => undefined} chrome="immersive" miniPlayer={mini} showMiniPlayer>
        <p>page</p>
      </AppShell>,
    );
    expect(screen.getByText('player slot')).toBeInTheDocument();
    rerender(
      <AppShell items={items} value="library" onSelect={() => undefined} chrome="full" miniPlayer={mini} showMiniPlayer={false}>
        <p>page</p>
      </AppShell>,
    );
    expect(screen.queryByText('player slot')).toBeNull();
    expect(screen.getByTestId('pn-tabbar')).toBeInTheDocument();
  });

  it('`hidden` is an alias for immersive, and `chrome` wins when both are given', () => {
    const { container, rerender } = render(
      <AppShell items={items} value="library" onSelect={() => undefined} hidden>
        <p>page</p>
      </AppShell>,
    );
    expect(container.querySelector('.pn-shell')).toHaveAttribute('data-chrome', 'immersive');
    expect(screen.queryByRole('navigation')).toBeNull();
    rerender(
      <AppShell items={items} value="library" onSelect={() => undefined} hidden chrome="full">
        <p>page</p>
      </AppShell>,
    );
    expect(container.querySelector('.pn-shell')).toHaveAttribute('data-chrome', 'full');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('toggling chrome keeps the content mounted (no remount, state and scroll survive) and publishes 0 chrome height', () => {
    viewport = installViewport(430);
    function Page() {
      return <input aria-label="draft" defaultValue="" />;
    }
    const { rerender } = render(
      <AppShell items={items} value="library" onSelect={() => undefined}>
        <Page />
      </AppShell>,
    );
    const input = screen.getByLabelText('draft') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'kept' } });
    rerender(
      <AppShell items={items} value="library" onSelect={() => undefined} chrome="immersive">
        <Page />
      </AppShell>,
    );
    expect(screen.getByLabelText('draft')).toBe(input);
    expect(input.value).toBe('kept');
    expect(document.documentElement.style.getPropertyValue('--pn-bottom-chrome')).toBe('0px');
    rerender(
      <AppShell items={items} value="library" onSelect={() => undefined}>
        <Page />
      </AppShell>,
    );
    expect(screen.getByLabelText('draft')).toBe(input);
    expect(screen.getByTestId('pn-tabbar')).toBeInTheDocument();
  });

  it('keeps the first paint right: the immersive layout is decided in the first render, with no effect or state', () => {
    viewport = installViewport(1280);
    const { container } = render(
      <AppShell items={items} value="library" onSelect={() => undefined} chrome="immersive">
        <p>page</p>
      </AppShell>,
    );
    // Synchronous after the first render: nothing mounts later and nothing is swapped in.
    expect(container.querySelectorAll('nav')).toHaveLength(0);
    expect(container.querySelector('.pn-shell__main')).not.toBeNull();
  });

  it('CSS: immersive zeroes the rail width, applies the safe-area insets, and adds no transition', () => {
    const css = readFileSync(resolve(__dirname, '../styles/components.css'), 'utf8');
    const block = css.slice(css.indexOf('.pn-shell[data-chrome="immersive"] {'));
    const immersiveRules = block.slice(0, block.indexOf('/* ---------- Mini-player'));
    expect(immersiveRules).toContain('--pn-rail-width: 0px');
    for (const side of ['top', 'left', 'right', 'bottom']) expect(immersiveRules).toContain(`safe-area-inset-${side}`);
    expect(immersiveRules).not.toMatch(/transition|animation/);
  });
});
