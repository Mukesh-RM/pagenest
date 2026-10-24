import type { ComponentType } from 'react';

/**
 * How much of the app frame a route shows.
 * - `full`: the tab bar (phones) or rail (tablets and desktop), and the mini-player when there is one.
 * - `immersive`: none of it; the screen has the whole window (reading, listening, full-screen player).
 */
export type RouteChrome = 'full' | 'immersive';

/**
 * The persistent mini-player, supplied by the Audio owner and registered in
 * `AppServices.miniPlayerSlot`. The app frame shows it above the tab bar on `full` routes
 * (the four tabs) and never on `immersive` routes. See `docs/ROUTE_CHROME.md`.
 *
 * It is a visual component only. The audio element and playback state live in the audio
 * controller, not in this component, because the frame unmounts it on immersive routes.
 */
export interface MiniPlayerSlot {
  /** Renders the mini-player. Omit to use the app's lazy default (audio integration). */
  readonly Component?: ComponentType;
  /**
   * A hook that returns true while there is something to show (a book is loaded or playing).
   * When it returns false the frame reserves no space at all. Read your store with a selector
   * (`useAudio((s) => s.current !== undefined)`) so only the frame re-renders when it changes.
   * Omit it to show the component whenever the slot is registered.
   */
  readonly useActive?: () => boolean;
}
