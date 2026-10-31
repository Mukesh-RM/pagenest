import type { VoicePackManifest } from './voice-pack';
import { readVoiceManifest, openVoiceSample } from './voice-pack';
import type { FileStore } from '@/data/opfs';

export interface VoicePackExportFile {
  readonly path: string;
  readonly data: Blob;
}

/** Build the file list for a My Voice Pack zip (caller lazy-loads JSZip). */
export async function buildVoicePackExportFiles(
  files: FileStore,
  voiceId: string,
): Promise<{ manifest: VoicePackManifest; files: VoicePackExportFile[] }> {
  const manifest = await readVoiceManifest(files, voiceId);
  if (!manifest) throw new Error('Voice pack not found on this device.');
  const out: VoicePackExportFile[] = [
    { path: 'manifest.json', data: new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }) },
    {
      path: 'README.txt',
      data: new Blob(
        [
          [
            'PageNest My Voice Pack',
            '----------------------',
            'This package contains your own voice recordings for offline training.',
            'Do not share these files; they are meant only for your personal voice model.',
            'Train with the free PageNest Voice Helper script, then import the model back into the app.',
          ].join('\n'),
        ],
        { type: 'text/plain' },
      ),
    },
  ];
  out.push({
    path: `audio/consent.wav`,
    data: await openVoiceSample(files, voiceId, 'consent.wav'),
  });
  for (const p of manifest.prompts) {
    out.push({
      path: `audio/${p.file}`,
      data: await openVoiceSample(files, voiceId, p.file),
    });
  }
  return { manifest, files: out };
}

/** Lazy-load JSZip (MIT) only when the user exports a pack. */
export async function zipVoicePack(files: VoicePackExportFile[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.data);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function exportOwnVoiceZip(files: FileStore, voiceId: string): Promise<Blob> {
  const { files: entries } = await buildVoicePackExportFiles(files, voiceId);
  return zipVoicePack(entries);
}
