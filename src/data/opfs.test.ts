// @vitest-environment node
import {
  FileStoreError,
  MemoryFileStore,
  OpfsFileStore,
  FilePaths,
  createFileStore,
  isOpfsSupported,
  parsePath,
  type DirectoryHandleLike,
  type FileHandleLike,
  type FileStore,
} from './opfs';

/** In-memory fake of the OPFS handles, with the two ways browsers let you write. */
class FakeFile implements FileHandleLike {
  readonly kind = 'file';
  data = new Blob([]);
  constructor(
    readonly name: string,
    mode: 'writable' | 'sync' | 'none',
  ) {
    if (mode === 'writable') {
      this.createWritable = async () => {
        let next: Blob = new Blob([]);
        return {
          write: async (d) => {
            next = d instanceof Blob ? d : new Blob([d as BlobPart]);
          },
          close: async () => {
            this.data = next;
          },
        };
      };
    }
    if (mode === 'sync') {
      this.createSyncAccessHandle = async () => {
        let bytes = new Uint8Array(0);
        return {
          truncate: (n) => {
            bytes = bytes.slice(0, n);
          },
          write: (buf) => {
            bytes = new Uint8Array(buf as ArrayBuffer);
            return bytes.length;
          },
          flush: () => undefined,
          close: () => {
            this.data = new Blob([bytes]);
          },
        };
      };
    }
  }
  createWritable?: FileHandleLike['createWritable'];
  createSyncAccessHandle?: FileHandleLike['createSyncAccessHandle'];
  async getFile(): Promise<File> {
    return new File([this.data], this.name);
  }
}

function notFound(): Error {
  const e = new Error('nope');
  e.name = 'NotFoundError';
  return e;
}

