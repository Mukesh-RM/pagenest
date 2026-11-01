import type { RefObject } from 'react';
import { sectionText } from '@/features/reader/core/text-offsets';

/** Plain text of the current foliate section (iframe) for narration. */
export function readChapterText(hostRef: RefObject<HTMLDivElement | null>): string {
  const host = hostRef.current;
  if (!host) return '';
  const viewDoc = host.querySelector('iframe')?.contentDocument ?? host.ownerDocument;
  if (!viewDoc) return '';
  return sectionText(viewDoc);
}
