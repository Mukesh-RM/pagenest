import type { FileStore } from '@/data/opfs';
import { cloneModelPath } from './clone-models';

export function createCloneModelStore(files: FileStore) {
  return {
    readCloneModel: async (fileName: string) => {
      const path = cloneModelPath(fileName);
      if (!(await files.exists(path))) return undefined;
      const file = await files.open(path);
      if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
      return new Response(file).arrayBuffer();
    },
    writeCloneModel: async (fileName: string, data: ArrayBuffer) => {
      await files.write(cloneModelPath(fileName), data);
    },
  };
}
