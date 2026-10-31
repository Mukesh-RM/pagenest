/// <reference lib="webworker" />
import { parseBuffer } from 'music-metadata';
import { chaptersFromId3 } from './chapters/id3';
import { chaptersFromMp4Box } from './chapters/m4b';
import type { MetadataRequest, MetadataResponse } from './metadata-types';

async function chaptersFromMusicMetadata(buffer: ArrayBuffer): Promise<{ chapters: MetadataResponse['chapters']; durationSec?: number }> {
  const meta = await parseBuffer(new Uint8Array(buffer), undefined, { duration: true });
  const durationSec = meta.format.duration ?? undefined;
  let chapters = chaptersFromId3(meta.format.chapters);
  if (!chapters.length && durationSec && durationSec > 0) {
    chapters = [{ index: 0, title: 'Full book', startSec: 0 }];
  }
  return { chapters, durationSec };
}

async function chaptersFromMp4(buffer: ArrayBuffer): Promise<{ chapters: MetadataResponse['chapters']; durationSec?: number }> {
  const { createFile, MP4BoxBuffer } = await import('mp4box');
  return await new Promise((resolve, reject) => {
    const file = createFile();
    file.onReady = (info) => {
      const durationSec = info.duration ? info.duration / info.timescale : undefined;
      const raw: { start: number; end: number; title?: string }[] = [];
      if (info.videoTracks?.length === 0 && info.audioTracks?.length) {
        for (const nt of info.tracks) {
          if (nt.nb_samples && nt.movie_duration) {
            const start = (nt.movie_duration - nt.duration) / nt.timescale;
            raw.push({ start: Math.max(0, start), end: nt.movie_duration / nt.timescale });
          }
        }
      }
      const chapters = chaptersFromMp4Box(raw);
      resolve({
        chapters: chapters.length ? chapters : durationSec ? [{ index: 0, title: 'Full book', startSec: 0 }] : [],
        durationSec,
      });
    };
    file.onError = (e: string) => reject(new Error(e));
    file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(buffer.slice(0), 0));
    file.flush();
  });
}

self.onmessage = (event: MessageEvent<MetadataRequest>) => {
  const { id, kind, buffer } = event.data;
  void (async () => {
    try {
      const fromMeta = await chaptersFromMusicMetadata(buffer);
      if (kind === 'm4b' && fromMeta.chapters.length <= 1) {
        try {
          const fromMp4 = await chaptersFromMp4(buffer);
          const payload: MetadataResponse = {
            id,
            chapters: fromMp4.chapters.length > fromMeta.chapters.length ? fromMp4.chapters : fromMeta.chapters,
            durationSec: fromMp4.durationSec ?? fromMeta.durationSec,
          };
          self.postMessage(payload);
          return;
        } catch {
          // Fall back to music-metadata only.
        }
      }
      self.postMessage({ id, chapters: fromMeta.chapters, durationSec: fromMeta.durationSec } satisfies MetadataResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ id, chapters: [], error: message } satisfies MetadataResponse);
    }
  })();
};
