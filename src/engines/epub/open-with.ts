import type { OpenOptions, ReaderSource } from '@/engines/reader/types';
import { DEFAULT_APPEARANCE } from '@/features/reader/core/appearance';
import { throwIfAborted, toReaderError } from '@/features/reader/core/errors';
import type { LoadedFoliateBook } from './book-loader';
import { FoliateReaderDocument } from './foliate-document';
import { installWebKitFoliateIframeFix, unsandboxFoliateIframesNow, watchUnsandboxFoliateIframes } from './foliate-webkit';

export type Loader = (source: ReaderSource) => Promise<LoadedFoliateBook>;

/** Shared engine body: pick a loader, make a foliate view, open at the saved locator. */
export async function openWith(load: Loader, source: ReaderSource, host: HTMLElement, options: OpenOptions | undefined): Promise<FoliateReaderDocument> {
  throwIfAborted(options?.signal);
  const loaded = await load(source);
  throwIfAborted(options?.signal);
  const appearance = options?.appearance ?? DEFAULT_APPEARANCE;
  installWebKitFoliateIframeFix();
  await import('foliate-js/view.js'); // registers <foliate-view>
  const view = document.createElement('foliate-view') as unknown as ConstructorParameters<typeof FoliateReaderDocument>[0];
  view.style.display = 'block';
  view.style.width = '100%';
  view.style.height = '100%';
  host.append(view);
  const stopSandboxWatch = watchUnsandboxFoliateIframes(host);
  const doc = new FoliateReaderDocument(view, {
    book: loaded.book,
    host,
    appearance,
    fixed: loaded.fixed,
    onUnmount: stopSandboxWatch,
  });
  try {
    await view.open(loaded.book);
    unsandboxFoliateIframesNow(host);
    await doc.start(options?.locator);
    throwIfAborted(options?.signal);
  } catch (error) {
    await doc.close();
    throw toReaderError(error);
  }
  return doc;
}
