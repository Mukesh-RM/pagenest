import type { FileRef } from '@/app/contracts';
import type { FileStore } from '@/data/opfs';

export function piperModelPath(voiceId: string): FileRef {
  return `voices/piper/${voiceId}.onnx`;
}

export function createPiperModelStore(files: FileStore) {
  return {
    readModel: async (voiceId: string) => {
      const path = piperModelPath(voiceId);
      if (!(await files.exists(path))) return undefined;
      return (await files.open(path)).arrayBuffer();
    },
    writeModel: async (voiceId: string, data: ArrayBuffer) => {
      await files.write(piperModelPath(voiceId), data);
    },
  };
}
