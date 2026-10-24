import type { ReactNode } from 'react';

/**
 * The page frame the design system defines (`pn-screen`: margins, max width, vertical rhythm).
 * Every tab and book screen sits in one, so spacing is the same everywhere and the frame of a
 * lazy screen's fallback matches the real screen.
 */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `pn-screen ${className}` : 'pn-screen'}>{children}</div>;
}

/**
 * Screen title row. The top bar only holds the title and menus (blueprint 5.1). The title is the
 * design system's page title (`pn-screen__title`: Literata, heading weight, `--pn-text-xl`).
 * The heading can take focus (`tabIndex=-1`) so focus can land on a new screen.
 */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="pn-screen__header">
      <h1 tabIndex={-1} className="pn-screen__title outline-none">
        {title}
      </h1>
      {children}
    </header>
  );
}

/** Section heading inside a screen (Settings groups): the design system's serif at the large text size. */
export function SectionHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="font-serif text-[length:var(--pn-text-lg)] font-bold leading-tight">
      {children}
    </h2>
  );
}
