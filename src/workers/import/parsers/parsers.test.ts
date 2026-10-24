// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { imageType } from '../sniff';
import { makeCbz, makeDocx, makeEpub, makeFb2, makeHtml, makeMobi, makeMp3, makeMp4Audio, makePdf, makePdfCompressed, makePng, makeFlac, makeWav, makeOgg } from '../testing/fixtures';
import { parseAudio } from './audio';
import { parseCbz } from './cbz';
import { parseDocx } from './docx';
import { parseEpub, resolveHref } from './epub';
import { parseFb2 } from './fb2';
import { parseHtml } from './html';
import { parseMobi } from './mobi';
import { parseMp4Chapters } from './mp4chapters';
import { decodePdfText, parsePdf } from './pdf';

const blob = (b: Uint8Array): Blob => new Blob([b as BlobPart]);
const png = await makePng(6, 9, [10, 120, 200]);

describe('EPUB metadata', () => {
  it('reads title, author, language, series and a cover whose path has spaces and %20', async () => {
    const meta = await parseEpub(blob(await makeEpub({ title: 'Tom &amp; Jerry', author: 'Ann Author', language: 'en_gb', series: 'Cat and Mouse', cover: png })));
    expect(meta).toMatchObject({ title: 'Tom & Jerry', author: 'Ann Author', language: 'en-GB', series: 'Cat and Mouse' });
    expect(meta.cover && imageType(meta.cover.bytes)).toBe('png');
  });
  it('still works with no author and no cover', async () => {
    const meta = await parseEpub(blob(await makeEpub({ title: 'Plain' })));
    expect(meta.title).toBe('Plain');
    expect(meta.author).toBeUndefined();
    expect(meta.cover).toBeUndefined();
  });
  it('resolves relative hrefs', () => {
    expect(resolveHref('OEBPS/content.opf', '../img/My%20Pic.png#x')).toBe('img/My Pic.png');
    expect(resolveHref('content.opf', 'a/b.png')).toBe('a/b.png');
  });
});

describe('other container formats', () => {
  it('DOCX core properties', async () => {
    expect(await parseDocx(blob(await makeDocx({ title: 'Report', author: 'Rae' })))).toEqual({ title: 'Report', author: 'Rae' });
  });
  it('CBZ page count, first page cover (natural order) and ComicInfo', async () => {
    const meta = await parseCbz(blob(await makeCbz({ pages: 12, comicInfo: '<ComicInfo><Series>Rocket</Series><Number>4</Number><Writer>Wes</Writer></ComicInfo>' })));
    expect(meta).toMatchObject({ pages: 12, title: 'Rocket 4', series: 'Rocket', author: 'Wes' });
    expect(meta.cover && imageType(meta.cover.bytes)).toBe('png');
  });
  it('MOBI title, author, language and cover record', async () => {
    const meta = await parseMobi(blob(makeMobi({ title: 'Mobi Title', author: 'Mia', cover: png })));
    expect(meta).toMatchObject({ title: 'Mobi Title', author: 'Mia', language: 'en' });
    expect(meta.cover && imageType(meta.cover.bytes)).toBe('png');
  });
  it('FB2 with a cover binary, in UTF-8 and a legacy encoding', async () => {
    const meta = await parseFb2(blob(makeFb2({ title: 'Story', author: ['Ivan', 'Petrov'], cover: png })));
    expect(meta).toMatchObject({ title: 'Story', author: 'Ivan Petrov', language: 'en', series: 'Tales' });
    expect(meta.cover && imageType(meta.cover.bytes)).toBe('png');
    expect((await parseFb2(blob(makeFb2({ encoding: 'windows-1251' })))).title).toBe('An FB2 Story');
  });
  it('FB2 whose cover sits far into a large file', async () => {
    const small = makeFb2({ cover: png });
    const text = new TextDecoder().decode(small);
    const padded = text.replace('</body>', `<p>${'x'.repeat(5 * 1024 * 1024)}</p></body>`);
    expect((await parseFb2(blob(new TextEncoder().encode(padded)))).cover).toBeDefined();
  });
  it('HTML title', async () => {
    expect(await parseHtml(blob(makeHtml('Caf&eacute; page')))).toEqual({ title: 'Caf&eacute; page' });
  });
});

describe('PDF info', () => {
  it('reads a classic file with escaped parentheses in the title', async () => {
    expect(await parsePdf(blob(makePdf({ title: 'A \\(Tiny\\) PDF', author: 'Pat', pages: 7 })))).toEqual({ title: 'A (Tiny) PDF', author: 'Pat', pages: 7 });
  });
  it('reads a PDF 1.5 file with an xref stream, object stream and UTF-16 title', async () => {
    expect(await parsePdf(blob(await makePdfCompressed({ title: 'Compressed Ünicode', author: 'Cleo', pages: 41 })))).toEqual({ title: 'Compressed Ünicode', author: 'Cleo', pages: 41 });
  });
  it('falls back to scanning when the xref is broken', async () => {
    const bytes = makePdf({ title: 'Scanned', pages: 4 });
    const text = new TextDecoder('latin1').decode(bytes).replace(/startxref\n\d+/, 'startxref\n1');
    const meta = await parsePdf(blob(Uint8Array.from(text, (c) => c.charCodeAt(0))));
    expect(meta.title).toBe('Scanned');
    expect(meta.pages).toBe(4);
  });
  it('returns nothing, without throwing, for junk', async () => {
    expect(await parsePdf(blob(new TextEncoder().encode('%PDF-1.4 nothing useful')))).toEqual({});
  });
  it('decodes PDF text strings', () => {
    expect(decodePdfText('\u00fe\u00ff\u0000H\u0000i')).toBe('Hi');
    expect(decodePdfText('plain')).toBe('plain');
  });
});

describe('audio tags', () => {
  it('MP3: ID3 title, album and artist, and an estimated duration', async () => {
    const meta = await parseAudio(blob(makeMp3({ title: 'Chapter 1', album: 'The Big Book', artist: 'Narr Ator', frames: 400 })));
    expect(meta.title).toBe('The Big Book');
    expect(meta.trackTitle).toBe('Chapter 1');
    expect(meta.author).toBe('Narr Ator');
    expect(meta.durationSec).toBeGreaterThan(8);
  });
  it('M4B: title, duration and chapters', async () => {
    const meta = await parseAudio(blob(makeMp4Audio({ brand: 'M4B ', album: 'Audio Book', seconds: 90, chapters: [['Intro', 0], ['Part two', 30]] })));
    expect(meta.title).toBe('Audio Book');
    expect(meta.durationSec).toBeGreaterThan(80);
    expect((await parseMp4Chapters(blob(makeMp4Audio({ brand: 'M4B ', chapters: [['Intro', 0], ['Part two', 30.5]] })))).map((c) => [c.title, c.startSec])).toEqual([['Intro', 0], ['Part two', 30.5]]);
    expect(await parseMp4Chapters(blob(makeMp3()))).toEqual([]);
  });
  it('FLAC, WAV and Ogg report a duration or at least do not fail', async () => {
    expect((await parseAudio(blob(makeFlac()))).durationSec).toBeCloseTo(3, 0);
    expect((await parseAudio(blob(makeWav(2)))).durationSec).toBeCloseTo(2, 0);
    await expect(parseAudio(blob(makeOgg('opus')))).resolves.toBeDefined();
  });
});