class FakeDir implements DirectoryHandleLike {
  readonly kind = 'directory';
  readonly children = new Map<string, FakeDir | FakeFile>();
  constructor(
    readonly name: string,
    private readonly mode: 'writable' | 'sync' | 'none',
  ) {}
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike> {
    let child = this.children.get(name);
    if (!child && options?.create) {
      child = new FakeFile(name, this.mode);
      this.children.set(name, child);
    }
    if (!(child instanceof FakeFile)) throw notFound();
    return child;
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike> {
    let child = this.children.get(name);
    if (!child && options?.create) {
      child = new FakeDir(name, this.mode);
      this.children.set(name, child);
    }
    if (!(child instanceof FakeDir)) throw notFound();
    return child;
  }
  async removeEntry(name: string): Promise<void> {
    if (!this.children.delete(name)) throw notFound();
  }
  async *entries(): AsyncIterable<[string, FileHandleLike | DirectoryHandleLike]> {
    for (const entry of this.children) yield entry;
  }
}

const text = async (store: FileStore, path: string): Promise<string> => (await store.open(path)).text();

function behavesLikeAFileStore(name: string, make: () => FileStore): void {
  describe(name, () => {
    it('writes, reads, sizes and checks existence', async () => {
      const store = make();
      expect(await store.exists('books/a/book.txt')).toBe(false);
      await store.write('books/a/book.txt', 'hello');
      expect(await store.exists('books/a/book.txt')).toBe(true);
      expect(await text(store, 'books/a/book.txt')).toBe('hello');
      expect(await store.size('books/a/book.txt')).toBe(5);
    });

    it('accepts blobs, buffers and views, and overwrites', async () => {
      const store = make();
      await store.write('x.bin', new Blob(['abc']));
      await store.write('x.bin', new Uint8Array([104, 105]));
      expect(await text(store, 'x.bin')).toBe('hi');
      await store.write('y.bin', new Uint8Array([1, 2, 3]).buffer);
      expect(await store.size('y.bin')).toBe(3);
    });

    it('lists folders and files, and measures usage', async () => {
      const store = make();
      await store.write('books/a/one.txt', '12345');
      await store.write('books/a/two.txt', '123');
      await store.write('books/b/three.txt', '1');
      await store.write('top.txt', '12');
      expect(await store.list('')).toEqual([
        { name: 'books', kind: 'directory' },
        { name: 'top.txt', kind: 'file' },
      ]);
      expect(await store.list('books/a')).toEqual([
        { name: 'one.txt', kind: 'file' },
        { name: 'two.txt', kind: 'file' },
      ]);
      expect(await store.list('nothing/here')).toEqual([]);
      expect(await store.usage('books/a')).toBe(8);
      expect(await store.usage('')).toBe(11);
    });

    it('removes files and whole folders, ignoring missing paths', async () => {
      const store = make();
      await store.write('books/a/one.txt', 'x');
      await store.write('books/a/two.txt', 'x');
      await store.write('keep.txt', 'x');
      await store.remove('books/a/one.txt');
      expect(await store.exists('books/a/one.txt')).toBe(false);
      await store.remove('books/a');
      expect(await store.list('books')).toEqual([]);
      await store.remove('never/existed');
      expect(await store.exists('keep.txt')).toBe(true);
    });

    it('reports a missing file with a not-found error', async () => {
      const store = make();
      await expect(store.open('missing.txt')).rejects.toMatchObject({ code: 'not-found' });
      await expect(store.size('a/missing.txt')).rejects.toBeInstanceOf(FileStoreError);
    });

    it('rejects unsafe paths', async () => {
      const store = make();
      for (const bad of ['', '/abs', 'a/../b', 'a//b', './a', 'a/', 'a\\b']) {
        await expect(store.write(bad, 'x')).rejects.toMatchObject({ code: 'invalid-path' });
      }
    });
  });
}

behavesLikeAFileStore('OpfsFileStore (createWritable browsers)', () => new OpfsFileStore(new FakeDir('root', 'writable')));
behavesLikeAFileStore('OpfsFileStore (sync access handle only, Safari workers)', () => new OpfsFileStore(new FakeDir('root', 'sync')));
behavesLikeAFileStore('MemoryFileStore', () => new MemoryFileStore());

describe('OpfsFileStore without any way to write', () => {
  it('says plainly that saving is unsupported', async () => {
    const store = new OpfsFileStore(new FakeDir('root', 'none'));
    await expect(store.write('a.txt', 'x')).rejects.toMatchObject({ code: 'unsupported' });
  });
});

describe('capability detection', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
  });

  function setNavigator(value: unknown): void {
    Object.defineProperty(globalThis, 'navigator', { value, configurable: true });
  }

  it('is unsupported without navigator.storage.getDirectory and falls back to memory', async () => {
    setNavigator({ storage: {} });
    expect(isOpfsSupported()).toBe(false);
    const store = await createFileStore();
    expect(store.kind).toBe('memory');
    expect(store.persistent).toBe(false);
  });

  it('uses OPFS when getDirectory works', async () => {
    setNavigator({ storage: { getDirectory: async () => new FakeDir('root', 'writable') } });
    expect(isOpfsSupported()).toBe(true);
    const store = await createFileStore();
    expect(store.kind).toBe('opfs');
    expect(store.persistent).toBe(true);
  });

  it('falls back to memory when getDirectory is blocked', async () => {
    setNavigator({
      storage: {
        getDirectory: async () => {
          throw new DOMException('denied', 'SecurityError');
        },
      },
    });
    expect(isOpfsSupported()).toBe(true);
    expect((await createFileStore()).kind).toBe('memory');
  });
});

describe('parsePath and FilePaths', () => {
  it('splits valid paths', () => {
    expect(parsePath('a/b/c.txt')).toEqual(['a', 'b', 'c.txt']);
    expect(parsePath('', true)).toEqual([]);
  });

  it('builds conventional, valid locations', () => {
    const paths = [
      FilePaths.book('id', 'book.epub'),
      FilePaths.cover('id'),
      FilePaths.track('id', 3, 'ch.mp3'),
      FilePaths.voiceModel('v'),
      FilePaths.render('id', 2, 'v', 'natural'),
    ];
    for (const p of paths) expect(() => parsePath(p)).not.toThrow();
    expect(FilePaths.track('id', 3, 'ch.mp3')).toBe('books/id/tracks/0003-ch.mp3');
  });
});
