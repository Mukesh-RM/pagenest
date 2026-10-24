/** Install detection helpers (blueprint 5.6): Android uses the install event, iPhone needs a 3-step hint. */

export interface BeforeInstallPromptEventLike extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isStandalone(win: Window = window): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || win.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** True for Safari on iPhone and iPad (including iPadOS, which reports a Mac user agent), not for other iOS browsers. */
export function isIosSafari(userAgent: string, maxTouchPoints = 0): boolean {
  const ipadOs = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(userAgent) || ipadOs;
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
  return ios && !otherBrowser && /Safari/.test(userAgent);
}
