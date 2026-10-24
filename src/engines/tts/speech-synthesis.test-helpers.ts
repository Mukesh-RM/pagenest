import type {
  SpeechSynthesisPort,
  SpeechSynthesisUtteranceLike,
  SpeechSynthesisVoiceLike,
  UtteranceFactory,
} from './speech-synthesis-adapter';

export class FakeUtterance implements SpeechSynthesisUtteranceLike {
  text = '';
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoiceLike | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onboundary: ((event: { name: string; charIndex: number; charLength: number }) => void) | null =
    null;
}

export class FakeSpeechSynthesis implements SpeechSynthesisPort {
  paused = false;
  pending = false;
  speaking = false;
  readonly spoken: SpeechSynthesisUtteranceLike[] = [];
  private readonly voices: SpeechSynthesisVoiceLike[];

  constructor(voices: SpeechSynthesisVoiceLike[] = [defaultVoice()]) {
    this.voices = voices;
  }

  speak(utterance: SpeechSynthesisUtteranceLike): void {
    this.spoken.push(utterance);
    this.speaking = true;
    utterance.onstart?.();
    utterance.onboundary?.({ name: 'word', charIndex: 0, charLength: Math.min(4, utterance.text.length) });
    utterance.onend?.();
    this.speaking = false;
  }

  cancel(): void {
    this.speaking = false;
    this.pending = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  getVoices(): SpeechSynthesisVoiceLike[] {
    return this.voices;
  }
}

export function defaultVoice(): SpeechSynthesisVoiceLike {
  return {
    name: 'Test English',
    lang: 'en-US',
    voiceURI: 'test-en-us',
    localService: true,
    default: true,
  };
}

export function fakeUtteranceFactory(): UtteranceFactory {
  return { create: () => new FakeUtterance() };
}
