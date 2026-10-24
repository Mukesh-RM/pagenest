import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Calm empty state (blueprint 5.1 and 5.8): what happened, plus one clear next
 * step when there is one. Uses theme tokens only.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-16 text-center" aria-labelledby="empty-title">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-accent" aria-hidden="true">
        <Icon size={32} strokeWidth={1.5} />
      </span>
      <h2 id="empty-title" className="text-xl font-semibold">
        {title}
      </h2>
      <p className="text-muted">{children}</p>
      {action}
    </section>
  );
}
