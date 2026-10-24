import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach } from 'vitest';
import { BACK_DEPTH_KEY } from './back-stack';
import { BackStackProvider } from './BackStackProvider';
import { useBackClose } from './back-context';

const depth = (): number => ((window.history.state as Record<string, unknown> | null)?.[BACK_DEPTH_KEY] as number | undefined) ?? 0;

function Sheet({ name, open, onClose }: { name: string; open: boolean; onClose: () => void }) {
  useBackClose(open, onClose);
  return open ? (
    <div role="dialog" aria-label={name}>
      <button onClick={onClose}>Close {name}</button>
    </div>
  ) : null;
}

function Screen({ nested = false }: { nested?: boolean }) {
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  return (
    <>
      <button onClick={() => setA(true)}>Open A</button>
      <button onClick={() => setB(true)}>Open B</button>
      <Sheet name="A" open={a} onClose={() => setA(false)} />
      {nested ? <Sheet name="B" open={b} onClose={() => setB(false)} /> : null}
    </>
  );
}

function mount(ui: React.ReactElement, strict = false) {
  const tree = <BackStackProvider>{ui}</BackStackProvider>;
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const back = async (): Promise<void> => {
  await act(async () => {
    window.history.back();
    await new Promise((r) => setTimeout(r, 20));
  });
};

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
});

describe('useBackClose', () => {
  it.each([false, true])('opens a sheet, then the back gesture closes it (StrictMode: %s)', async (strict) => {
    mount(<Screen />, strict);
    fireEvent.click(screen.getByText('Open A'));
    expect(screen.getByRole('dialog', { name: 'A' })).toBeInTheDocument();
    await waitFor(() => expect(depth()).toBe(1));

    await back();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(depth()).toBe(0);
    expect(window.location.pathname).toBe('/');
  });

  it.each([false, true])('closing in code removes the history entry (StrictMode: %s)', async (strict) => {
    mount(<Screen />, strict);
    fireEvent.click(screen.getByText('Open A'));
    await waitFor(() => expect(depth()).toBe(1));

    fireEvent.click(screen.getByText('Close A'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(depth()).toBe(0));
  });

  it('can open the same sheet again after closing it in code', async () => {
    mount(<Screen />);
    fireEvent.click(screen.getByText('Open A'));
    await waitFor(() => expect(depth()).toBe(1));
    fireEvent.click(screen.getByText('Close A'));
    await waitFor(() => expect(depth()).toBe(0));

    fireEvent.click(screen.getByText('Open A'));
    await waitFor(() => expect(depth()).toBe(1));
    await back();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes nested sheets one at a time, topmost first', async () => {
    mount(<Screen nested />);
    fireEvent.click(screen.getByText('Open A'));
    await waitFor(() => expect(depth()).toBe(1));
    fireEvent.click(screen.getByText('Open B'));
    await waitFor(() => expect(depth()).toBe(2));

    await back();
    expect(screen.queryByRole('dialog', { name: 'B' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'A' })).toBeInTheDocument();
    expect(depth()).toBe(1);

    await back();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(depth()).toBe(0);
  });

  it('closing the top nested sheet in code keeps the lower one open and back still works', async () => {
    mount(<Screen nested />);
    fireEvent.click(screen.getByText('Open A'));
    await waitFor(() => expect(depth()).toBe(1));
    fireEvent.click(screen.getByText('Open B'));
    await waitFor(() => expect(depth()).toBe(2));

    fireEvent.click(screen.getByText('Close B'));
    await waitFor(() => expect(depth()).toBe(1));
    expect(screen.getByRole('dialog', { name: 'A' })).toBeInTheDocument();

    await back();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('removes its entry when the owner unmounts while the sheet is open', async () => {
    const view = mount(<Screen />);
    fireEvent.click(screen.getByText('Open A'));
    await waitFor(() => expect(depth()).toBe(1));
    view.unmount();
    await waitFor(() => expect(depth()).toBe(0));
  });

  it('always calls the latest onClose', async () => {
    const calls: string[] = [];
    function Changing() {
      const [label, setLabel] = useState('first');
      useBackClose(true, () => calls.push(label));
      return <button onClick={() => setLabel('second')}>Change</button>;
    }
    mount(<Changing />);
    await waitFor(() => expect(depth()).toBe(1));
    fireEvent.click(screen.getByText('Change'));
    await back();
    expect(calls).toEqual(['second']);
  });

  it('throws a clear error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Sheet name="A" open onClose={() => undefined} />)).toThrow(/BackStackProvider/);
    spy.mockRestore();
  });
});
