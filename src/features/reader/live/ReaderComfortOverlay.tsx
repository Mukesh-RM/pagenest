import type { ReaderComfort } from '@/app/reader-comfort';

export function ReaderComfortOverlay({ comfort }: { comfort: ReaderComfort }) {
  const dim = 1 - comfort.brightness;
  const warm = comfort.warmth;
  if (dim <= 0.01 && warm <= 0.01) return null;
  return (
    <div
      className="pn-reader-comfort"
      aria-hidden
      style={{
        background: warm > 0 ? `rgba(255, 196, 120, ${warm * 0.45})` : undefined,
        boxShadow: dim > 0 ? `inset 0 0 140px rgba(0, 0, 0, ${dim * 0.85})` : undefined,
      }}
    />
  );
}
