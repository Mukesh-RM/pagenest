import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioElement } from '@/engines/audio';
import { setSetting } from '@/data/settings';
import { makeServices, renderApp, resetSettings } from './test-utils';
import type { AppServices } from './services-context';

let services: AppServices;

beforeEach(async () => {
  resetSettings();
  localStorage.clear();
  services = makeServices('audio-startup');
  await setSetting(services.db, 'onboardingDone', true);
});

afterEach(() => services.db.close());

describe('audio hardware startup', () => {
  it('does not create an audio element when the app starts on the library route', async () => {
    const callsBefore = vi.mocked(createAudioElement).mock.calls.length;
    renderApp(services, { path: '/' });
    await screen.findByRole('navigation');
    expect(vi.mocked(createAudioElement).mock.calls.length).toBe(callsBefore);
    expect(document.querySelectorAll('audio').length).toBe(0);
  });

  it('creates an audio element when the listen route loads an audiobook', async () => {
    const callsBefore = vi.mocked(createAudioElement).mock.calls.length;
    const { SEED_AUDIO_BOOK_ID, ensureSeedAudiobookBookRecord } = await import('@/features/player/seed/seed-audiobook');
    await ensureSeedAudiobookBookRecord(services.db);
    renderApp(services, { path: `/listen/${SEED_AUDIO_BOOK_ID}` });
    await waitFor(() => expect(vi.mocked(createAudioElement).mock.calls.length).toBeGreaterThan(callsBefore), {
      timeout: 10_000,
    });
  });
});
