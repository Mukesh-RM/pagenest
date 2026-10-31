import { act } from '@testing-library/react';

type Listener = () => void;

/**
 * Fake `window.matchMedia` that evaluates min-width and max-width queries against a width you control.
 * Returns `setWidth` (fires the change events inside act) and `restore`.
 */
export function installViewport(initialWidth: number): { setWidth: (width: number) => void; restore: () => void } {
  let width = initialWidth;
  const lists = new Set<{ query: string; listeners: Set<Listener> }>();
  const original = window.matchMedia;

  const evaluate = (query: string): boolean => {
    const checks = [...query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
    if (checks.length === 0) return false;
    return checks.every(([, kind, px]) => (kind === 'min' ? width >= Number(px) : width <= Number(px)));
  };

  window.matchMedia = ((query: string) => {
    const entry = { query, listeners: new Set<Listener>() };
    lists.add(entry);
    return {
      get matches() {
        return evaluate(query);
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, l: Listener) => entry.listeners.add(l),
      removeEventListener: (_: string, l: Listener) => entry.listeners.delete(l),
      addListener: (l: Listener) => entry.listeners.add(l),
      removeListener: (l: Listener) => entry.listeners.delete(l),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  return {
    setWidth(next) {
      width = next;
      act(() => {
        for (const entry of lists) for (const l of entry.listeners) l();
      });
    },
    restore() {
      window.matchMedia = original;
      lists.clear();
    },
  };
}
