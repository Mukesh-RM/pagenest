import type { AudioController, AudioItem } from '@/engines/audio/types';
import type { VoiceEngine } from '@/engines/tts/types';
import { buildNarrationPlan } from '@/engines/emotion/pipeline';
import { encodeWav } from './wav-encode';
import type { NarrationSettings, SentenceTiming } from './types';

export interface NarrationSessionDeps {
  readonly engine: VoiceEngine;
  readonly audio: AudioController;
}

/** Sentence-at-a-time read-aloud with prefetch (target: first audio <1.5 s once the voice is cached). */
export class NarrationSession {
  private plan = buildNarrationPlan('');
  private timings: SentenceTiming[] = [];
  private buffers: (Blob | undefined)[] = [];
  private active = -1;
  private playing = false;
  private preparing = false;
  private abort?: AbortController;
  private bookId = '';
  private title = '';
  private settings: NarrationSettings = { engine: 'piper', voiceId: 'en_US-libritts-high', speed: 1, style: 'natural', expressive: false };

  constructor(private readonly deps: NarrationSessionDeps) {}

  getState() {
    return {
      playing: this.playing,
      preparing: this.preparing,
      activeSentence: this.active,
      plan: this.plan,
      bookId: this.bookId,
    };
  }

  configure(settings: Partial<NarrationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (settings.expressive !== undefined) {
      this.settings = {
        ...this.settings,
        style: settings.expressive ? 'expressive' : this.settings.style === 'cast' ? 'cast' : 'natural',
      };
    }
  }

  async prepare(bookId: string, title: string, chapterText: string, startSentence = 0): Promise<void> {
    this.stopInternal(false);
    this.bookId = bookId;
    this.title = title;
    this.plan = buildNarrationPlan(chapterText, this.settings.style);
    this.buffers = new Array(this.plan.length);
    this.timings = [];
    this.active = startSentence;
    this.preparing = true;
    this.abort = new AbortController();
    try {
      await this.deps.engine.prepareVoice(this.settings.voiceId, { allowDownload: true, signal: this.abort.signal });
      await this.ensureBuffer(startSentence);
      void this.prefetch(startSentence + 1);
      void this.prefetch(startSentence + 2);
    } finally {
      this.preparing = false;
    }
  }

  async playFromUserGesture(startSentence = this.active >= 0 ? this.active : 0): Promise<void> {
    if (!this.plan.length) return;
    this.playing = true;
    this.active = startSentence;
    await this.playSentence(startSentence);
  }

  pause(): void {
    this.playing = false;
    this.deps.audio.pause();
  }

  stop(): void {
    this.stopInternal(true);
  }

  private stopInternal(clearAudio: boolean): void {
    this.playing = false;
    this.abort?.abort();
    if (clearAudio) void this.deps.audio.stop();
  }

  private async playSentence(index: number): Promise<void> {
    if (!this.playing || index >= this.plan.length) {
      this.playing = false;
      return;
    }
    await this.ensureBuffer(index);
    const blob = this.buffers[index];
    if (!blob) return;
    const item = sentenceAudioItem(this.bookId, this.title, blob, index, this.plan.length);
    await this.deps.audio.load(item);
    this.deps.audio.setSpeed(this.settings.speed);
    await this.deps.audio.play();
    this.active = index;
    void this.prefetch(index + 1);
    void this.prefetch(index + 2);
    const duration = await waitForTrackEnd(this.deps.audio);
    this.timings[index] = { index, startSec: 0, endSec: duration };
    if (this.playing) await this.playSentence(index + 1);
  }

  private async ensureBuffer(index: number): Promise<void> {
    if (index < 0 || index >= this.plan.length || this.buffers[index]) return;
    const sentence = this.plan[index]!;
    const delivery = { ...sentence.delivery, rate: sentence.delivery.rate * this.settings.speed };
    const result = await this.deps.engine.synthesize({
      voiceId: this.settings.voiceId,
      text: sentence.text,
      language: 'en-US',
      delivery,
      signal: this.abort?.signal,
    });
    if (result.kind !== 'buffer') return;
    this.buffers[index] = encodeWav(result.samples, result.sampleRate);
  }

  private async prefetch(index: number): Promise<void> {
    try {
      await this.ensureBuffer(index);
    } catch {
      /* ignore prefetch errors */
    }
  }
}

function sentenceAudioItem(bookId: string, title: string, blob: Blob, index: number, total: number): AudioItem {
  return {
    bookId,
    title,
    tracks: [
      {
        index: 0,
        title: `Sentence ${index + 1} of ${total}`,
        durationSec: 0,
        startOffsetSec: 0,
        open: async () => blob,
      },
    ],
    chapters: [{ index: 0, title: 'Read aloud', startSec: 0 }],
  };
}

function waitForTrackEnd(audio: AudioController): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now();
    const unsub = audio.subscribe((state) => {
      if (state.status === 'ended' || state.status === 'idle') {
        unsub();
        resolve(Math.max(0.01, (performance.now() - start) / 1000));
      }
    });
  });
}

export function buildSentenceTimings(planLength: number, avgSec = 2.5): SentenceTiming[] {
  const out: SentenceTiming[] = [];
  for (let i = 0; i < planLength; i += 1) out.push({ index: i, startSec: i * avgSec, endSec: (i + 1) * avgSec });
  return out;
}
