import type { BookRecord, ChapterRecord, TrackRecord } from '@/data/schema';

/**
 * Supplies the audio player with what it plays. `loadAudioItem(source, bookId)` reads an imported
 * audiobook (the `books`, `tracks` and `chapters` rows and its files in OPFS) and returns the
 * player's `AudioItem` (src/engines/audio/types.ts): tracks that open their file from OPFS on demand,
 * chapters over the whole book, the total length, title, author, narrator and cover.
 *
 * The shapes below are written out here (not imported) so the Library does not depend on the audio
 * engine's files; they are structurally identical to `AudioItem`, `AudioTrack` and `AudioChapter`
 * and are assignable to them, so `controller.load(await loadAudioItem(...))` type-checks.
 */
export interface LibraryAudioTrack {
  readonly index: number;
  /** Reads the file from OPFS. Lazy: nothing is read until the player asks for the track. */
  readonly open: () => Promise<Blob>;
  readonly title: string;
  readonly durationSec: number;
  /** Seconds from the start of the book to the start of this track. */
  readonly startOffsetSec: number;
}

export interface LibraryAudioChapter {
  readonly index: number;
  readonly title: string;
  readonly startSec: number;
}

export interface LibraryAudioItem {
  readonly bookId: string;
  readonly title: string;
  readonly author?: string;
  readonly narrator?: string;
  readonly cover?: Blob;
  readonly tracks: readonly LibraryAudioTrack[];
  readonly chapters: readonly LibraryAudioChapter[];
}

/** The part of the data service (`AppServices.data`, or a `BookRepository` plus a file store) this needs. */
export interface AudioItemSource {
  readonly books: {
    get(id: string): Promise<BookRecord | undefined>;
    getTracks(bookId: string): Promise<TrackRecord[]>;
    getChapters(bookId: string): Promise<ChapterRecord[]>;
    getCover(bookId: string): Promise<Blob | undefined>;
  };
  /** The file as a lazy `File` (OPFS). */
  openFile(path: string): Promise<Blob>;
}

export type AudioItemErrorCode = 'not-found' | 'not-audio' | 'no-files' | 'file-missing';

/** Why a book cannot be played. `message` is written for the person listening. */
export class AudioItemError extends Error {
  constructor(
    readonly code: AudioItemErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AudioItemError';
  }
}

export interface LoadAudioItemOptions {
  /**
   * Length of a file whose length was not stored (some MP3s carry no length), read from its
   * header. The default asks a media element, which is only available in a browser.
   */
  probeDuration?: (blob: Blob) => Promise<number | undefined>;
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  mp3: 'audio/mpeg',
  m4b: 'audio/mp4',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  wav: 'audio/wav',
};

/** Where the file's real type shows: the OPFS name was made from the sniffed format, never from the original name. */
function mimeFor(fileRef: string, format: string): string | undefined {
  const ext = /\.([a-z0-9]+)$/i.exec(fileRef)?.[1]?.toLowerCase();
  return MIME_BY_EXTENSION[ext ?? ''] ?? MIME_BY_EXTENSION[format];
}

/** Evenly spaced markers for a book with none (blueprint 8.2), same as the audio engine's own. */
function evenChapters(durationSec: number, count = 8): LibraryAudioChapter[] {
  if (!(durationSec > 0)) return [];
  const step = durationSec / count;
  return Array.from({ length: count }, (_, i) => ({ index: i, title: `Part ${i + 1}`, startSec: i * step }));
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** The browser's own reading of a file's length. */
export function probeDurationWithMediaElement(blob: Blob, timeoutMs = 8000): Promise<number | undefined> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(blob);
    let done = false;
    const finish = (value: number | undefined): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(finite(audio.duration) && audio.duration > 0 ? audio.duration : undefined);
    audio.onerror = () => finish(undefined);
    audio.src = url;
  });
}

interface TrackSource {
  readonly index: number;
  readonly fileRef: string;
  readonly title: string;
  readonly durationSec: number;
}

/**
 * Build the player's item for an imported audiobook. Handles a single file (M4B, MP3, any other
 * audio format, however the file was named) and a book made of many files.
 * @throws AudioItemError when the book is missing, is not an audiobook, or has no audio file.
 */
