import interUrl from './inter-latin-wght-normal.woff2?url';
import literataUrl from './literata-latin-wght-normal.woff2?url';

/**
 * Preload Inter (every control). Call once at startup before first paint.
 */
export function preloadCriticalFonts(doc: Document = document): readonly string[] {
  return preloadFontUrls(doc, [interUrl]);
}

/** Literata headings: not on the critical path for Library first paint; load when idle. */
export function preloadHeadingFonts(doc: Document = document): readonly string[] {
  return preloadFontUrls(doc, [literataUrl]);
}

function preloadFontUrls(doc: Document, hrefs: readonly string[]): readonly string[] {
  for (const href of hrefs) {
    if (doc.head.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const link = doc.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = href;
    doc.head.appendChild(link);
  }
  return hrefs;
}

export const CRITICAL_FONT_URLS: readonly string[] = [interUrl];
export const HEADING_FONT_URLS: readonly string[] = [literataUrl];
