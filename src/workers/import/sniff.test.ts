// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  concat, jpegStub, makeAac, makeCbz, makeDocx, makeEpub, makeFb2, makeFlac, makeHtml, makeLatin1Text, makeMobi, makeMp3, makeMp4Audio,
  makeOgg, makePdf, makePdfCompressed, makePng, makeRtf, makeText, makeUtf16Text, makeWav, makeZip,
} from './testing/fixtures';
import { sniffFile } from './sniff';
import type { SniffResult } from './types';

/** Names and MIME types that must make no difference: content decides. */
const NAMES = ['book.epub__1_', 'noextension', 'definitely-a.pdf', 'UPPER.TXT', 'my book (1).doc', 'ünï côdé ✓ 日本語.bin', '.hidden', 'a'.repeat(200) + '.xyz', 'x.mp3.zip'];
const MIMES = ['', 'application/octet-stream', 'application/pdf', 'text/plain', 'audio/mpeg'];

const ok = (kind: string, format: string): SniffResult => ({ ok: true, kind, format }) as SniffResult;
const bad = (reason: string): SniffResult => ({ ok: false, reason }) as SniffResult;

const png = await makePng();

const CASES: [string, () => Promise<Uint8Array> | Uint8Array, SniffResult][] = [
  ['epub', () => makeEpub({ cover: png, author: 'A' }), ok('ebook', 'epub')],
  ['epub without mimetype entry', () => makeEpub({ noMimetype: true }), ok('ebook', 'epub')],
  ['epub with font obfuscation only', () => makeEpub({ fontObfuscation: true }), ok('ebook', 'epub')],
  ['pdf', () => makePdf(), ok('pdf', 'pdf')],
  ['compressed pdf', () => makePdfCompressed(), ok('pdf', 'pdf')],
  ['pdf with junk before the header', () => concat(new Array(300).fill(0x20), makePdf()), ok('pdf', 'pdf')],
  ['docx', () => makeDocx(), ok('doc', 'docx')],
  ['cbz', () => makeCbz({ pages: 5 }), ok('ebook', 'cbz')],
  ['mobi', () => makeMobi({ cover: png }), ok('ebook', 'mobi')],
  ['azw3', () => makeMobi({ version: 8 }), ok('ebook', 'azw3')],
  ['fb2 utf-8', () => makeFb2(), ok('ebook', 'fb2')],
  ['fb2 declared windows-1251', () => makeFb2({ encoding: 'windows-1251' }), ok('ebook', 'fb2')],
  ['rtf', () => makeRtf(), ok('doc', 'rtf')],
  ['html', () => makeHtml(), ok('doc', 'html')],
  ['txt utf-8', () => makeText(), ok('doc', 'txt')],
  ['txt utf-16 with byte order mark', () => makeUtf16Text(), ok('doc', 'txt')],
  ['txt legacy 8-bit', () => makeLatin1Text(), ok('doc', 'txt')],
  ['mp3 with ID3', () => makeMp3({ title: 'T' }), ok('audio', 'mp3')],
  ['mp3 with ID3 padding', () => makeMp3({ title: 'T', leadingPadding: 500 }), ok('audio', 'mp3')],
  ['mp3 raw frames', () => makeMp3({ id3: false }), ok('audio', 'mp3')],
  ['aac adts', () => makeAac(), ok('audio', 'aac')],
  ['m4a', () => makeMp4Audio({ brand: 'M4A ' }), ok('audio', 'm4a')],
  ['m4b brand', () => makeMp4Audio({ brand: 'M4B ' }), ok('audio', 'm4b')],
  ['m4b by chapters', () => makeMp4Audio({ brand: 'isom', chapters: [['One', 0], ['Two', 5]] }), ok('audio', 'm4b')],
  ['ogg vorbis', () => makeOgg('vorbis'), ok('audio', 'ogg')],
  ['opus', () => makeOgg('opus'), ok('audio', 'opus')],
  ['flac', () => makeFlac(), ok('audio', 'flac')],
  ['wav', () => makeWav(), ok('audio', 'wav')],
];

