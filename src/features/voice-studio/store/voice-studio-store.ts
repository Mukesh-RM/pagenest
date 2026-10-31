import { create } from 'zustand';
import type { VoiceRecord } from '@/data/schema';
import type { ConsentPhrase } from '../consent/phrases';
import type { GuidedPrompt } from '../prompts/guided-prompts';
import type { RecordedClip } from '../audio/recorder';

export type VoiceStudioStep =
  | 'list'
  | 'intro'
  | 'consent'
  | 'recording'
  | 'naming'
  | 'done';

export interface VoiceStudioState {
  step: VoiceStudioStep;
  voices: VoiceRecord[];
  consent: ConsentPhrase | undefined;
  consentClip: RecordedClip | undefined;
  consentVerified: boolean;
  promptIndex: number;
  promptClips: Record<string, RecordedClip>;
  draftName: string;
  language: string;
  micLevel: number;
  busy: boolean;
  error: string | undefined;
  setStep: (step: VoiceStudioStep) => void;
  setVoices: (voices: VoiceRecord[]) => void;
  setConsent: (phrase: ConsentPhrase | undefined) => void;
  setConsentClip: (clip: RecordedClip | undefined, verified: boolean) => void;
  setPromptIndex: (index: number) => void;
  savePromptClip: (prompt: GuidedPrompt, clip: RecordedClip) => void;
  setDraftName: (name: string) => void;
  setMicLevel: (level: number) => void;
  setBusy: (busy: boolean) => void;
  setError: (message: string | undefined) => void;
  resetRecordingSession: () => void;
}

export const useVoiceStudioStore = create<VoiceStudioState>((set) => ({
  step: 'list',
  voices: [],
  consent: undefined,
  consentClip: undefined,
  consentVerified: false,
  promptIndex: 0,
  promptClips: {},
  draftName: 'My voice',
  language: 'en',
  micLevel: 0,
  busy: false,
  error: undefined,
  setStep: (step) => set({ step, error: undefined }),
  setVoices: (voices) => set({ voices }),
  setConsent: (consent) => set({ consent }),
  setConsentClip: (consentClip, consentVerified) => set({ consentClip, consentVerified }),
  setPromptIndex: (promptIndex) => set({ promptIndex }),
  savePromptClip: (prompt, clip) =>
    set((s) => ({ promptClips: { ...s.promptClips, [prompt.id]: clip } })),
  setDraftName: (draftName) => set({ draftName }),
  setMicLevel: (micLevel) => set({ micLevel }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  resetRecordingSession: () =>
    set({
      consent: undefined,
      consentClip: undefined,
      consentVerified: false,
      promptIndex: 0,
      promptClips: {},
      draftName: 'My voice',
      micLevel: 0,
      error: undefined,
    }),
}));
