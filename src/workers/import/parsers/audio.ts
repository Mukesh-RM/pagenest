import { parseBlob } from 'music-metadata';
import { cleanLanguage, cleanText, type ParsedMeta } from '../types';

function chapterStartSec(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= 1_000_000) return raw / 10_000_000;
  return raw / 1000;
}

/**
 * Tags, duration, chapters and cover of an audio file, using music-metadata (MIT). Lives in its own
 * worker (`audio-metadata.worker.ts`) because the library is large. Reads through `Blob.slice`.
 */
export async function parseAudio(file: Blob): Promise<ParsedMeta> {
  const meta = await parseBlob(file, { duration: false, skipCovers: false, includeChapters: true });
  const { common, format } = meta;
  const out: ParsedMeta = {};
  const title = cleanText(common.album) ?? cleanText(common.title);
  if (title) out.title = title;
  const author = cleanText(common.albumartist) ?? cleanText(common.artist) ?? cleanText(common.artists?.[0]);
  if (author) out.author = author;
  const narrator = cleanText(common.composer?.[0]);
  if (narrator && narrator !== author) out.narrator = narrator;
  const series = cleanText(common.movement) ?? cleanText(common.grouping);
  if (series) out.series = series;
  const language = cleanLanguage(common.language);
  if (language) out.language = language;
  if (typeof format.duration === 'number' && Number.isFinite(format.duration) && format.duration > 0) out.durationSec = Math.round(format.duration * 1000) / 1000;
  if (format.chapters && format.chapters.length > 0) {
    // Only QuickTime chapter tracks arrive here; `chpl` chapters are read by parseMp4Chapters.
    out.chapters = format.chapters.map((c, i) => ({
      title: cleanText(c.title) ?? `Chapter ${i + 1}`,
      // music-metadata v12+ uses 100 ns units for MP4 chapter tracks; older builds used ms.
      startSec: Math.max(0, chapterStartSec(c.start ?? 0)),
    }));
  }
  const picture = common.picture?.[0];
  if (picture && picture.data.length > 0) out.cover = { bytes: new Uint8Array(picture.data) };
  // The per-file title (not the album) is what a track is called in a folder-of-files book.
  const trackTitle = cleanText(common.title);
  if (trackTitle) out.trackTitle = trackTitle;
  return out;
}
