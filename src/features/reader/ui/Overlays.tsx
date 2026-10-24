import '../opening.css';
import { useEffect, useRef } from 'react';
import { BottomSheet, Button, type SheetCloseReason } from '@/ui';
import type { WelcomeBack } from '../core/welcome';
import { CircleAlert, Lock, X } from './icons';
import { IconButton } from './IconButton';

/** Quiet card shown for a few seconds after a book opens where it was left. Not modal; screen readers hear it politely. */
export function WelcomeCard({ welcome, onDismiss }: { welcome: WelcomeBack; onDismiss: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="pn-welcome" role="status" aria-live="polite">
      <div className="pn-welcome__text">
        <p className="pn-welcome__title">{welcome.headline}</p>
        <p className="pn-welcome__detail">{welcome.detail}</p>
      </div>
      <IconButton icon={X} label="Dismiss" onClick={onDismiss} />
    </div>
  );
}

/** Shown while the book opens. Always carries words, never a bare spinner. */
export function OpeningState({ message }: { message: string }) {
  return (
    <div className="pn-opening" role="status" aria-live="polite">
      <div className="pn-opening__page" aria-hidden="true">
        <span className="pn-skeleton pn-skeleton--text" style={{ width: '60%' }} />
        <span className="pn-skeleton pn-skeleton--text" />
        <span className="pn-skeleton pn-skeleton--text" />
        <span className="pn-skeleton pn-skeleton--text" style={{ width: '85%' }} />
        <span className="pn-skeleton pn-skeleton--text" />
        <span className="pn-skeleton pn-skeleton--text" style={{ width: '70%' }} />
      </div>
      <p className="pn-opening__message">{message}</p>
    </div>
  );
}

export function ErrorState({ kind, title, message, onBack, onRetry }: { kind: string; title: string; message: string; onBack: () => void; onRetry?: () => void }) {
  const Glyph = kind === 'drm' ? Lock : CircleAlert;
  return (
    <div className="pn-readererror" role="alert">
      <Glyph size={48} aria-hidden="true" />
      <h1 className="pn-readererror__title">{title}</h1>
      <p className="pn-readererror__message">{message}</p>
      <div className="pn-readererror__actions">
        <Button onClick={onBack}>Back to Library</Button>
        {onRetry && kind !== 'drm' && kind !== 'unsupported' ? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Full-screen image view. Tap the image to toggle between fit and zoomed. */
export function ImageViewer({ image, onClose }: { image: { src: string; alt: string } | undefined; onClose: () => void }) {
  const zoomed = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  return (
    <BottomSheet open={Boolean(image)} onClose={(_: SheetCloseReason) => onClose()} title="Image" hideTitle className="pn-imageview">
      {image ? (
        <div className="pn-imageview__stage">
          <img
            ref={imgRef}
            src={image.src}
            alt={image.alt || 'Illustration from the book'}
            className="pn-imageview__img"
            onClick={() => {
              zoomed.current = !zoomed.current;
              imgRef.current?.setAttribute('data-zoomed', String(zoomed.current));
            }}
          />
        </div>
      ) : null}
    </BottomSheet>
  );
}

/** A tapped footnote, shown without leaving the page. */
export function FootnoteSheet({ note, onClose }: { note: { text: string } | undefined; onClose: () => void }) {
  return (
    <BottomSheet open={Boolean(note)} onClose={() => onClose()} title="Note" className="pn-footnote">
      <p className="pn-footnote__text">{note?.text}</p>
    </BottomSheet>
  );
}
