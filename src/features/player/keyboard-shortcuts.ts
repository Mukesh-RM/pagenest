import type { AudioController } from '@/engines/audio/types';
import { MAX_SPEED, MIN_SPEED } from '@/engines/audio/util';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * Laptop shortcuts (blueprint 5.7 / player): space, arrows, J/K/L, speed keys.
 * Ignores events while focus is in a text field.
 */
export function attachPlayerKeyboard(controller: AudioController): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return;
    const state = controller.getState();
    if (!state.item) return;

    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'k') {
      event.preventDefault();
      void controller.toggle();
      return;
    }
    if (key === 'j') {
      event.preventDefault();
      controller.skip(-state.options.skipBackSec);
      return;
    }
    if (key === 'l') {
      event.preventDefault();
      controller.skip(state.options.skipForwardSec);
      return;
    }
    if (key === 'arrowleft') {
      event.preventDefault();
      controller.skip(event.shiftKey ? -state.options.skipBackSec : -5);
      return;
    }
    if (key === 'arrowright') {
      event.preventDefault();
      controller.skip(event.shiftKey ? state.options.skipForwardSec : 5);
      return;
    }
    if (key === 'arrowup') {
      event.preventDefault();
      controller.setSpeed(Math.min(MAX_SPEED, state.speed + 0.1));
      return;
    }
    if (key === 'arrowdown') {
      event.preventDefault();
      controller.setSpeed(Math.max(MIN_SPEED, state.speed - 0.1));
      return;
    }
    if (key === 'n') {
      event.preventDefault();
      controller.nextChapter();
      return;
    }
    if (key === 'p') {
      event.preventDefault();
      controller.previousChapter();
      return;
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
