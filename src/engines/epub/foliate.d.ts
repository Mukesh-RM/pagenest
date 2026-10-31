// foliate-js (MIT) ships plain ES modules without types. Only the pieces InkQuiet touches are declared, loosely.

declare module 'foliate-js/view.js' {
  export class View extends HTMLElement {
    [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

declare module 'foliate-js/overlayer.js' {
  export class Overlayer {
    [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    static highlight: (rects: unknown[], options?: Record<string, unknown>) => SVGElement;
    static outline: (rects: unknown[], options?: Record<string, unknown>) => SVGElement;
  }
}

declare module 'foliate-js/epub.js' {
  export class EPUB {
    constructor(loader: object);
    init(): Promise<FoliateBook>;
  }
}

declare module 'foliate-js/mobi.js' {
  export const isMOBI: (file: Blob) => Promise<boolean>;
  export class MOBI {
    constructor(options: { unzlib: (data: Uint8Array) => Uint8Array });
    open(file: Blob): Promise<FoliateBook>;
  }
}

declare module 'foliate-js/fb2.js' {
  export const makeFB2: (blob: Blob) => Promise<FoliateBook>;
}

declare module 'foliate-js/comic-book.js' {
  export const makeComicBook: (loader: object, file: { name: string }) => Promise<FoliateBook>;
}

declare module 'foliate-js/vendor/fflate.js' {
  export const unzlibSync: (data: Uint8Array) => Uint8Array;
}

declare module 'foliate-js/vendor/zip.js' {
  export const configure: (options: Record<string, unknown>) => void;
  export class BlobReader {
    constructor(blob: Blob);
  }
  export class BlobWriter {
    constructor(type?: string);
  }
  export class TextWriter {
    constructor();
  }
  export class ZipReader {
    constructor(reader: BlobReader);
    comment?: Uint8Array;
    getEntries(): Promise<ZipEntry[]>;
  }
  export interface ZipEntry {
    filename: string;
    uncompressedSize: number;
    directory?: boolean;
    getData(writer: unknown): Promise<unknown>;
  }
}

/** The shape foliate's view and paginator expect from a book. Loosely typed on purpose. */
interface FoliateBook {
  metadata?: { title?: unknown; author?: unknown; language?: unknown; [key: string]: unknown };
  dir?: string;
  toc?: FoliateTocItem[];
  rendition?: { layout?: string };
  sections: Array<{
    id: unknown;
    load(): unknown;
    unload?(): void;
    createDocument?(): Promise<Document> | Document;
    size?: number;
    linear?: string;
    cfi?: string;
  }>;
  splitTOCHref?(href: string): unknown;
  getTOCFragment?(doc: Document, id: unknown): Element | null;
  resolveHref?(href: string): { index: number; anchor?: (doc: Document) => unknown } | null | undefined;
  getCover?(): Promise<Blob | null> | Blob | null;
  destroy?(): void;
  [key: string]: unknown;
}

interface FoliateTocItem {
  label: string;
  href: string;
  subitems?: FoliateTocItem[] | null;
}
