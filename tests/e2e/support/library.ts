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

/**
 * Edge-case books that are ALWAYS added by `seedLibrary` (after the generated books, as the oldest items, so the
 * newest-first generated books and the search and filter predicates in perf/ are not disturbed). They exercise the
 * Library card: a cover that is missing, a very long title, a title with one unbreakable long word, an author that
 * needs two lines, a book at 0 % and one at 100 % progress. Progress is stored as rows in the `progress` store
 * (blueprint 13), which is where the Library card reads it from.
 *
 * Covers: no seeded book has a cover (`coverRef` absent), which is the "missing cover" case. A real cover needs a file in
 * OPFS and arrives with the Library import path.
 */
export interface EdgeCaseBook {
  key: string;
  title: string;
  author?: string;
  kind: 'ebook' | 'pdf' | 'doc' | 'audio';
  format: 'epub' | 'pdf' | 'docx' | 'm4b';
  /** Percent read, 0 to 100; absent means no progress row at all. */
  percent?: number;
  finished?: boolean;
  why: string;
}

export const sampleEdgeCases: readonly EdgeCaseBook[] = [
  { key: 'no-cover', title: 'A Book Without a Cover', author: 'Cover Missing', kind: 'ebook', format: 'epub', why: 'no coverRef: the card needs a generated placeholder' },
  {
    key: 'long-title',
    title: 'The Extraordinarily Long and Winding Title of a Remarkably Detailed Treatise on the Customs, Habits, Manners, Festivals and Everyday Life of the Inhabitants of the Northern Provinces, Volume the Second',
    author: 'T. Brief', kind: 'ebook', format: 'epub', why: 'title far longer than the card: must clamp, never overflow',
  },
  {
    key: 'unbreakable-title', title: 'Pneumonoultramicroscopicsilicovolcanoconiosis-Handbook-and-Compendium', author: 'W. Rapp',
    kind: 'pdf', format: 'pdf', why: 'one very long word without spaces: must not push the card wider than the screen',
  },
  {
    key: 'two-line-author', title: 'Two Authors, Two Lines', author: 'Dr. Alexandra Maria Konstantinopoulos-Featherstonehaugh and Sir Bartholomew Wolfeschlegelsteinhausen',
    kind: 'ebook', format: 'epub', why: 'author needs two lines: must clamp cleanly',
  },
  { key: 'zero-percent', title: 'Not Started Yet', author: 'N. Ewbie', kind: 'pdf', format: 'pdf', percent: 0, why: '0 % progress: an empty bar, not a hidden one' },
  { key: 'one-hundred-percent', title: 'Finished and Closed', author: 'F. Inished', kind: 'ebook', format: 'epub', percent: 100, finished: true, why: '100 % progress: a full bar' },
  { key: 'audiobook-halfway', title: 'Long Drive Home', author: 'M. Narrator', kind: 'audio', format: 'm4b', percent: 50, why: 'audio kind with a bar at 50 %' },
] as const;

/** Seeds `count` generated books plus the always-present `sampleEdgeCases`, and leaves the page reloaded so the app reads them. */
export async function seedLibrary(page: Page, { count }: SeedOptions): Promise<void> {
  // The app creates the database on first launch; we must not create it ourselves with a different version.
  const written = await page.evaluate(
    async ({ count, favoriteEvery, zebraEvery, edge }) => {
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
        const tx = db.transaction(['books', 'progress'], 'readwrite');
        const store = tx.objectStore('books');
        const progress = tx.objectStore('progress');
        // Edge-case books: the oldest items, so they sort after the generated books.
        edge.forEach((e, i) => {
          const id = `edge-${e.key}`;
          store.put({
            id, fingerprint: `edge-fp-${e.key}`, kind: e.kind, format: e.format, title: e.title,
            ...(e.author ? { author: e.author } : {}), addedAt: now - (count + 1 + i) * 1000,
            favorite: false, finished: e.finished === true,
            ...(e.kind === 'audio' ? { durationSec: 7200 } : {}), ...(e.kind === 'pdf' ? { pages: 240 } : {}),
          });
          if (e.percent !== undefined) {
            const locator = e.kind === 'audio'
              ? { kind: 'audio', trackIndex: 0, positionSec: 3600 }
              : e.kind === 'pdf'
                ? { kind: 'page', page: e.percent === 0 ? 1 : 240, offset: 0 }
                : { kind: 'reflow', section: e.percent === 0 ? 0 : 99, textOffset: 0 };
            progress.put({ bookId: id, mode: e.kind === 'audio' ? 'listen' : 'read', locator, percent: e.percent, updatedAt: now - 1000 * 60 * 60 * 24 * 30 });
          }
        });
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
    { count, favoriteEvery: SEED.favoriteEvery, zebraEvery: SEED.zebraEvery, edge: sampleEdgeCases.map((e) => ({ ...e })) },
  );
  expect(written, 'books in IndexedDB after seeding').toBeGreaterThanOrEqual(count + sampleEdgeCases.length);
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
