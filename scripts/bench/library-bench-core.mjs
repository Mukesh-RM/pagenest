// The measurement itself. Runs unchanged in Node (fake-indexeddb) and in a real browser.
// Bundled by scripts/bench-library.mjs. Uses the real Dexie, BookRepository and LibraryQueryService.
import { BookRepository } from '../../src/data/books.ts';
import { PageNestDB } from '../../src/data/db.ts';
import { MemoryFileStore } from '../../src/data/opfs.ts';
import { LibraryQueryService } from '../../src/data/library-query.ts';

const WORDS = ['river', 'stone', 'night', 'garden', 'silver', 'winter', 'harbor', 'ember', 'lantern', 'meadow', 'iron', 'glass'];

function seedRows(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `seed-${i}`,
    fingerprint: `seed-fp-${i}`,
    kind: i % 5 === 0 ? 'audio' : 'ebook',
    format: i % 5 === 0 ? 'm4b' : 'epub',
    title: `${WORDS[i % 12]} ${WORDS[(i * 7) % 12]} ${WORDS[(i * 5) % 12]} ${i}`,
    author: `Author ${i % 400} Surname${i % 97}`,
    narrator: i % 5 === 0 ? `Narrator ${i % 40}` : undefined,
    series: i % 9 === 0 ? `Series ${i % 60}` : undefined,
    addedAt: 1_700_000_000_000 + i * 1000,
    lastOpenedAt: i % 3 === 0 ? 1_700_000_000_000 + i * 5000 : undefined,
    favorite: i % 11 === 0,
    finished: i % 7 === 0,
    coverRef: i % 2 === 0 ? `covers/seed-${i}.img` : undefined,
  }));
}

const now = () => performance.now();
export function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
  return { n: s.length, median: +at(0.5).toFixed(2), p95: +at(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) };
}

/** @param {{books?: number, runs?: number}} options */
export async function runBench({ books = 5000, runs = 40 } = {}) {
  const db = new PageNestDB(`bench-${Math.random()}`);
  await db.books.bulkAdd(seedRows(books));
  const files = new MemoryFileStore();
  const repo = new BookRepository(db, files);
  const svc = new LibraryQueryService(db);

  const results = {};
  const measure = async (label, write, query) => {
    const samples = [];
    for (let i = 0; i < runs; i++) {
      await write(i);
      // Let change notifications settle, as they do between a user action and the next screen refresh.
      await new Promise((r) => setTimeout(r, 0));
      const t = now();
      const page = await query();
      samples.push(now() - t);
      if (page.total === 0 && label.includes('search')) throw new Error('search found nothing');
    }
    results[label] = stats(samples);
  };

  const recent = () => svc.query({ limit: 60 });
  const byTitle = () => svc.query({ sort: 'title', limit: 60 });
  const search = () => svc.query({ text: 'silv lan', limit: 60 });

  await svc.query({});
  const warm = [];
  for (let i = 0; i < runs; i++) {
    const t = now();
    await recent();
    warm.push(now() - t);
  }
  results['warm query (no write)'] = stats(warm);

  const ids = Array.from({ length: runs }, (_, i) => `seed-${i * 3 + 1}`);
  const toggle = (i) => repo.update(ids[i], { favorite: true, title: `Edited ${i} ${WORDS[i % 12]}` });
  await measure('default list after 1 metadata edit', toggle, recent);
  await measure('title-sorted list after 1 metadata edit', (i) => repo.update(ids[i], { author: `Edited author ${i}` }), byTitle);
  await measure('search after 1 metadata edit', (i) => repo.update(ids[i], { series: `Silver lantern ${i}` }), search);
  let n = 0;
  await measure(
    'default list after 1 import (add)',
    () => repo.add({ fingerprint: `bench-new-${n++}`, kind: 'ebook', format: 'epub', title: `Silver lantern new ${n}`, file: new Blob(['x']), fileName: 'b.epub' }),
    recent,
  );
  const open = (i) => repo.markOpened(`seed-${i * 3 + 2}`);
  await measure('default list after opening a book (markOpened)', open, recent);

  // A second connection writing (the import worker case).
  const other = new PageNestDB(db.name);
  const otherRepo = new BookRepository(other, new MemoryFileStore());
  let m = 0;
  await measure(
    'default list after a write from another connection',
    () => otherRepo.update(`seed-${(m++) * 3 + 100}`, { favorite: true }),
    recent,
  );
  other.close();

  svc.close();
  db.close();
  await db.delete();
  return { books, runs, results };
}
