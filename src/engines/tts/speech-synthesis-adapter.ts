/**
 * Testable wrapper around `window.speechSynthesis` with Chrome’s ~15 s utterance
 * limit handled by sub-chunking long sentences.
 */

/** Conservative UTF-16 length per utterance (Chrome drops longer clips). */
export const CHROME_UTTERANCE_CHAR_LIMIT = 180;

export interface SpeakChunkOptions {
  readonly text: string;
  readonly lang: string;
  readonly rate: number;
  readonly pitch: number;
  readonly volume: number;
  readonly voiceUri?: string;
  readonly signal?: AbortSignal;
  readonly onBoundary?: (charIndex: number, charLength: number) => void;
}

export interface SpeechSynthesisVoiceLike {
  readonly name: string;
  readonly lang: string;
  readonly voiceURI: string;
  readonly localService: boolean;
  readonly default: boolean;
}

export interface SpeechSynthesisUtteranceLike {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: SpeechSynthesisVoiceLike | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onboundary: ((event: { name: string; charIndex: number; charLength: number }) => void) | null;
}

export interface SpeechSynthesisPort {
  speak(utterance: SpeechSynthesisUtteranceLike): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  getVoices(): SpeechSynthesisVoiceLike[];
  readonly paused: boolean;
  readonly pending: boolean;
  readonly speaking: boolean;
}

export interface UtteranceFactory {
  create(): SpeechSynthesisUtteranceLike;
}

export function defaultUtteranceFactory(): UtteranceFactory {
  return {
    create(): SpeechSynthesisUtteranceLike {
      const u = new SpeechSynthesisUtterance();
      return u as SpeechSynthesisUtteranceLike;
    },
  };
}

export function getBrowserSpeechSynthesis(): SpeechSynthesisPort | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return undefined;
  }
  return window.speechSynthesis as SpeechSynthesisPort;
}

/** Split `text` into chunks safe for `speechSynthesis.speak` on Chrome. */
export function chunkForUtteranceLimit(text: string, maxChars = CHROME_UTTERANCE_CHAR_LIMIT): string[] {
  if (text.length <= maxChars) {
    return [text];
  }
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    let splitAt = rest.lastIndexOf(' ', maxChars);
    if (splitAt < maxChars * 0.4) {
      splitAt = maxChars;
    }
    chunks.push(rest.slice(0, splitAt).trimEnd());
    rest = rest.slice(splitAt).trimStart();
  }
  if (rest.length > 0) {
    chunks.push(rest);
  }
  return chunks.filter((c) => c.length > 0);
}

/**
 * Speak `options.text` to completion, honouring abort and mapping boundary events
 * to offsets within the full string (across sub-chunks).
 */
export function speakToCompletion(
  synth: SpeechSynthesisPort,
  factory: UtteranceFactory,
  options: SpeakChunkOptions,
): Promise<void> {
  const chunks = chunkForUtteranceLimit(options.text);
  let chunkBase = 0;

  const abortHandler = () => {
    synth.cancel();
  };
  options.signal?.addEventListener('abort', abortHandler);

  const runChunk = (chunkIndex: number): Promise<void> => {
    if (options.signal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }
    if (chunkIndex >= chunks.length) {
      return Promise.resolve();
    }
    const chunkText = chunks[chunkIndex] ?? '';
    const utterance = factory.create();
    utterance.text = chunkText;
    utterance.lang = options.lang;
    utterance.rate = options.rate;
    utterance.pitch = options.pitch;
    utterance.volume = options.volume;
    if (options.voiceUri) {
      const voice = synth.getVoices().find((v) => v.voiceURI === options.voiceUri);
      utterance.voice = voice ?? null;
    }

    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.name === 'sentence') {
        options.onBoundary?.(chunkBase + event.charIndex, event.charLength);
      }
    };

    return new Promise<void>((resolve, reject) => {
      utterance.onend = () => {
        chunkBase += chunkText.length;
        void runChunk(chunkIndex + 1).then(resolve, reject);
      };
      utterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        reject(new Error(`Speech synthesis failed: ${event.error}`));
      };
      synth.speak(utterance);
    });
  };

  return runChunk(0).finally(() => {
    options.signal?.removeEventListener('abort', abortHandler);
  });
}
