import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertDocxInline } from './docx-core';
import { htmlToSections } from './text';

const DOCX = join(__dirname, '../../../features/reader/fixtures/alice.docx');

describe('docx adapter (mammoth)', () => {
  it('converts the public-domain alice.docx fixture to sections', async () => {
    const bytes = readFileSync(DOCX);
    const { html } = await convertDocxInline(Uint8Array.from(bytes).buffer);
    const { sections } = htmlToSections(html, 'Beginning');
    expect(sections.length).toBeGreaterThan(0);
    expect(html).toMatch(/Alice/i);
  });
});
