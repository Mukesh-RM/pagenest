import { useState } from 'react';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { Button } from '@/ui/components/Button';
import { NarrationControls, type NarrationControlsProps } from './NarrationControls';
import './narration-dock.css';

export type NarrationDockProps = NarrationControlsProps;

/**
 * Read-aloud controls stay off the book page: a compact strip by default, full controls in a bottom sheet.
 */
export function NarrationDock(props: NarrationDockProps) {
  const [open, setOpen] = useState(false);
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
          aria-label={open ? 'Close read aloud controls' : 'Open read aloud controls'}
          onClick={() => setOpen((v) => !v)}
        >
          {playing ? 'Pause' : preparing ? 'Loading voice…' : 'Read aloud'}
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
