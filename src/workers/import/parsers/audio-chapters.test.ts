// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMp4Audio } from '../testing/fixtures';

// music-metadata reports an MP4 chapter's start as `start / timeScale` seconds. v12 passes the time scale (100 ns units for
// QuickTime and chpl chapters); older builds gave milliseconds and no time scale. Both must come out as seconds.
const parseBlob = vi.fn();
vi.mock('music-metadata', () => ({ parseBlob: (...args: unknown[]) => parseBlob(...args) }));

const { parseAudio } = await import('./audio');

const asMeta = (chapters: { title: string; start: number; timeScale?: number }[]) => ({ common: {}, format: { chapters } });

beforeEach(() => parseBlob.mockReset());

describe('chapter start times from music-metadata', () => {
  it('reads v12 chapters (100 ns units) as seconds', async () => {
    parseBlob.mockResolvedValue(asMeta([{ title: 'A', start: 0, timeScale: 10_000_000 }, { title: 'B', start: 305_000_000, timeScale: 10_000_000 }]));
    expect((await parseAudio(new Blob([]))).chapters).toEqual([{ title: 'A', startSec: 0 }, { title: 'B', startSec: 30.5 }]);
  });
  it('reads a v12 chapter that starts within the first tenth of a second, which looks like milliseconds by size alone', async () => {
    parseBlob.mockResolvedValue(asMeta([{ title: 'Cold open', start: 500_000, timeScale: 10_000_000 }]));
    expect((await parseAudio(new Blob([]))).chapters).toEqual([{ title: 'Cold open', startSec: 0.05 }]);
  });
  it('reads a chapter an hour and a half in', async () => {
    parseBlob.mockResolvedValue(asMeta([{ title: 'Late', start: 54_000_000_000, timeScale: 10_000_000 }]));
    expect((await parseAudio(new Blob([]))).chapters?.[0]?.startSec).toBe(5400);
  });
  it('reads older music-metadata chapters (milliseconds, no time scale), even long after 16 minutes', async () => {
    parseBlob.mockResolvedValue(asMeta([{ title: 'Mid', start: 30_500 }, { title: 'Late', start: 3_600_000 }]));
    expect((await parseAudio(new Blob([]))).chapters).toEqual([{ title: 'Mid', startSec: 30.5 }, { title: 'Late', startSec: 3600 }]);
  });
  it('never gives a negative or unreadable start', async () => {
    parseBlob.mockResolvedValue(asMeta([{ title: 'x', start: -5, timeScale: 1000 }, { title: 'y', start: Number.NaN }]));
    expect((await parseAudio(new Blob([]))).chapters?.map((c) => c.startSec)).toEqual([0, 0]);
  });
});

describe('both fixes together: bytes decide the format, and chapters come out in seconds', () => {
  it('passes the file to music-metadata without the type the browser guessed from its name', async () => {
    parseBlob.mockResolvedValue(asMeta([]));
    await parseAudio(new File([makeMp4Audio({ brand: 'M4B ' }) as BlobPart], 'talk.mp3', { type: 'audio/mpeg' }));
    expect((parseBlob.mock.calls[0]?.[0] as Blob).type).toBe('');
  });
});
