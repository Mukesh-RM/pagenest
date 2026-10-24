import { parseBlob } from 'music-metadata';
import { cleanLanguage, cleanText, type ParsedMeta } from '../types';

/**
 * Tags, duration, chapters and cover of an audio file, using music-metadata (MIT). Lives in its own
 * worker (`audio-metadata.worker.ts`) because the library is large. Reads through `Blob.slice`.
 */
export async function parseAudio(file: Blob): Promise<ParsedMeta> {
  // Read what the file is from its bytes. A File carries the type the browser guessed from its name (an M4B
  // called talk.mp3 arrives as audio/mpeg) and music-metadata would trust it and read the file as MP3.
  const untyped = file.type === '' ? file : file.slice(0, file.size, '');
  const meta = await parseBlob(untyped, { duration: false, skipCovers: false, includeChapters: true });
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
      startSec: Math.max(0, (c.start ?? 0) / 1000),
    }));
  }
  const picture = common.picture?.[0];
  if (picture && picture.data.length > 0) out.cover = { bytes: new Uint8Array(picture.data) };
  // The per-file title (not the album) is what a track is called in a folder-of-files book.
  const trackTitle = cleanText(common.title);
  if (trackTitle) out.trackTitle = trackTitle;
  return out;
}
