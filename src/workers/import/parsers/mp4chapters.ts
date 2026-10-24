import { decodeText, readRange, u64be } from '../bytes';
import { childBoxes, locateMoov } from '../sniff';
import { cleanText, type ParsedChapter } from '../types';

/**
 * Chapters from the Nero `chpl` atom, which most M4B tools (ffmpeg, mp4v2, Audiobook Binder)
 * write. music-metadata only reads QuickTime chapter tracks, so this fills the gap.
 */
export async function parseMp4Chapters(file: Blob): Promise<ParsedChapter[]> {
  const moov = await locateMoov(file);
  if (!moov) return [];
  const b = await readRange(file, moov.start, moov.size);
  const udta = childBoxes(b, moov.headerSize, b.length).find((x) => x.type === 'udta');
  const chpl = udta ? childBoxes(b, udta.start + udta.headerSize, udta.start + udta.size).find((x) => x.type === 'chpl') : undefined;
  if (!chpl) return [];
  const end = chpl.start + chpl.size;
  let at = chpl.start + chpl.headerSize;
  const version = b[at] ?? 0;
  at += 4;
  if (version === 1) at += 4;
  const count = b[at] ?? 0;
  at += 1;
  const out: ParsedChapter[] = [];
  for (let i = 0; i < count && at + 9 <= end; i += 1) {
    const start = u64be(b, at) / 10_000_000;
    const length = b[at + 8] ?? 0;
    const title = cleanText(decodeText(b.subarray(at + 9, at + 9 + length)));
    out.push({ title: title ?? `Chapter ${i + 1}`, startSec: start });
    at += 9 + length;
  }
  return out.sort((a, c) => a.startSec - c.startSec);
}
