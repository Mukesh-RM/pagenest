import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SampleBookProvider } from '@/app/contracts';
import { makeServices } from '@/app/test-utils';
import { ServicesContext, type AppServices } from '@/app/services-context';
import { bookRecord } from '@/data/test-fixtures';
import { makeEpub, makeMp3, makePdf } from '@/workers/import/testing/fixtures';
import { resetImportController, setImportBackend } from '../registry';
import { inProcessBackend } from '../testing/in-process-backend';
import { LibraryScreen } from './LibraryScreen';
import { CollectionsScreen } from './CollectionsScreen';

/** Small stand-in for user-event (not a dependency of this project). */
const userEvent = {
  setup: () => ({
    click: async (el: Element) => {
      fireEvent.click(el);
    },
    type: async (el: Element, text: string) => {
      fireEvent.change(el, { target: { value: ((el as HTMLInputElement).value ?? '') + text } });
    },
    clear: async (el: Element) => {
      fireEvent.change(el, { target: { value: '' } });
    },
    selectOptions: async (el: Element, value: string) => {
      fireEvent.change(el, { target: { value } });
    },
    upload: async (el: Element, files: File[]) => {
      Object.defineProperty(el, 'files', { configurable: true, value: files });
      fireEvent.change(el);
    },
  }),
};

function streamOf(blob: Blob): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
      controller.close();
    },
  });
}

let services: AppServices;
let backend: ReturnType<typeof inProcessBackend>;

