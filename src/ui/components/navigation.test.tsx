import '../test/setup';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
    expect(screen.getAllByRole('navigation')).toHaveLength(2); // CSS hides one of them per breakpoint
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
