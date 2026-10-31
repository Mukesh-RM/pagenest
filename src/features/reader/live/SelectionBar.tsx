import type { HighlightColor, ReaderSelection } from '@/engines/reader/types';
import { Button } from '@/ui';

const COLORS: readonly HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

interface Props {
  readonly selection: ReaderSelection;
  readonly onHighlight: (color: HighlightColor) => void;
  readonly onDefine?: () => void;
  readonly onTranslate?: () => void;
  readonly onDismiss: () => void;
}

/** Shown above the page when text is selected; highlight, define and translate. */
export function SelectionBar({ selection, onHighlight, onDefine, onTranslate, onDismiss }: Props) {
  return (
    <div className="pn-live-select" role="toolbar" aria-label="Selected text">
      <p className="pn-live-select__preview">{selection.text.slice(0, 80)}{selection.text.length > 80 ? '…' : ''}</p>
      <div className="pn-live-select__actions">
        {onDefine ? (
          <Button variant="secondary" aria-label="Define selection" onClick={onDefine}>
            Define
          </Button>
        ) : null}
        {onTranslate ? (
          <Button variant="secondary" aria-label="Translate selection" onClick={onTranslate}>
            Translate
          </Button>
        ) : null}
      </div>
      <div className="pn-live-select__colors">
        {COLORS.map((color) => (
          <Button
            key={color}
            variant="secondary"
            className={`pn-live-select__swatch pn-live-select__swatch--${color}`}
            aria-label={`Highlight ${color}`}
            onClick={() => onHighlight(color)}
          >
            {color}
          </Button>
        ))}
      </div>
      <Button iconOnly variant="ghost" icon="close" aria-label="Clear selection" onClick={onDismiss} />
    </div>
  );
}