export async function loadAudioItem(source: AudioItemSource, bookId: string, options: LoadAudioItemOptions = {}): Promise<LibraryAudioItem> {
  const book = await source.books.get(bookId);
  if (!book) throw new AudioItemError('not-found', 'This audiobook is no longer in your library.');
  if (book.kind !== 'audio') throw new AudioItemError('not-audio', 'This item is not an audiobook.');

  const [trackRows, chapterRows, cover] = await Promise.all([
    source.books.getTracks(bookId),
    source.books.getChapters(bookId),
    source.books.getCover(bookId).catch(() => undefined),
  ]);

  let sources: TrackSource[] = [...trackRows]
    .sort((a, b) => a.index - b.index)
    .map((t) => ({ index: t.index, fileRef: t.fileRef, title: t.title, durationSec: finite(t.durationSec) && t.durationSec > 0 ? t.durationSec : 0 }));
  if (sources.length === 0 && book.fileRef) {
    sources = [{ index: 0, fileRef: book.fileRef, title: book.title, durationSec: 0 }];
  }
  if (sources.length === 0) throw new AudioItemError('no-files', 'This audiobook has no audio file on this device.');
  // One file: the book's length is the file's length.
  if (sources.length === 1 && sources[0] && sources[0].durationSec === 0 && finite(book.durationSec) && book.durationSec > 0) {
    sources[0] = { ...sources[0], durationSec: book.durationSec };
  }

  const open = (fileRef: string): (() => Promise<Blob>) => async () => {
    let file: Blob;
    try {
      file = await source.openFile(fileRef);
    } catch {
      throw new AudioItemError('file-missing', 'The audio file is missing from this device. Remove the book and add it again.');
    }
    // Hand the player the file with its true type: the OPFS name says what the bytes are, the browser's guess from a name may not.
    const mime = mimeFor(fileRef, book.format);
    return mime && file.type !== mime ? file.slice(0, file.size, mime) : file;
  };

  const probe = options.probeDuration ?? probeDurationWithMediaElement;
  const durations: number[] = [];
  for (const s of sources) {
    if (s.durationSec > 0) {
      durations.push(s.durationSec);
      continue;
    }
    let seconds: number | undefined;
    try {
      seconds = await probe(await open(s.fileRef)());
    } catch {
      seconds = undefined;
    }
    durations.push(finite(seconds) && seconds > 0 ? seconds : 0);
  }

  let offset = 0;
  const tracks: LibraryAudioTrack[] = sources.map((s, i) => {
    const durationSec = durations[i] ?? 0;
    const track: LibraryAudioTrack = { index: i, open: open(s.fileRef), title: s.title, durationSec, startOffsetSec: offset };
    offset += durationSec;
    return track;
  });
  const totalSec = offset;

  const chapters = resolveChapters(chapterRows, sources, tracks, totalSec);

  return {
    bookId: book.id,
    title: book.title,
    ...(book.author ? { author: book.author } : {}),
    ...(book.narrator ? { narrator: book.narrator } : {}),
    ...(cover ? { cover } : {}),
    tracks,
    chapters,
  };
}

/** Chapters over the whole book, from `startSec`, from a `{trackIndex, positionSec}` locator, one per file, or evenly spaced. */
function resolveChapters(rows: readonly ChapterRecord[], sources: readonly TrackSource[], tracks: readonly LibraryAudioTrack[], totalSec: number): LibraryAudioChapter[] {
  const startOf = (row: ChapterRecord): number | undefined => {
    if (finite(row.startSec)) return row.startSec;
    const loc = row.locator;
    if (loc && loc.kind === 'audio') {
      const at = sources.findIndex((s) => s.index === loc.trackIndex);
      const track = tracks[at];
      if (track) return track.startOffsetSec + (finite(loc.positionSec) ? loc.positionSec : 0);
    }
    return undefined;
  };
  const resolved: { title: string; startSec: number }[] = [];
  for (const row of [...rows].sort((a, b) => a.index - b.index)) {
    const startSec = startOf(row);
    if (startSec === undefined) continue;
    resolved.push({ title: row.title, startSec: Math.max(0, totalSec > 0 ? Math.min(startSec, totalSec) : startSec) });
  }
  if (resolved.length > 0) {
    // The player finds the chapter at a time by order, so they must be in time order.
    resolved.sort((a, b) => a.startSec - b.startSec);
    return resolved.map((c, index) => ({ index, title: c.title, startSec: c.startSec }));
  }
  if (tracks.length > 1) return tracks.map((t, i) => ({ index: i, title: t.title, startSec: t.startOffsetSec }));
  return evenChapters(totalSec);
}
