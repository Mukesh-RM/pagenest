/**
 * Turns converted text (DOCX, TXT, RTF, Markdown, HTML) into the book object foliate-js' view and paginator expect, so
 * every reflowable format shares one reader, one pagination engine and one locator scheme.
 */

export interface SectionInput {
  /** Chapter title for the contents list. */
  readonly title: string;
  /** Body HTML. Must already be sanitized. */
  readonly html: string;
}

export interface SyntheticBookInput {
  readonly title?: string;
  readonly author?: string;
  readonly language?: string;
  readonly sections: readonly SectionInput[];
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sectionDocument(section: SectionInput, language: string | undefined): string {
  const lang = language ? ` lang="${escapeHtml(language)}"` : '';
  return `<!doctype html><html${lang}><head><meta charset="utf-8"><title>${escapeHtml(section.title)}</title></head><body>${section.html}</body></html>`;
}

export function makeSyntheticBook(input: SyntheticBookInput): FoliateBook {
  const urls = new Set<string>();
  const docs = input.sections.map((s) => sectionDocument(s, input.language));
  const sections: FoliateBook['sections'] = docs.map((doc, index) => ({
    id: index,
    size: doc.length,
    load: () => {
      const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
      urls.add(url);
      return url;
    },
    unload: () => undefined,
    createDocument: () => new DOMParser().parseFromString(doc, 'text/html'),
    // Links such as "#note1" inside a section mean "that id in this section".
    resolveHref: (href: string) => (href.startsWith('#') ? `${index}${href}` : href),
  }));

  const toc: FoliateTocItem[] = input.sections.map((s, i) => ({ label: s.title, href: String(i), subitems: null }));
  const book: FoliateBook = {
    metadata: {
      title: input.title ?? '',
      author: input.author ?? '',
      language: input.language ?? 'en',
    },
    dir: 'ltr',
    sections,
    toc,
    rendition: { layout: 'reflowable' },
    splitTOCHref: (href: string) => {
      const [a, b] = href.split('#');
      return [Number(a), b ?? null];
    },
    getTOCFragment: (doc: Document, id: unknown) => (typeof id === 'string' && id ? doc.getElementById(id) : doc.documentElement),
    resolveHref: (href: string) => {
      const [a, b] = href.split('#');
      const index = Number(a);
      if (!Number.isInteger(index) || index < 0 || index >= sections.length) return null;
      return { index, anchor: b ? (doc: Document) => doc.getElementById(b) ?? 0 : () => 0 };
    },
    isExternal: (href: string) => /^(https?:|mailto:|tel:)/i.test(href),
    getCover: () => null,
    destroy: () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
  return book;
}