describe('content sniffing ignores names and MIME types', () => {
  for (const [label, build, expected] of CASES) {
    describe(label, () => {
      it('is recognised from its bytes alone', async () => {
        expect(await sniffFile(new Blob([(await build()) as BlobPart]))).toEqual(expected);
      });
      for (const name of NAMES) {
        it(`as "${name.length > 40 ? `${name.slice(0, 20)}…` : name}" with each browser type`, async () => {
          const bytes = await build();
          for (const type of MIMES) {
            expect(await sniffFile(new File([bytes as BlobPart], name, { type }))).toEqual(expected);
          }
        });
      }
    });
  }
});

describe('files that are really something else', () => {
  it('rejects empty files', async () => {
    expect(await sniffFile(new Blob([]))).toEqual(bad('empty'));
  });
  it('flags DRM: Adobe EPUB, protected M4P, Audible-style sample entry, encrypted MOBI, Topaz', async () => {
    expect(await sniffFile(new Blob([(await makeEpub({ drm: true })) as BlobPart]))).toEqual(bad('drm'));
    expect(await sniffFile(new Blob([makeMp4Audio({ brand: 'M4P ' }) as BlobPart]))).toEqual(bad('drm'));
    expect(await sniffFile(new Blob([makeMp4Audio({ drm: true }) as BlobPart]))).toEqual(bad('drm'));
    expect(await sniffFile(new Blob([makeMobi({ encryption: 2 }) as BlobPart]))).toEqual(bad('drm'));
    expect(await sniffFile(new Blob([concat(Array.from('TPZ0', (c) => c.charCodeAt(0)), new Array(100).fill(1))]))).toEqual(bad('drm'));
  });
  it('rejects pictures, video, archives and random bytes with the generic reason', async () => {
    expect(await sniffFile(new Blob([png as BlobPart]))).toEqual(bad('unsupported-type'));
    expect(await sniffFile(new Blob([jpegStub() as BlobPart]))).toEqual(bad('unsupported-type'));
    expect(await sniffFile(new Blob([makeMp4Audio({ video: true }) as BlobPart]))).toEqual(bad('unsupported-type'));
    expect(await sniffFile(new Blob([Uint8Array.from({ length: 5000 }, (_, i) => (i * 37 + 11) % 256) as BlobPart]))).toEqual(bad('unsupported-type'));
    expect(await sniffFile(new Blob([concat(Array.from('<?xml version="1.0"?><svg/>', (c) => c.charCodeAt(0)))]))).toEqual(bad('unsupported-type'));
  });
  it('tells a ZIP with no book from a zipped FB2 and from a damaged ZIP', async () => {
    expect(await sniffFile(new Blob([(await makeZip([{ name: 'notes.txt', data: 'hello' }, { name: 'data.bin', data: new Uint8Array(10) }])) as BlobPart]))).toEqual(bad('zip-not-book'));
    expect(await sniffFile(new Blob([(await makeZip([{ name: 'story.fb2', data: makeFb2(), deflate: true }])) as BlobPart]))).toEqual(bad('zipped-fb2'));
    const zip = await makeEpub();
    expect(await sniffFile(new Blob([zip.slice(0, zip.length - 40) as BlobPart]))).toEqual(bad('damaged'));
  });
  it('does not call a ZIP with a few pictures among many other files a comic', async () => {
    const files = [{ name: 'a.png', data: png }, ...Array.from({ length: 5 }, (_, i) => ({ name: `doc${i}.txt`, data: 'x' }))];
    expect(await sniffFile(new Blob([(await makeZip(files)) as BlobPart]))).toEqual(bad('zip-not-book'));
  });
  it('rejects an MP4 whose movie data is missing', async () => {
    const mp4 = makeMp4Audio();
    expect(await sniffFile(new Blob([mp4.slice(0, 40) as BlobPart]))).toEqual(bad('damaged'));
  });
  it('reads only a small part of a large file', async () => {
    const big = new Blob([makeMp3({ title: 'x' }) as BlobPart, new Uint8Array(30 * 1024 * 1024)]);
    let read = 0;
    const spy = new Proxy(big, {
      get(target, prop) {
        if (prop === 'slice') {
          return (a?: number, b?: number) => {
            read += (b ?? target.size) - (a ?? 0);
            return target.slice(a, b);
          };
        }
        const v = Reflect.get(target, prop, target) as unknown;
        return typeof v === 'function' ? (v as (...x: unknown[]) => unknown).bind(target) : v;
      },
    });
    expect(await sniffFile(spy)).toEqual(ok('audio', 'mp3'));
    expect(read).toBeLessThan(256 * 1024);
  });
});