beforeAll(() => {
  // jsdom's Blob has no stream() or arrayBuffer(); the import code needs both.
  const proto = Blob.prototype as unknown as Record<string, unknown>;
  proto['arrayBuffer'] ??= function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
  proto['stream'] ??= function (this: Blob) {
    return streamOf(this);
  };
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 360 });
});
beforeEach(() => {
  services = makeServices('library-screen');
  backend = inProcessBackend(services.db);
  resetImportController();
  setImportBackend(() => backend);
});
afterEach(async () => {
  resetImportController();
  services.covers.dispose();
  services.data.close();
  services.db.close();
  await services.db.delete();
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function renderLibrary(extra: Partial<AppServices> = {}) {
  return render(
    <ServicesContext.Provider value={{ ...services, ...extra }}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<LibraryScreen />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </ServicesContext.Provider>,
  );
}

/** Seeds the way QA does: bare rows, no cover, no fingerprint, some fields missing. */
async function seed(count: number): Promise<void> {
  const now = Date.now();
  await services.db.books.bulkPut(
    Array.from({ length: count }, (_, i) => {
      const n = String(i).padStart(3, '0');
      const fav = i % 10 === 0;
      return { id: `perf-${n}`, kind: 'ebook', format: 'epub', title: `${fav ? 'Starred ' : ''}Book ${n}${i % 25 === 0 ? ' Zebra' : ''}`, author: `Author ${i % 7}`, addedAt: now - i * 1000, favorite: fav, finished: false } as never;
    }),
  );
}
const cards = () => screen.queryAllByRole('listitem').filter((li) => li.classList.contains('pn-library__item'));
const anyCard = async (): Promise<HTMLElement> => (await screen.findAllByRole('button', { name: /, Author \d/ }))[0] as HTMLElement;

describe('the library list', () => {
  it('shows books seeded straight into the database, with nothing else set up', async () => {
    await seed(40);
    renderLibrary();
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    expect(cards().length).toBeLessThan(40); // virtualized: only the rows near the screen are in the page
    expect(cards()[0]?.textContent).toMatch(/Book|Starred/);
  });

  it('shows a skeleton while loading and a designed empty state for an empty library', async () => {
    renderLibrary();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(await screen.findByRole('heading', { name: 'Your library is empty' })).toBeTruthy();
    expect(screen.getByText('Add an EPUB, PDF or audiobook from your device. Everything stays on this device.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add books' })).toHaveLength(2); // the header's and the empty state's
    expect(cards()).toHaveLength(0);
  });

  it('search narrows the list, and a search with no hits explains and offers a way back', async () => {
    await seed(60);
    renderLibrary();
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    const user = userEvent.setup();
    await user.type(screen.getByRole('searchbox', { name: 'Search your library' }), 'zebra');
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    await waitFor(() => expect(cards().every((c) => /Zebra/.test(c.textContent ?? ''))).toBe(true));
    expect(cards()).toHaveLength(3); // every 25th of 60 books: 0, 25, 50
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'qqqq');
    expect(await screen.findByRole('heading', { name: 'No books match that search' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    await waitFor(() => expect(cards().length).toBeGreaterThan(3));
  });

  it('the Favorites chip filters, and All brings every book back', async () => {
    await seed(60);
    renderLibrary();
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    const user = userEvent.setup();
    const chip = screen.getByRole('button', { name: 'Favorites' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    await user.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(cards().every((c) => /Starred/.test(c.textContent ?? ''))).toBe(true));
    expect(cards()).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(cards().length).toBeGreaterThan(6));
  });

  it('sorts by title and remembers the view and sort between visits', async () => {
    await seed(12);
    const { unmount } = renderLibrary();
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'title');
    await waitFor(() => expect(cards()[0]?.textContent).toMatch(/Book 001|Starred Book 000/));
    await user.click(screen.getByRole('button', { name: 'List' }));
    await waitFor(() => expect(document.querySelector('.pn-bookcard--list')).not.toBeNull());
    unmount();
    renderLibrary();
    await waitFor(() => expect(document.querySelector('.pn-bookcard--list')).not.toBeNull());
    expect((screen.getByRole('combobox', { name: 'Sort by' }) as HTMLSelectElement).value).toBe('title');
  });

  it('tapping a book opens the design system\'s detail sheet, then Read or Listen goes to the reader or the player', async () => {
    await services.db.books.put(bookRecord('a1', { title: 'Reader Book', author: 'A. Writer', pages: 120 }));
    await services.db.books.put(bookRecord('a2', { title: 'Listen Book', kind: 'audio', format: 'm4b', durationSec: 7200 }));
    renderLibrary();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Reader Book/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Reader Book' });
    expect(screen.queryByTestId('where')).toBeNull(); // not opened in the reader yet
    expect(within(sheet).getAllByText('A. Writer').length).toBeGreaterThan(0);
    expect(within(sheet).getByText(/EPUB/)).toBeTruthy();
    expect(within(sheet).getByText('Not started')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Listen' })).toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'Start reading' }));
    expect(screen.getByTestId('where').textContent).toBe('/read/a1');
  });

  it('opens an audiobook in the player from its detail sheet', async () => {
    await services.db.books.put(bookRecord('a2', { title: 'Listen Book', kind: 'audio', format: 'm4b', durationSec: 7200 }));
    renderLibrary();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Listen Book/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Listen Book' });
    expect(within(sheet).getByText(/2 h/)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Listen' }));
    expect(screen.getByTestId('where').textContent).toBe('/listen/a2');
  });

  it('removes a book from the detail sheet\'s menu after a question, with Undo', async () => {
    await services.db.books.put(bookRecord('a1', { title: 'Reader Book', fingerprint: 'fp-a1' }));
    renderLibrary();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Reader Book/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Reader Book' });
    expect(within(sheet).queryByRole('button', { name: 'Remove from library' })).toBeNull(); // inside the menu, not loose
    await user.click(within(sheet).getByRole('button', { name: 'More options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove from library' }));
    const confirm = await screen.findByRole('dialog', { name: /Remove .Reader Book.\?/ });
    expect(await services.db.books.count()).toBe(1); // nothing is removed before the answer
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Book removed')).toBeTruthy();
    expect(await services.db.books.count()).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect(await services.db.books.count()).toBe(1));
  });

  it('is the design system\'s toolbar: a labelled sort select, the layout switch, and one row of chips with Favorites', async () => {
    await seed(6);
    renderLibrary();
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Add books' }).className).toContain('pn-btn--primary');
    expect(screen.getByRole('heading', { name: 'Library', level: 1 })).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Filter library' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Favorites', 'Reading', 'Listening', 'Finished']);
    expect(group.className).toContain('pn-chip-group--scroll'); // one row that scrolls, never wraps
    expect(group.parentElement?.className).toBe('pn-library__filters'); // with the design system's fade at its end
    expect(screen.getByText('Sort by').tagName).toBe('LABEL');
    expect(within(screen.getByRole('combobox', { name: 'Sort by' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['Recently opened', 'Recently added', 'Title', 'Author']);
    const layout = screen.getByRole('group', { name: 'Library layout' });
    expect(within(layout).getByRole('button', { name: 'Grid of covers' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('draws every card with the design system\'s BookCard and BookCover, never its own markup', async () => {
    await seed(6);
    renderLibrary();
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    expect(document.querySelector('[class*="pn-lib-card"], [class*="pn-lib-cover"], [class*="pn-lib-item"]')).toBeNull();
    expect(document.querySelectorAll('.pn-bookcard .pn-cover').length).toBe(cards().length);
    expect(document.querySelector('.pn-library__grid')?.getAttribute('aria-label')).toBe('Books');
  });

  it('shows the header slot (the resume card) under the filters and above the books', async () => {
    await seed(3);
    const { container } = render(
      <ServicesContext.Provider value={services}>
        <MemoryRouter>
          <LibraryScreen header={<section aria-label="Welcome back">Resume here</section>} />
        </MemoryRouter>
      </ServicesContext.Provider>,
    );
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    const slot = screen.getByRole('region', { name: 'Welcome back' });
    const filters = container.querySelector('.pn-library__options') as HTMLElement;
    const grid = container.querySelector('.pn-library__grid') as HTMLElement;
    expect(filters.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slot.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('selecting, editing and deleting', () => {
  it('marks favorites on screen first and in the database after', async () => {
    await seed(5);
    renderLibrary();
    const user = userEvent.setup();
    const first = await anyCard();
    fireEvent.contextMenu(first); // right-click or press and hold starts selecting
    await user.click(await screen.findByRole('button', { name: /favorites/ }));
    await waitFor(async () => expect((await services.db.books.toArray()).filter((b) => b.favorite).length).toBeGreaterThanOrEqual(1));
  });

  it('deletes with Undo, and the books come back with their data', async () => {
    await seed(3);
    // BookRepository.restore needs a fingerprint (see data-requests); books made by the importer always have one.
    await services.db.books.toCollection().modify((b) => {
      b.fingerprint = `fp-${b.id}`;
    });
    await services.db.progress.put({ bookId: 'perf-000', mode: 'read', locator: { kind: 'reflow', section: 0, textOffset: 0 }, percent: 30, updatedAt: 1 });
    renderLibrary();
    const user = userEvent.setup();
    fireEvent.contextMenu(await anyCard()); // press and hold starts selecting
    await user.click(await screen.findByRole('button', { name: 'Select all' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('3 books removed')).toBeTruthy();
    expect(await services.db.books.count()).toBe(0);
    await waitFor(() => expect(cards()).toHaveLength(0));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect(await services.db.books.count()).toBe(3));
    expect((await services.db.progress.toArray()).length).toBe(1);
    await waitFor(() => expect(cards().length).toBe(3));
  });

  it('edits the title and refuses an empty one in plain words', async () => {
    await seed(2);
    renderLibrary();
    const user = userEvent.setup();
    const card = await anyCard();
    fireEvent.contextMenu(card);
    await user.click(await screen.findByRole('button', { name: 'Edit details' }));
    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('A book needs a title.');
    await user.type(title, 'A Better Name');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await services.db.books.toArray()).some((b) => b.title === 'A Better Name')).toBe(true));
  });

  it('puts books on a new collection', async () => {
    await seed(2);
    renderLibrary();
    const user = userEvent.setup();
    const card = await anyCard();
    fireEvent.contextMenu(card);
    await user.click(await screen.findByRole('button', { name: 'Add to a collection' }));
    await user.type(await screen.findByLabelText('New collection'), 'Summer');
    await user.click(screen.getByRole('button', { name: 'Make it and add' }));
    await waitFor(async () => expect((await services.db.collectionBooks.toArray()).length).toBe(1));
    expect((await services.db.collections.toArray())[0]?.name).toBe('Summer');
  });
});

describe('adding files', () => {
  async function pick(...files: File[]): Promise<void> {
    const user = userEvent.setup();
    await user.click(await (await screen.findAllByRole('button', { name: 'Add books' }))[0] as HTMLElement);
    const input = (await screen.findByTestId('pick-files')) as HTMLInputElement;
    await user.upload(input, files);
  }
  const file = (bytes: Uint8Array, name: string, type = ''): File => new File([bytes as BlobPart], name, { type });

  it('imports by content, whatever the file is called, and says what happened', async () => {
    renderLibrary();
    await pick(file(await makeEpub({ title: 'Odd Name' }), 'book.epub__1_'), file(makePdf({ title: 'A Pdf' }), 'no-extension'), file(makeMp3({ title: 'Song', frames: 40 }), 'audio.pdf', 'application/pdf'));
    expect(await screen.findByText(/Added 3 books/)).toBeTruthy();
    await waitFor(() => expect(cards()).toHaveLength(3));
    const kinds = (await services.db.books.toArray()).map((b) => b.format).sort();
    expect(kinds).toEqual(['epub', 'mp3', 'pdf']);
  });

  it('says in plain words when a file is really unsupported, and lists it', async () => {
    renderLibrary();
    await pick(file(new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff]), 'setup.epub'));
    expect(await screen.findByText(/1 file could not be added/)).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'See why' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('setup.epub')).toBeTruthy();
    expect(within(sheet).getByText(/cannot open this kind of file/)).toBeTruthy();
    expect(await services.db.books.count()).toBe(0);
  });

  it('reports a duplicate instead of adding it twice', async () => {
    renderLibrary();
    const bytes = await makeEpub({ title: 'Twice' });
    await pick(file(bytes, 'one.epub'));
    await screen.findByText(/Added 1 book/);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }));
    await pick(file(bytes, 'copy of one.bin'));
    expect(await screen.findByText(/Nothing new was added. 1 was already in your library/)).toBeTruthy();
    expect(await services.db.books.count()).toBe(1);
  });

  it('asks for persistent storage after the first import only', async () => {
    const persist = vi.fn(async () => true);
    const original = navigator.storage;
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist, persisted: async () => false, estimate: async () => ({}) } });
    try {
      renderLibrary();
      await pick(file(await makeEpub({ title: 'First' }), 'a.epub'));
      await screen.findByText(/Added 1 book/);
      await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    } finally {
      Object.defineProperty(navigator, 'storage', { configurable: true, value: original });
    }
  });
});

describe('the sample book card', () => {
  const provider = (over: Partial<SampleBookProvider> = {}): SampleBookProvider => ({
    info: { title: 'Sample', author: 'Someone', license: 'Public domain', provenance: 'Project Gutenberg, ebook 1' },
    available: () => true,
    importSample: async () => ({ bookId: 'sample-1', kind: 'ebook', format: 'epub', title: 'Sample', alreadyInLibrary: false }),
    ...over,
  });
  it('shows in an empty library and opens the book once it is added', async () => {
    renderLibrary({ sampleBook: provider() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add the sample book' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/read/sample-1'));
  });
  it('is not shown when the provider says it cannot work', async () => {
    renderLibrary({ sampleBook: provider({ available: () => false }) });
    await screen.findByRole('heading', { name: 'Your library is empty' });
    expect(screen.queryByRole('button', { name: /sample/i })).toBeNull();
  });
});

describe('collections screen', () => {
  it('makes, renames, reorders and deletes a collection, with Undo for the delete', async () => {
    const user = userEvent.setup();
    render(
      <ServicesContext.Provider value={services}>
        <MemoryRouter>
          <CollectionsScreen />
        </MemoryRouter>
      </ServicesContext.Provider>,
    );
    expect(await screen.findByRole('heading', { name: 'No collections yet' })).toBeTruthy();
    for (const name of ['Alpha', 'Beta']) {
      await user.click(screen.getAllByRole('button', { name: /^(New|Make a collection)$/ })[0] as HTMLElement);
      await user.type(await screen.findByLabelText('Name'), name);
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText(name);
    }
    await user.click(screen.getByRole('button', { name: 'Move Beta up' }));
    await waitFor(async () => expect((await services.db.collections.orderBy('order').toArray()).map((c) => c.name)).toEqual(['Beta', 'Alpha']));
    await user.click(screen.getByRole('button', { name: 'Rename Alpha' }));
    const field = await screen.findByLabelText('Name');
    await user.clear(field);
    await user.type(field, 'Beta');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/already/i);
    await user.clear(field);
    await user.type(field, 'Gamma');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Gamma');
    await user.click(screen.getByRole('button', { name: 'Delete Gamma' }));
    await waitFor(async () => expect(await services.db.collections.count()).toBe(1));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect(await services.db.collections.count()).toBe(2));
  });
});

// keep act imported for future async-state helpers
void act;
