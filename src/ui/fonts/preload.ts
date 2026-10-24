import interUrl from './inter-latin-wght-normal.woff2?url';
import literataUrl from './literata-latin-wght-normal.woff2?url';

/**
 * Preload only the critical fonts: Inter (every control) and Literata regular (every heading and the reader).
 * The italic and everything else load on demand. Call once at startup (before first paint if you can); it adds
 * `<link rel="preload" as="font" crossorigin>` tags and never adds one twice. Returns the URLs for a build-time
 * `<link>` in `index.html` instead, which starts the download earlier.
 */
export function preloadCriticalFonts(doc: Document = document): readonly string[] {
  for (const href of [interUrl, literataUrl]) {
    if (doc.head.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const link = doc.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = href;
    doc.head.appendChild(link);
  }
  return [interUrl, literataUrl];
}

export const CRITICAL_FONT_URLS: readonly string[] = [interUrl, literataUrl];
