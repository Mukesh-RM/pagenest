import type { ReactNode } from 'react';

/**
 * Screen title row. The top bar only holds the title and menus (blueprint 5.1).
 * The heading can take focus (`tabIndex=-1`) so focus can land on a new screen.
 */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-4 flex min-h-touch items-center justify-between gap-3">
      <h1 tabIndex={-1} className="text-[length:var(--pn-text-xl)] font-semibold leading-tight outline-none">
        {title}
      </h1>
      {children}
    </header>
  );
}
