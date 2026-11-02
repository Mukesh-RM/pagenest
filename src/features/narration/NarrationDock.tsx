import { useState } from 'react';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { Button } from '@/ui/components/Button';
import { NarrationControls, type NarrationControlsProps } from './NarrationControls';
import './narration-dock.css';

export type NarrationDockProps = NarrationControlsProps & {
  readonly initialOpen?: boolean;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
};

/**
 * Read-aloud controls stay off the book page: a compact strip by default, full controls in a bottom sheet.
 */
export function NarrationDock({ initialOpen, open: openControlled, onOpenChange, ...props }: NarrationDockProps) {
  const [openInternal, setOpenInternal] = useState(Boolean(initialOpen));
  const open = openControlled ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;
  const { playing, preparing } = props;

  return (
    <>
      <div className="pn-narration-dock" data-expanded={open ? 'true' : undefined}>
        <Button
          variant={playing ? 'primary' : 'secondary'}
          icon={playing ? 'pause' : 'headphones'}
          className="pn-narration-dock__toggle"
          aria-expanded={open}
          aria-controls="pn-narration-sheet"
          aria-label="Read aloud"
          onClick={() => setOpen(!open)}
        >
          {playing ? 'Pause' : preparing ? 'Loading…' : 'Read aloud'}
        </Button>
      </div>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Read aloud"
        className="pn-narration-sheet"
      >
        <div id="pn-narration-sheet">
          <NarrationControls {...props} />
        </div>
      </BottomSheet>
    </>
  );
}
