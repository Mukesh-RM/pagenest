import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { BottomSheet } from './components/BottomSheet';

/** Everything a shortcut can do. The app decides what each action means on the current screen. */
export type ShortcutAction =
  | 'playPause'
  | 'seekBack'
  | 'seekForward'
  | 'next'
  | 'previous'
  | 'search'
  | 'theme'
  | 'close'
  | 'help';

/** Keys are `KeyboardEvent.key` values. Single letters match either case. */
export type ShortcutBindings = Readonly<Record<ShortcutAction, readonly string[]>>;
export type ShortcutHandlers = Partial<Record<ShortcutAction, (event: KeyboardEvent) => void>>;

export const DEFAULT_SHORTCUTS: ShortcutBindings = {
  playPause: [' '],
  seekBack: ['ArrowLeft'],
  seekForward: ['ArrowRight'],
  next: ['j'],
  previous: ['k'],
  search: ['/'],
  theme: ['t'],
  close: ['Escape'],
  help: ['?'],
};

/** Plain-word descriptions shown in the help dialog. Override per screen through `descriptions`. */
export const SHORTCUT_DESCRIPTIONS: Readonly<Record<ShortcutAction, string>> = {
  playPause: 'Play or pause',
  seekBack: 'Back 15 seconds, or the previous page',
  seekForward: 'Forward 15 seconds, or the next page',
  next: 'Next chapter or next book in the list',
  previous: 'Previous chapter or previous book in the list',
  search: 'Search your library',
  theme: 'Switch the theme',
  close: 'Close the open panel',
  help: 'Show this list',
};

const SHORTCUT_ORDER: readonly ShortcutAction[] = [
  'playPause',
  'seekBack',
  'seekForward',
  'next',
  'previous',
  'search',
  'theme',
  'close',
  'help',
];

const KEY_LABELS: Readonly<Record<string, string>> = {
  ' ': 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  Enter: 'Enter',
};

/** Human label for a key: "Space", "←", "J". */
export function formatKey(key: string): string {
  return KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

/** Merge a partial remap over the defaults. An empty array disables an action. */
export function resolveBindings(overrides?: Partial<Record<ShortcutAction, readonly string[]>>): ShortcutBindings {
  return { ...DEFAULT_SHORTCUTS, ...overrides } as ShortcutBindings;
}

function matches(binding: string, event: KeyboardEvent): boolean {
  if (binding.length === 1 && binding !== ' ') return event.key.toLowerCase() === binding.toLowerCase();
  return event.key === binding;
}

/** Elements where typing, Space or arrows already mean something. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
  }
  return false;
}

/** Controls that Space (and arrows inside groups) already activate. */
function isActivatable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('button, a[href], summary, [role="button"], [role="radio"], [role="tab"], [role="menuitem"], input');
}

export interface UseShortcutsOptions {
  bindings?: Partial<Record<ShortcutAction, readonly string[]>>;
  /** Turn every shortcut off, for example while a modal text field is open. */
  enabled?: boolean;
}

/**
 * Keyboard shortcuts for laptop use (blueprint: reader and player). Props-driven: pass handlers for the actions the
 * current screen supports, and optionally remap keys. Ignored while typing in a field, with Ctrl/Alt/Meta held,
 * and for Space or arrows when a control that already uses them has focus.
 */
export function useShortcuts(handlers: ShortcutHandlers, options: UseShortcutsOptions = {}): void {
  const { bindings, enabled = true } = options;
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  const resolved = useMemo(() => resolveBindings(bindings), [bindings]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const typing = isTypingTarget(event.target);
      for (const action of SHORTCUT_ORDER) {
        const handler = handlersRef.current[action];
        if (!handler) continue;
        if (!resolved[action].some((binding) => matches(binding, event))) continue;
        if (action === 'close') {
          // Esc is allowed while typing (it leaves the field), but never steals it from an open sheet.
          handler(event);
          return;
        }
        if (typing) return;
        if ((event.key === ' ' || event.key.startsWith('Arrow')) && isActivatable(event.target)) return;
        event.preventDefault();
        handler(event);
        return;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, resolved]);
}

interface ShortcutsContextValue {
  bindings: ShortcutBindings;
  openHelp: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function useShortcutBindings(): ShortcutBindings {
  return useContext(ShortcutsContext)?.bindings ?? DEFAULT_SHORTCUTS;
}

export interface ShortcutHelpDialogProps {
  open: boolean;
  onClose: () => void;
  bindings?: ShortcutBindings;
  /** Only these actions are listed (default: every action that has a key). */
  actions?: readonly ShortcutAction[];
  descriptions?: Partial<Record<ShortcutAction, string>>;
}

/** The '?' dialog: a labelled list of the keys. Closes on Esc, back, scrim, or the Close button. */
export function ShortcutHelpDialog({
  open,
  onClose,
  bindings = DEFAULT_SHORTCUTS,
  actions = SHORTCUT_ORDER,
  descriptions,
}: ShortcutHelpDialogProps) {
  const rows = actions.filter((action) => bindings[action].length > 0);
  return (
    <BottomSheet open={open} title="Keyboard shortcuts" onClose={() => onClose()} className="pn-shortcuts">
      <dl className="pn-shortcuts__list">
        {rows.map((action) => (
          <div key={action} className="pn-shortcuts__row">
            <dt className="pn-shortcuts__keys">
              {bindings[action].map((key) => (
                <kbd key={key} className="pn-kbd">
                  {formatKey(key)}
                </kbd>
              ))}
            </dt>
            <dd className="pn-shortcuts__desc">{descriptions?.[action] ?? SHORTCUT_DESCRIPTIONS[action]}</dd>
          </div>
        ))}
      </dl>
    </BottomSheet>
  );
}

export interface ShortcutsProviderProps extends UseShortcutsOptions {
  /** Handlers for the whole app; screens can add their own with `useShortcuts`. */
  handlers?: ShortcutHandlers;
  descriptions?: Partial<Record<ShortcutAction, string>>;
  /** Which actions the help dialog lists. */
  actions?: readonly ShortcutAction[];
  children?: ReactNode;
}

/**
 * Registers the app-wide shortcuts and owns the '?' help dialog. Focus returns to where it was when the dialog
 * closes (BottomSheet restores it).
 */
export function ShortcutsProvider({ handlers, bindings, enabled = true, descriptions, actions, children }: ShortcutsProviderProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const resolved = useMemo(() => resolveBindings(bindings), [bindings]);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  useShortcuts({ ...handlers, help: () => setHelpOpen((open) => !open) }, { bindings, enabled });
  const value = useMemo(() => ({ bindings: resolved, openHelp }), [resolved, openHelp]);
  return (
    <ShortcutsContext.Provider value={value}>
      {children}
      <ShortcutHelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        bindings={resolved}
        actions={actions}
        descriptions={descriptions}
      />
    </ShortcutsContext.Provider>
  );
}

export function useShortcutHelp(): () => void {
  return useContext(ShortcutsContext)?.openHelp ?? (() => undefined);
}
