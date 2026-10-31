import sampleUrl from '@/features/library/sample/peter-rabbit.epub?url';
import type { AppServices } from './services-context';
import type { WarmTask } from './offline-warm';

/**
 * What is warmed into the service worker's runtime cache (Decision 15). Loaded lazily, after the first Library render, so the
 * `?url` import and the loaders stay out of the first load. Add an engine here when it ships (the EPUB and PDF engines are listed below).
 */
/**
 * A module the page has already loaded is not fetched again by `import()`, so the worker never sees it. That is the common case on
 * the first visit: the person opens the sample book in the first seconds, before the warm-up runs. Fetch such files once more, by URL
 * (the browser's HTTP cache usually answers); with the worker in control, it stores them.
 */
export const ENGINE_FOLIATE_CHUNK = /\/assets\/engine-foliate-[^/]+\.js$/;
export const ENGINE_FOLIATE_FORMATS_CHUNK = /\/assets\/engine-foliate-formats-[^/]+\.js$/;
export const ENGINE_PDF_CHUNK = /\/assets\/engine-pdf-[^/]+\.js$/;

async function storeLoaded(pattern: RegExp): Promise<void> {
  const names = performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => pattern.test(new URL(name).pathname) && new URL(name).origin === location.origin);
  for (const name of new Set(names)) {
    const response = await fetch(name, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`${name} ${response.status}`);
    await response.arrayBuffer();
  }
}

/** Re-fetch lazy engine chunks the page already loaded so the service worker can store them (Decision 15). */
export async function persistLoadedEngineChunks(...patterns: RegExp[]): Promise<void> {
  const list = patterns.length ? patterns : [ENGINE_FOLIATE_CHUNK, ENGINE_FOLIATE_FORMATS_CHUNK, ENGINE_PDF_CHUNK];
  for (const pattern of list) await storeLoaded(pattern);
}

export function offlineWarmTasks(services: Pick<AppServices, 'sampleBook'>): WarmTask[] {
  const tasks: WarmTask[] = [];
  if (services.sampleBook?.available()) {
    tasks.push({
      name: 'sample-book',
      run: async () => {
        const response = await fetch(sampleUrl, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`sample book ${response.status}`);
        await response.arrayBuffer(); // read it through, so the worker finishes writing it to its cache
      },
    });
  }
  // The Reader's engines. The small engine wrappers are precached; what is stored here is the big library chunk each one loads
  // when a book opens (foliate-js, pdf.js) and the pdf.js worker. The browser fetches each file, the service worker stores it
  // (cache first, pn-engines-v1). Importing only fetches and evaluates the module; nothing opens. EPUB first (the sample is one).
  tasks.push({
    name: 'epub-engine',
    run: async () => {
      await import('@/engines/epub/epub-engine');
      await import('foliate-js/view.js'); // the same import the engine makes when a book opens
      await import('foliate-js/mobi.js');
      await import('foliate-js/fb2.js');
      await import('foliate-js/comic-book.js');
      await storeLoaded(ENGINE_FOLIATE_FORMATS_CHUNK);
      await storeLoaded(ENGINE_FOLIATE_CHUNK);
    },
  });
  tasks.push({
    name: 'pdf-engine',
    run: async () => {
      await import('@/engines/pdf/pdf-engine');
      const { loadPdfjs } = await import('@/engines/pdf/pdfjs');
      await loadPdfjs();
      await storeLoaded(ENGINE_PDF_CHUNK);
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      const response = await fetch(worker.default, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`pdf worker ${response.status}`);
      await response.arrayBuffer(); // read it through, so the worker finishes writing it to its cache
    },
  });
  return tasks;
}
