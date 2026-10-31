import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/ui';
import { NarrationControls } from '../NarrationControls';
import { NarrationSheet } from '../NarrationSheet';
import { DEFAULT_NARRATION_SETTINGS } from '../types';
import type { VoiceInfo } from '@/engines/tts/types';

const DEMO_VOICES: readonly VoiceInfo[] = [
  {
    id: 'own-demo',
    name: 'Casey',
    engine: 'helper',
    language: 'en',
    isOwnVoice: true,
    installed: true,
  },
  {
    id: 'en_US-libritts-high',
    name: 'LibriTTS (US)',
    engine: 'piper',
    language: 'en',
    isOwnVoice: false,
    installed: true,
  },
];

function Demo() {
  const [settings, setSettings] = useState(DEFAULT_NARRATION_SETTINGS);
  const [playing, setPlaying] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  return (
    <>
      <NarrationControls
        settings={settings}
        playing={playing}
        preparing={false}
        sleepLabel="15 min"
        onPlayPause={() => setPlaying((p) => !p)}
        onSpeed={(speed) => setSettings((s) => ({ ...s, speed }))}
        onVoice={() => setVoiceOpen(true)}
        onExpressive={(expressive) => setSettings((s) => ({ ...s, expressive, style: expressive ? 'expressive' : 'natural' }))}
        onSleep={() => {}}
        onDriveMode={() => {}}
      />
      <NarrationSheet
        open={voiceOpen}
        voices={DEMO_VOICES}
        selectedId={settings.voiceId}
        onClose={() => setVoiceOpen(false)}
        onPick={(voiceId, engine) => setSettings((s) => ({ ...s, voiceId, engine }))}
      />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="pn-page" style={{ padding: 24 }}>
      <h1>Narration controls</h1>
      <Demo />
    </main>
  </StrictMode>,
);
