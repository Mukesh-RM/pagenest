import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  isOwnVoicePlaybackEnabled,
  isPhoneVoiceCloneEnabled,
  isVoiceCloneDevPreviewEnabled,
} from './clone-shipping';

describe('clone shipping gates', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('dev preview is off in production build env by default', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_PN_VOICE_CLONE_PREVIEW', '');
    vi.stubEnv('VITE_PN_PHONE_VOICE_CLONE', '');
    expect(isVoiceCloneDevPreviewEnabled()).toBe(false);
    expect(isPhoneVoiceCloneEnabled()).toBe(false);
    expect(isOwnVoicePlaybackEnabled()).toBe(false);
  });

  it('phone clone flag enables own-voice playback without dev preview', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_PN_PHONE_VOICE_CLONE', '1');
    expect(isPhoneVoiceCloneEnabled()).toBe(true);
    expect(isOwnVoicePlaybackEnabled()).toBe(true);
    expect(isVoiceCloneDevPreviewEnabled()).toBe(false);
  });
});
