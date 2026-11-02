import type { RefObject } from 'react';
import type { ReaderDocumentExt } from '@/features/reader/core/ext-types';
import { sectionText } from '@/features/reader/core/text-offsets';

/** Plain text of the current foliate section (iframe) for narration. */
export function readChapterText(hostRef: RefObject<HTMLDivElement | null>): string {
  const host = hostRef.current;
  if (!host) return '';
  const viewDoc = host.querySelector('iframe')?.contentDocument ?? host.ownerDocument;
  if (!viewDoc) return '';
  return sectionText(viewDoc);
}

/** Text source for read-aloud: reflow iframe or visible PDF text layers. */
export function readNarrationSourceText(hostRef: RefObject<HTMLDivElement | null>, doc?: ReaderDocumentExt): string {
  if (doc?.layout === 'fixed') {
    const host = hostRef.current;
    if (!host) return '';
    const chunks: string[] = [];
    host.querySelectorAll('.pn-pdf-text.textLayer').forEach((el) => {
      const t = el.textContent?.trim();
      if (t) chunks.push(t);
    });
    return chunks.join('\n\n');
  }
  return readChapterText(hostRef);
}
