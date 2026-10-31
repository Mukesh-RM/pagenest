import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(here, '..', '..', '..', '..', '..');
export const FIXTURE_DIR = resolve(REPO, 'src', 'features', 'reader', 'fixtures');
export const LARGE_PDF = process.env.PN_LARGE_PDF ?? join(tmpdir(), 'pn-large-50mb.pdf');

/** Build the 50 MB synthetic scan PDF once (not committed: too big). Uses the Node tool in fixtures/tools. */
export function ensureLargePdf() {
  if (existsSync(LARGE_PDF)) return;
  mkdirSync(dirname(LARGE_PDF), { recursive: true });
  const tool = join(FIXTURE_DIR, 'tools', 'make-large-pdf.mjs');
  const r = spawnSync(process.execPath, [tool, LARGE_PDF, '50'], { stdio: 'inherit', cwd: REPO });
  if (r.status !== 0) throw new Error('Could not build the large PDF fixture (node make-large-pdf.mjs failed).');
}

/** Fixtures the tests seed. `format` is stated explicitly, like the Library's stored format; `storedName` is deliberately odd for some. */
export const BOOKS = {
  epub: { fixture: 'alice.epub', format: 'epub', kind: 'ebook', title: 'Alice in Wonderland', storedName: 'book.epub__1_' },
  epubIllustrated: { fixture: 'alice-illustrated.epub', format: 'epub', kind: 'ebook', title: 'Alice illustrated', storedName: 'ALICE (1).EPUB' },
  pdf: { fixture: 'alice.pdf', format: 'pdf', kind: 'pdf', title: 'Alice PDF', storedName: 'scan.txt' },
  large: { fixture: 'large.pdf', format: 'pdf', kind: 'pdf', title: 'Large scan', storedName: 'no-extension' },
  mobi: { fixture: 'alice.mobi', format: 'mobi', kind: 'ebook', title: 'Alice MOBI', storedName: 'alice.epub' },
  fb2: { fixture: 'alice.fb2', format: 'fb2', kind: 'ebook', title: 'Alice FB2', storedName: 'alice.fb2' },
  docx: { fixture: 'alice.docx', format: 'docx', kind: 'doc', title: 'Alice DOCX', storedName: 'alice.zip' },
  txt: { fixture: 'alice.txt', format: 'txt', kind: 'doc', title: 'Alice TXT', storedName: 'alice.pdf' },
  cbz: { fixture: 'alice.cbz', format: 'cbz', kind: 'ebook', title: 'Alice comic', storedName: 'alice.cbz' },
};
