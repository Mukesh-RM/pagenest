import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

const THRESHOLD_PX = 72;
const MAX_PULL_PX = 120;

export interface PullToRefreshProps {
  readonly onRefresh: () => void | Promise<void>;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}

/**
 * Pull down at scroll top to refresh (blueprint §6). Uses touch when available; ignored when `disabled`.
 */
export function PullToRefresh({ onRefresh, disabled, children }: PullToRefreshProps) {
  const startY = useRef<number | undefined>();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || refreshing) return;
      if (window.scrollY > 4) return;
      const y = e.touches[0]?.clientY;
      if (y === undefined) return;
      startY.current = y;
    },
    [disabled, refreshing],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === undefined || disabled || refreshing) return;
      const y = e.touches[0]?.clientY;
      if (y === undefined) return;
      const delta = y - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      if (window.scrollY > 4) {
        startY.current = undefined;
        setPull(0);
        return;
      }
      setPull(Math.min(MAX_PULL_PX, delta));
    },
    [disabled, refreshing],
  );

  const finish = useCallback(async () => {
    startY.current = undefined;
    const shouldRefresh = pull >= THRESHOLD_PX;
    setPull(0);
    if (!shouldRefresh || disabled) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [disabled, onRefresh, pull]);

  const onTouchEnd = useCallback(() => {
    void finish();
  }, [finish]);

  const onTouchCancel = useCallback(() => {
    startY.current = undefined;
    setPull(0);
  }, []);

  const onPtrDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (disabled || refreshing) return;
      if (window.scrollY > 4) return;
      startY.current = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [disabled, refreshing],
  );

  const onPtrMove = useCallback(
    (e: ReactPointerEvent) => {
      if (startY.current === undefined || disabled || refreshing) return;
      const delta = e.clientY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      if (window.scrollY > 4) {
        startY.current = undefined;
        setPull(0);
        return;
      }
      setPull(Math.min(MAX_PULL_PX, delta));
    },
    [disabled, refreshing],
  );

  const onPtrUp = useCallback(
    (e: ReactPointerEvent) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* released */
      }
      void finish();
    },
    [finish],
  );

  return (
    <div
      className="pn-ptr"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onPointerDown={onPtrDown}
      onPointerMove={onPtrMove}
      onPointerUp={onPtrUp}
      onPointerCancel={onPtrUp}
    >
      <div
        className="pn-ptr__indicator"
        aria-hidden="true"
        style={{ height: `${Math.max(pull, refreshing ? THRESHOLD_PX : 0)}px`, opacity: pull > 8 || refreshing ? 1 : 0 }}
      >
        <span className="pn-ptr__label">{refreshing ? 'Refreshing…' : pull >= THRESHOLD_PX ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>
      {children}
    </div>
  );
}
