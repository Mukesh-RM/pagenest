import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Library seeding against the blueprint 13 storage contract (docs/BLUEPRINT.md section 13, src/data/schema.ts):
 * IndexedDB database "pagenest", object store "books", records shaped like BookRecord.
 * The Library feature (import path) has not landed, so this writes the records directly. Once Library ships an import
 * or a test-seed API, swap `seedLibrary` for it; the tests above it stay the same.
 *
 * Naming trick the tests rely on: every 10th book is a favorite titled "Starred Book NNNNN"; every 100th book also
 * has "Zebra" in its title. Everything else is "Book NNNNN".
 */
export const SEED = { favoriteEvery: 10, zebraEvery: 100 } as const;

interface SeedOptions { count: number }

/** Seeds `count` books (never overwrites ids) and leaves the page reloaded so the app reads them. */
export async function seedLibrary(page: Page, { count }: SeedOptions): Promise<void> {
  // The app creates the database on first launch; we must not create it ourselves with a different version.
  const written = await page.evaluate(
    async ({ count, favoriteEvery, zebraEvery }) => {
      const open = indexedDB.open('pagenest');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
        open.onupgradeneeded = () => { open.transaction?.abort(); reject(new Error('The pagenest database does not exist yet')); };
      });
      if (!db.objectStoreNames.contains('books')) { db.close(); throw new Error('Store "books" is missing (blueprint 13)'); }
      const kinds = [['ebook', 'epub'], ['pdf', 'pdf'], ['audio', 'm4b'], ['ebook', 'mobi'], ['doc', 'docx']] as const;
      const now = Date.now();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('books', 'readwrite');
        const store = tx.objectStore('books');
        for (let i = 0; i < count; i++) {
          const n = String(i).padStart(5, '0');
          const [kind, format] = kinds[i % kinds.length]!;
          const fav = i % favoriteEvery === 0;
          const zebra = i % zebraEvery === 0;
          store.put({
            id: `perf-${n}`, fingerprint: `perf-fp-${n}`, kind, format,
            title: `${fav ? 'Starred ' : ''}Book ${n}${zebra ? ' Zebra' : ''}`,
            author: `Author ${i % 250}`, addedAt: now - i * 1000, favorite: fav, finished: i % 7 === 0,
            ...(kind === 'audio' ? { durationSec: 3600 + i } : {}), ...(kind === 'pdf' ? { pages: 100 + (i % 400) } : {}),
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      const total = await new Promise<number>((resolve, reject) => {
        const r = db.transaction('books').objectStore('books').count();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db.close();
      return total;
    },
    { count, favoriteEvery: SEED.favoriteEvery, zebraEvery: SEED.zebraEvery },
  );
  expect(written, 'books in IndexedDB after seeding').toBeGreaterThanOrEqual(count);
  await page.reload();
}

/** One card per book in the library grid (blueprint 5.5: grid of covers). */
export function bookCards(page: Page): Locator {
  return page.getByRole('main').getByRole('listitem');
}

export function searchField(page: Page): Locator {
  return page.getByRole('searchbox').or(page.getByRole('textbox', { name: /search/i })).first();
}

/** Library filter chip (blueprint 5.5: Reading now, Listening, Finished, Favorites). Button, tab, radio or checkbox. */
export function filterChip(page: Page, name: string): Locator {
  const re = new RegExp(`^${name}$`, 'i');
  return page
    .getByRole('button', { name: re })
    .or(page.getByRole('tab', { name: re }))
    .or(page.getByRole('radio', { name: re }))
    .or(page.getByRole('checkbox', { name: re }))
    .first();
}
