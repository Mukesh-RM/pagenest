import { useEffect, useRef } from 'react';

const SHAKE_THRESHOLD = 16;
const SHAKE_COOLDOWN_MS = 2500;

/**
 * Listens for a sharp device shake while a sleep timer is active and calls `onExtend`.
 * No-op when motion events are unavailable (desktop) or permission is denied.
 */
export function useShakeToExtendSleep(active: boolean, onExtend: () => void): void {
  const lastShake = useRef(0);
  const onExtendRef = useRef(onExtend);
  onExtendRef.current = onExtend;

  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    if (!('DeviceMotionEvent' in window)) return undefined;

    let lastAccel = { x: 0, y: 0, z: 0 };

    const onMotion = (ev: DeviceMotionEvent) => {
      const a = ev.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const dx = Math.abs(a.x - lastAccel.x);
      const dy = Math.abs(a.y - lastAccel.y);
      const dz = Math.abs(a.z - lastAccel.z);
      lastAccel = { x: a.x, y: a.y, z: a.z };
      const delta = dx + dy + dz;
      if (delta < SHAKE_THRESHOLD) return;
      const now = Date.now();
      if (now - lastShake.current < SHAKE_COOLDOWN_MS) return;
      lastShake.current = now;
      onExtendRef.current();
    };

    const attach = () => window.addEventListener('devicemotion', onMotion);

    const motion = DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
    };
    if (typeof motion.requestPermission === 'function') {
      void motion.requestPermission().then((state) => {
        if (state === 'granted') attach();
      });
      return () => window.removeEventListener('devicemotion', onMotion);
    }

    attach();
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [active]);
}
