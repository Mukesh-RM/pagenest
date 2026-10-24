import type { ReactNode } from 'react';

/** Screen title row. The top bar only holds the title and menus (blueprint 5.1). */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-4 flex min-h-touch items-center justify-between gap-3">
      <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
      {children}
    </header>
  );
}
