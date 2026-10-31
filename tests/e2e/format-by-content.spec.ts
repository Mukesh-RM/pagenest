import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { skipOnboarding } from './support/app';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function fixture(name: string): Buffer {
  return readFileSync(join(repoRoot, 'src/features/library/e2e/audio-fixtures', name));
}

function readFixture(path: string): Buffer {
  return readFileSync(join(repoRoot, path));
}

async function importOne(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.goto('/');
  await skipOnboarding(page);
  await page.getByRole('button', { name: 'Add books' }).first().click();
  await page.getByTestId('pick-files').setInputFiles(file);
}

test.describe('format detection by file content (names are misleading)', () => {
  test('EPUB stored as book.epub__1_ opens as an ebook', async ({ page }) => {
    const buffer = readFixture('src/features/reader/fixtures/alice.epub');
    await importOne(page, { name: 'book.epub__1_', mimeType: 'application/octet-stream', buffer });
    await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('PDF with no extension opens as PDF', async ({ page }) => {
    const buffer = readFixture('src/features/reader/fixtures/alice.pdf');
    await importOne(page, { name: 'scan-no-ext', mimeType: 'text/plain', buffer });
    await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('DOCX with a .zip name opens as a document', async ({ page }) => {
    const buffer = readFixture('src/features/reader/fixtures/alice.docx');
    await importOne(page, { name: 'archive.zip', mimeType: 'application/zip', buffer });
    const card = page.getByRole('button', { name: /Alice|Wonderland/i }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
  });

  test('M4B disguised as MP3 is imported as audio', async ({ page }) => {
    await importOne(page, {
      name: 'talk.mp3',
      mimeType: 'audio/mpeg',
      buffer: fixture('chaptered-tale.m4b'),
    });
    await expect(page.getByRole('button', { name: /Chaptered Tale/i }).first()).toBeVisible({ timeout: 30_000 });
  });
});
