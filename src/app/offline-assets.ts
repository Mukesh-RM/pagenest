import sampleUrl from '@/features/library/sample/peter-rabbit.epub?url';
import type { AppServices } from './services-context';
import type { WarmTask } from './offline-warm';

/**
 * What is warmed into the service worker's runtime cache (Decision 15). Loaded lazily, after the first Library render, so the
 * `?url` import and the loaders stay out of the first load. Add an engine here when it ships, for example the EPUB engine:
 * `{ name: 'epub-engine', run: () => import('@/engines/epub/epub-engine') }` (the browser fetches the chunk; the worker caches it).
 */
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
  return tasks;
}
