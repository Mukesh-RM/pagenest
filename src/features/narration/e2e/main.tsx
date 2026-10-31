import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/ui';
import { NarrationControls } from '../NarrationControls';
import { DEFAULT_NARRATION_SETTINGS } from '../types';

function Demo() {
  const [settings, setSettings] = useState(DEFAULT_NARRATION_SETTINGS);
  const [playing, setPlaying] = useState(false);
  return (
    <NarrationControls
      settings={settings}
      playing={playing}
      preparing={false}
      onPlayPause={() => setPlaying((p) => !p)}
      onSpeed={(speed) => setSettings((s) => ({ ...s, speed }))}
      onVoice={() => {}}
      onExpressive={(expressive) => setSettings((s) => ({ ...s, expressive, style: expressive ? 'expressive' : 'natural' }))}
    />
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
