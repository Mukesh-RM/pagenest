import type { FileStore } from '@/data/opfs';
import { cloneModelPath } from './clone-models';

export function createCloneModelStore(files: FileStore) {
  return {
    readCloneModel: async (fileName: string) => {
      const path = cloneModelPath(fileName);
      if (!(await files.exists(path))) return undefined;
      return (await files.open(path)).arrayBuffer();
    },
    writeCloneModel: async (fileName: string, data: ArrayBuffer) => {
      await files.write(cloneModelPath(fileName), data);
    },
  };
}
