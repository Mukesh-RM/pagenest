/**
 * Tiny stand-in for @testing-library/user-event (which the project does not depend on).
 * Same call shape for the parts the design-system tests use: setup(), click, keyboard, tab.
 * Built on fireEvent, so every dispatch is wrapped in act().
 */
import { fireEvent } from '@testing-library/react';

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function tabbables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => !el.closest('[aria-hidden="true"]') && !el.closest('[hidden]'),
  );
}

function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
}

async function click(element: Element): Promise<void> {
  const disabled = isDisabled(element);
  fireEvent.pointerDown(element);
  if (!disabled) fireEvent.mouseDown(element);
  if (!disabled && element instanceof HTMLElement && element.matches(`${TABBABLE}, [tabindex]`)) element.focus();
  fireEvent.pointerUp(element);
  if (!disabled) {
    fireEvent.mouseUp(element);
    fireEvent.click(element);
  }
}

async function press(key: string, shift = false): Promise<void> {
  const target = document.activeElement ?? document.body;
  const notPrevented = fireEvent.keyDown(target, { key, shiftKey: shift });
  if (!notPrevented) {
    fireEvent.keyUp(target, { key, shiftKey: shift });
    return;
  }
  if (target instanceof HTMLElement && (target.tagName === 'BUTTON' || target.tagName === 'A') && !isDisabled(target)) {
    if (key === 'Enter') fireEvent.click(target);
    if (key === ' ') {
      fireEvent.keyUp(target, { key, shiftKey: shift });
      fireEvent.click(target);
      return;
    }
  }
  fireEvent.keyUp(target, { key, shiftKey: shift });
}

async function keyboard(keys: string): Promise<void> {
  const pattern = /\{([^}]+)\}|(.)/g;
  for (const match of keys.matchAll(pattern)) {
    await press(match[1] ?? match[2]!);
  }
}

async function tab(options: { shift?: boolean } = {}): Promise<void> {
  const shift = options.shift === true;
  const target = document.activeElement ?? document.body;
  const notPrevented = fireEvent.keyDown(target, { key: 'Tab', shiftKey: shift });
  if (!notPrevented) return;
  const list = tabbables();
  if (list.length === 0) return;
  const index = list.indexOf(target as HTMLElement);
  const next = shift ? (index <= 0 ? list.length - 1 : index - 1) : index + 1 >= list.length ? 0 : index + 1;
  list[next]?.focus();
}

export interface UserSession {
  click: typeof click;
  keyboard: typeof keyboard;
  tab: typeof tab;
}

const userEvent = {
  setup(): UserSession {
    return { click, keyboard, tab };
  },
};

export default userEvent;
