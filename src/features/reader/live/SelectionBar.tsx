import type { HighlightColor, ReaderSelection } from '@/engines/reader/types';
import { Button } from '@/ui';

const COLORS: readonly HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

interface Props {
  readonly selection: ReaderSelection;
  readonly onHighlight: (color: HighlightColor) => void;
  readonly onDismiss: () => void;
}

/** Shown above the page when text is selected; four highlight colors. */
export function SelectionBar({ selection, onHighlight, onDismiss }: Props) {
  return (
    <div className="pn-live-select" role="toolbar" aria-label="Selected text">
      <p className="pn-live-select__preview">{selection.text.slice(0, 80)}{selection.text.length > 80 ? '…' : ''}</p>
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
