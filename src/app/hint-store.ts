import type { HintStore } from '@/ui';

/**
 * One-time hints (the install offers) remembered in `localStorage`, which is synchronous like the
 * design system's `HintStore` needs. Where storage is blocked the hint simply shows again next visit.
 */
export function localHintStore(prefix = 'pn.hint.'): HintStore {
  return {
    hasSeen(id) {
      try {
        return localStorage.getItem(prefix + id) === '1';
      } catch {
        return false;
      }
    },
    markSeen(id) {
      try {
        localStorage.setItem(prefix + id, '1');
      } catch {
        // Storage blocked: nothing to remember.
      }
    },
  };
}
