import type { AudioChapter } from '../types';

/**
 * Parse a CUE sheet into chapter markers (book time in seconds).
 * Supports FILE ... MP3 and INDEX 01 mm:ss:ff (75 frames per second).
 */
export function parseCueSheet(text: string): AudioChapter[] {
  const lines = text.split(/\r?\n/);
  const chapters: AudioChapter[] = [];
  let fileOffsetSec = 0;
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line || line.startsWith('REM')) continue;

    const trackMatch = /^TRACK\s+(\d+)\s+AUDIO/i.exec(line);
    if (trackMatch) {
      const titleLine = lines.slice(i + 1).find((l) => /^\s*TITLE\s+/i.test(l));
      const title = titleLine ? titleLine.replace(/^\s*TITLE\s+/i, '').replace(/^"|"$/g, '') : `Track ${trackMatch[1]}`;
      let startSec = fileOffsetSec;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (!nextLine) continue;
        const idx = /^INDEX\s+01\s+(\d+):(\d+):(\d+)/i.exec(nextLine.trim());
        if (idx) {
          const mm = Number(idx[1] ?? 0);
          const ss = Number(idx[2] ?? 0);
          const ff = Number(idx[3] ?? 0);
          startSec = fileOffsetSec + mm * 60 + ss + ff / 75;
          break;
        }
        if (/^TRACK\s+/i.test(nextLine)) break;
      }
      chapters.push({ index, title, startSec });
      index += 1;
      continue;
    }

    const fileMatch = /^FILE\s+/i.exec(line);
    if (fileMatch) {
      fileOffsetSec = 0;
    }
  }

  return chapters.sort((a, b) => a.startSec - b.startSec).map((c, i) => ({ ...c, index: i }));
}
