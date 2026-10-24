import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The "Welcome back" resume card (src/data/resume.ts `loadResume`, shown at the top of the Library): the newest row in the
 * IndexedDB `progress` store (database "pagenest") whose book exists, is not finished, and is above 0 % and below 100 %.
 * `seedResumeBook` writes exactly that: one book in `books` and one progress row saved just now, so it is the newest.
 * The app must already have created the database (call after `launch`). Leaves the page reloaded.
 */
export const RESUME_BOOK = { id: 'resume-sample', title: 'The Long Road Back', author: 'R. Eader', percent: 42 } as const;

export async function seedResumeBook(page: Page): Promise<void> {
  await page.evaluate(async (b) => {
    const open = indexedDB.open('pagenest');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onupgradeneeded = () => { open.transaction?.abort(); reject(new Error('The pagenest database does not exist yet')); };
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['books', 'progress'], 'readwrite');
      tx.objectStore('books').put({ id: b.id, fingerprint: `${b.id}-fp`, kind: 'ebook', format: 'epub', title: b.title, author: b.author, addedAt: Date.now() - 60_000, favorite: false, finished: false });
      tx.objectStore('progress').put({ bookId: b.id, mode: 'read', locator: { kind: 'reflow', section: 4, textOffset: 120 }, percent: b.percent, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, RESUME_BOOK);
  await page.reload();
}

export function resumeCard(page: Page): Locator {
  return page.getByRole('main').getByText(/welcome back/i).first();
}

/** Fails loudly unless the resume card is on screen for the seeded book: a CLS measured without it would prove nothing. */
export async function expectResumeCardRendered(page: Page): Promise<void> {
  await expect(resumeCard(page), `the "Welcome back" resume card did not render after seeding a book read to ${RESUME_BOOK.percent} % (src/data/resume.ts loadResume); the layout-shift gate would measure the wrong page`).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('main'), 'the resume card names the seeded book').toContainText(RESUME_BOOK.title);
}
