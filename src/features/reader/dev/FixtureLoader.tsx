import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BookFormat, BookKind } from '@/app/contracts';
import { useServices } from '@/app/services-context';
import { createFileStore, FilePaths, newId } from '@/data';
import type { BookRecord } from '@/data/schema';

/*
 * DEV ONLY. This module is only reachable from `import.meta.env.DEV` branches, so it and the fixture files it
 * references are not part of any production build (checked in the build output by src/features/reader/e2e).
 *
 * Every fixture states its format explicitly. Nothing here looks at a file name or extension to decide how a book
 * opens; some fixtures are stored under deliberately wrong names to prove that.
 */

interface Fixture {
  readonly file: string;
  readonly format: BookFormat;
  readonly kind: BookKind;
  readonly title: string;
  readonly author: string;
  /** Name the bytes are stored under in OPFS. Odd on purpose for two fixtures. */
  readonly storedName: string;
}

const FIXTURES: readonly Fixture[] = [
  { file: 'alice.epub', format: 'epub', kind: 'ebook', title: 'Alice’s Adventures in Wonderland', author: 'Lewis Carroll', storedName: 'book.epub__1_' },
  { file: 'alice-illustrated.epub', format: 'epub', kind: 'ebook', title: 'Alice’s Adventures in Wonderland (illustrated)', author: 'Lewis Carroll', storedName: 'alice-illustrated.epub' },
  { file: 'alice.pdf', format: 'pdf', kind: 'pdf', title: 'Alice’s Adventures in Wonderland (PDF)', author: 'Lewis Carroll', storedName: 'scan.txt' },
  { file: 'alice.mobi', format: 'mobi', kind: 'ebook', title: 'Alice’s Adventures in Wonderland (MOBI)', author: 'Lewis Carroll', storedName: 'alice' },
  { file: 'alice.fb2', format: 'fb2', kind: 'ebook', title: 'Alice’s Adventures in Wonderland (FB2)', author: 'Lewis Carroll', storedName: 'ALICE.FB2' },
  { file: 'alice.docx', format: 'docx', kind: 'doc', title: 'Alice’s Adventures in Wonderland (DOCX)', author: 'Lewis Carroll', storedName: 'alice.docx' },
  { file: 'alice.txt', format: 'txt', kind: 'doc', title: 'Alice’s Adventures in Wonderland (TXT)', author: 'Lewis Carroll', storedName: 'alice.txt' },
  { file: 'alice.cbz', format: 'cbz', kind: 'ebook', title: 'Alice’s Adventures in Wonderland (comic pages)', author: 'Lewis Carroll', storedName: 'alice.cbz' },
];

const urls = import.meta.glob('../fixtures/alice*', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Adds the public-domain fixtures to the library and opens them. Reached at /dev/reader in development only. */
export default function FixtureLoader() {
  const { db } = useServices();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [known, setKnown] = useState<Record<string, string>>({});

  useEffect(() => {
    void db.books.toArray().then((rows) => setKnown(Object.fromEntries(rows.map((r) => [r.fingerprint, r.id]))));
  }, [db]);

  async function open(f: Fixture): Promise<void> {
    setBusy(f.file);
    setError(undefined);
    try {
      const fingerprint = `dev-fixture:${f.file}`;
      const existing = await db.books.where('fingerprint').equals(fingerprint).first();
      if (existing) {
        navigate(`/read/${existing.id}`);
        return;
      }
      const url = urls[`../fixtures/${f.file}`];
      if (!url) throw new Error(`Fixture ${f.file} is not available.`);
      const blob = await (await fetch(url)).blob();
      const id = newId();
      const store = await createFileStore();
      const fileRef = FilePaths.book(id, f.storedName);
      await store.write(fileRef, blob);
      const row: BookRecord = {
        id,
        fingerprint,
        kind: f.kind,
        format: f.format,
        title: f.title,
        author: f.author,
        language: 'en',
        fileRef,
        addedAt: Date.now(),
        favorite: false,
        finished: false,
      };
      await db.books.add(row);
      navigate(`/read/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add this fixture.');
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1>Reader fixtures (development only)</h1>
      <p>Public-domain books from src/features/reader/fixtures. Each one states its format; the stored file name does not matter.</p>
      {error ? <p role="alert">{error}</p> : null}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {FIXTURES.map((f) => (
          <li key={f.file}>
            <button type="button" className="pn-btn pn-btn--secondary pn-btn--block" disabled={busy !== undefined} onClick={() => void open(f)}>
              {f.title} · {f.format.toUpperCase()} · stored as “{f.storedName}”{known[`dev-fixture:${f.file}`] ? ' (added)' : ''}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
