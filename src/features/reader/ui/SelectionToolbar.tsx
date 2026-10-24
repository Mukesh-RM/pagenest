import { useLayoutEffect, useRef, useState } from 'react';
import type { HighlightColor } from '@/engines/reader/types';
import { cx } from '@/ui';
import { HIGHLIGHT_FILL } from '../core/appearance';
import { HIGHLIGHT_COLORS, HIGHLIGHT_LABEL } from './highlight-colors';
import { Copy, NotebookPen } from './icons';
import { IconButton } from './IconButton';

interface Props {
  /** The selection, in the stage's coordinates. */
  readonly rect: DOMRect;
  readonly stage: { readonly width: number; readonly height: number };
  readonly onColor: (color: HighlightColor) => void;
  readonly onNote: () => void;
  readonly onCopy: () => void;
}

const GAP = 12;
const EDGE = 8;

/** Four highlight colors, a note and copy, floating above (or below) the selection. */
export function SelectionToolbar({ rect, stage, onColor, onNote, onCopy }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: EDGE, top: EDGE });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - w / 2), Math.max(EDGE, stage.width - w - EDGE));
    const above = rect.top - h - GAP;
    const top = above >= EDGE ? above : Math.min(rect.bottom + GAP, Math.max(EDGE, stage.height - h - EDGE));
    setPos({ left, top });
  }, [rect, stage.width, stage.height]);

  return (
    <div ref={ref} role="toolbar" aria-label="Selection" className="pn-seltool" style={{ left: pos.left, top: pos.top }} onPointerDown={(e) => e.preventDefault()}>
      {HIGHLIGHT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={cx('pn-dot', 'pn-dot--tool')}
          aria-label={`Highlight ${HIGHLIGHT_LABEL[c].toLowerCase()}`}
          style={{ ['--pn-hl' as string]: HIGHLIGHT_FILL[c] }}
          onClick={() => onColor(c)}
        />
      ))}
      <IconButton icon={NotebookPen} label="Add a note" onClick={onNote} />
      <IconButton icon={Copy} label="Copy" onClick={onCopy} />
    </div>
  );
}
