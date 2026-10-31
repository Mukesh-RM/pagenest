/**
 * Playwright harness: mock microphone + consent recognizer so recording works headlessly.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/ui/theme/ThemeProvider';
import { getDb } from '@/data/db';
import { MemoryFileStore } from '@/data/opfs';
import { VoiceStudioApp } from '../VoiceStudioApp';
import { useVoiceStudioStore } from '../store/voice-studio-store';
import { consentPhraseMatches } from '../consent/verify';
import { createE2eTestRecorder } from './test-recorder';
import '@/app/theme.css';
import '@/ui';

const db = getDb();
const files = new MemoryFileStore();

class MockConsentRecognizer {
  start(expectedPhrase: string) {
    return Promise.resolve({ transcript: expectedPhrase, matched: consentPhraseMatches(expectedPhrase, expectedPhrase) });
  }
}

function installMockMic() {
  const stream = {
    getTracks: () => [{ stop: () => undefined }],
    getAudioTracks: () => [{ stop: () => undefined }],
  } as unknown as MediaStream;

  navigator.mediaDevices.getUserMedia = async () => stream;
  navigator.permissions.query = (async () =>
    ({ state: 'granted', onchange: null }) as PermissionStatus) as typeof navigator.permissions.query;

  // Stub AudioContext so ScriptProcessor path does not require real audio hardware.
  class MockAudioContext {
    sampleRate = 48_000;
    destination = {};
    createMediaStreamSource() {
      return { connect: () => undefined };
    }
    createScriptProcessor() {
      const node = {
        onaudioprocess: null as ((ev: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null,
        connect: () => undefined,
      };
      let ticks = 0;
      const pump = () => {
        if (ticks++ > 8) return;
        node.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(128).fill(0.02) } });
        queueMicrotask(pump);
      };
      queueMicrotask(pump);
      return node;
    }
    async close() {
      return undefined;
    }
  }
  // @ts-expect-error test shim
  window.AudioContext = MockAudioContext;
}

void db.open();

installMockMic();

useVoiceStudioStore.setState({ draftName: 'Studio e2e' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider mode="light">
      <VoiceStudioApp
        services={{
          db,
          files,
          consentRecognizer: new MockConsentRecognizer(),
          testRecorder: createE2eTestRecorder(),
        }}
      />
    </ThemeProvider>
  </StrictMode>,
);
