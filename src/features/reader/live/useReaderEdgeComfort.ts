import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { ReaderComfort } from '@/app/reader-comfort';

const EDGE_PX = 32;

type Edge = 'brightness' | 'warmth';

export function useReaderEdgeComfort(
  comfort: ReaderComfort,
  onComfortChange: (next: ReaderComfort) => void,
): {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
} {
  const comfortRef = useRef(comfort);
  comfortRef.current = comfort;
  const drag = useRef<{ edge: Edge; y0: number; base: ReaderComfort } | undefined>();

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const x = e.clientX;
      const w = e.currentTarget.ownerDocument?.defaultView?.innerWidth ?? window.innerWidth;
      let edge: Edge | undefined;
      if (x <= EDGE_PX) edge = 'brightness';
      else if (x >= w - EDGE_PX) edge = 'warmth';
      if (!edge) return;
      drag.current = { edge, y0: e.clientY, base: comfortRef.current };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [comfort],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const delta = (e.clientY - d.y0) / 240;
      if (d.edge === 'brightness') {
        const brightness = Math.min(1, Math.max(0.4, d.base.brightness - delta));
        onComfortChange({ ...comfortRef.current, brightness });
      } else {
        const warmth = Math.min(1, Math.max(0, d.base.warmth + delta));
        onComfortChange({ ...comfortRef.current, warmth });
      }
    },
    [onComfortChange],
  );

  const end = useCallback((e: ReactPointerEvent) => {
    if (!drag.current) return;
    drag.current = undefined;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}
