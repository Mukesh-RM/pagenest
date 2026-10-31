/** Build a minimal mono 16-bit PCM WAV for tests. */
export function miniWavMono(sampleCount = 800, sampleRate = 16_000): { blob: Blob; buffer: ArrayBuffer } {
  const dataBytes = sampleCount * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < sampleCount; i += 1) {
    const v = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 8000;
    view.setInt16(44 + i * 2, v, true);
  }
  return { blob: new Blob([buf], { type: 'audio/wav' }), buffer: buf };
}
