import type { DeliveryPlan } from '@/engines/tts/types';
import {
  speakToCompletion,
  type SpeechSynthesisPort,
  type UtteranceFactory,
} from '@/engines/tts/speech-synthesis-adapter';
import { createVoiceEngineError } from '@/engines/tts/voice-engine-error';
import type {
  NarrationHighlightEvent,
  NarrationHighlightListener,
  NarrationPlaybackStatus,
} from './highlight-contract';
import { segmentSentences, type SentenceSpan } from './sentence-segmenter';

const MIN_RATE = 0.5;
const MAX_RATE = 3;

export interface SpeechNarrationSessionOptions {
  readonly synth: SpeechSynthesisPort;
  readonly utteranceFactory: UtteranceFactory;
  readonly onHighlight?: NarrationHighlightListener;
  readonly onStatus?: (status: NarrationPlaybackStatus) => void;
}

export interface SpeechNarrationStartOptions {
  readonly text: string;
  readonly language: string;
  readonly voiceId: string;
  readonly rate?: number;
  /** Sentence index to start from (for seek). */
  readonly startSentenceIndex?: number;
  readonly signal?: AbortSignal;
}

/**
 * Foreground read-aloud session: sentence chunking, highlight events, speed,
 * pause/resume/stop, and seek-by-sentence. Uses the same adapter as
 * {@link SpeechSynthesisVoiceEngine} for Chrome utterance limits.
 */
export class SpeechNarrationSession {
  private readonly synth: SpeechSynthesisPort;
  private readonly utteranceFactory: UtteranceFactory;
  private readonly onHighlight: NarrationHighlightListener | undefined;
  private readonly onStatus: ((status: NarrationPlaybackStatus) => void) | undefined;

  private sentences: readonly SentenceSpan[] = [];
  private passageText = '';
  private language = 'en';
  private voiceId = '';
  private rate = 1;
  private currentIndex = -1;
  private state: NarrationPlaybackStatus['state'] = 'idle';
  private runAbort: AbortController | undefined;
  private paused = false;
  private pauseGate: (() => void) | undefined;

  constructor(options: SpeechNarrationSessionOptions) {
    this.synth = options.synth;
    this.utteranceFactory = options.utteranceFactory;
    this.onHighlight = options.onHighlight;
    this.onStatus = options.onStatus;
  }

  getStatus(): NarrationPlaybackStatus {
    return { state: this.state, sentenceIndex: this.currentIndex, rate: this.rate };
  }

  setRate(rate: number): void {
    this.rate = clampRate(rate);
    this.emitStatus();
  }

  async start(options: SpeechNarrationStartOptions): Promise<void> {
    this.stop();
    this.passageText = options.text;
    this.language = options.language;
    this.voiceId = options.voiceId;
    if (options.rate !== undefined) {
      this.rate = clampRate(options.rate);
    }
    this.sentences = segmentSentences(options.text, options.language);
    const startAt = options.startSentenceIndex ?? 0;
    if (startAt < 0 || (this.sentences.length > 0 && startAt >= this.sentences.length)) {
      throw createVoiceEngineError('failed', 'That sentence is out of range.');
    }

    this.runAbort = new AbortController();
    const signal = mergeAbort(options.signal, this.runAbort.signal);
    this.state = 'playing';
    this.emitStatus();

    try {
      for (let i = startAt; i < this.sentences.length; i += 1) {
        if (signal.aborted) {
          throw createVoiceEngineError('aborted', 'Playback was cancelled.');
        }
        await this.waitWhilePaused(signal);
        const sentence = this.sentences[i];
        if (!sentence) {
          continue;
        }
        this.currentIndex = i;
        this.emitStatus();
        this.emitHighlight({
          sentenceIndex: i,
          textStart: sentence.start,
          textEnd: sentence.end,
          granularity: 'sentence',
        });

        const delivery: DeliveryPlan = {
          rate: this.rate,
          pitch: 0,
          volume: 1,
          pauseAfterMs: 0,
        };

        await speakToCompletion(this.synth, this.utteranceFactory, {
          text: sentence.text,
          lang: this.language,
          rate: delivery.rate,
          pitch: 1,
          volume: delivery.volume,
          voiceUri: this.voiceId,
          signal,
          onBoundary: (charIndex, charLength) => {
            this.emitHighlight({
              sentenceIndex: i,
              textStart: sentence.start,
              textEnd: sentence.end,
              granularity: 'character',
              charOffsetInSentence: charIndex,
              charLength,
            });
          },
        });

        if (delivery.pauseAfterMs > 0) {
          await delay(delivery.pauseAfterMs, signal);
        }
      }
      this.state = 'stopped';
      this.currentIndex = -1;
      this.emitStatus();
    } catch (err) {
      if (isAborted(err, signal)) {
        this.state = 'stopped';
        this.emitStatus();
        throw createVoiceEngineError('aborted', 'Playback was cancelled.');
      }
      this.state = 'stopped';
      this.emitStatus();
      throw err;
    }
  }

  pause(): void {
    if (this.state !== 'playing') {
      return;
    }
    this.paused = true;
    this.synth.pause();
    this.state = 'paused';
    this.emitStatus();
  }

  resume(): void {
    if (this.state !== 'paused') {
      return;
    }
    this.paused = false;
    this.synth.resume();
    this.state = 'playing';
    this.emitStatus();
    this.releasePauseGate();
  }

  stop(): void {
    this.runAbort?.abort();
    this.runAbort = undefined;
    this.synth.cancel();
    this.paused = false;
    this.releasePauseGate();
    this.state = 'stopped';
    this.currentIndex = -1;
    this.emitStatus();
  }

  seekToSentence(index: number): void {
    if (index < 0 || index >= this.sentences.length) {
      throw createVoiceEngineError('failed', 'That sentence is out of range.');
    }
    const lang = this.language;
    const voice = this.voiceId;
    const text = this.passageText;
    const rate = this.rate;
    this.stop();
    void this.start({
      text,
      language: lang,
      voiceId: voice,
      rate,
      startSentenceIndex: index,
    });
  }

  private emitHighlight(event: NarrationHighlightEvent): void {
    this.onHighlight?.(event);
  }

  private emitStatus(): void {
    this.onStatus?.(this.getStatus());
  }

  private async waitWhilePaused(signal: AbortSignal): Promise<void> {
    while (this.paused && !signal.aborted) {
      await new Promise<void>((resolve) => {
        this.pauseGate = resolve;
      });
    }
  }

  private releasePauseGate(): void {
    this.pauseGate?.();
    this.pauseGate = undefined;
  }
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return 1;
  }
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

function mergeAbort(outer: AbortSignal | undefined, inner: AbortSignal): AbortSignal {
  if (!outer) {
    return inner;
  }
  if (outer.aborted) {
    return outer;
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  outer.addEventListener('abort', onAbort);
  inner.addEventListener('abort', onAbort);
  return controller.signal;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal.aborted) {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function isAborted(err: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) {
    return true;
  }
  return err instanceof DOMException && err.name === 'AbortError';
}
