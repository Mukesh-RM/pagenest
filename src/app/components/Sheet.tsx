import { X } from 'lucide-react';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useBackClose } from '../back';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet over the page (blueprint 5.5). Closes with its Close button,
 * Escape, a tap on the backdrop, and the system back gesture (through
 * `useBackClose`), always before any screen change.
 *
 * Accessibility: `role="dialog"`, labelled by its title, focus moves into the
 * sheet when it opens, Tab stays inside, and focus returns to what opened it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useBackClose(open, onClose);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => opener?.focus();
  }, [open]);

  if (!open) return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onKeyDown={onKeyDown}>
      <div className="pn-sheet-backdrop absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="pn-sheet relative max-h-[85%] w-full max-w-lg overflow-y-auto rounded-t-sheet bg-surface px-4 pb-[calc(1.5rem+var(--pn-safe-bottom))] pt-4 text-ink shadow-xl outline-none"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-ink hover:bg-line"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
