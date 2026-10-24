import { useRef } from 'react';
import { BottomSheet, Button } from '@/ui';
import { itemsFromPicker } from '../dropped-files';
import type { ImportItem } from '@/workers/import/protocol';

export interface AddSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (items: ImportItem[]) => void;
}

/** The two ways to add: files, or a whole folder (an audiobook folder becomes one book). */
export function AddSheet({ open, onClose, onPick }: AddSheetProps) {
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const folderOk = typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input');
  const take = (input: HTMLInputElement): void => {
    const items = itemsFromPicker(input.files);
    input.value = ''; // picking the same file again must still fire
    onClose();
    if (items.length > 0) onPick(items);
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="Add to your library">
      <p className="pn-lib-sheet-note">Books, PDFs and audiobooks stay on this device. PageNest looks inside each file, so it does not matter what the file is called.</p>
      <div className="pn-lib-sheet-actions">
        <Button block size="lg" icon="plus" onClick={() => files.current?.click()}>
          Choose files
        </Button>
        {folderOk ? (
          <Button block size="lg" variant="secondary" icon="folder" onClick={() => folder.current?.click()}>
            Choose a folder
          </Button>
        ) : null}
      </div>
      <p className="pn-lib-sheet-note">On a computer you can also drop files or folders anywhere on this page.</p>
      {/* No `accept`: files are recognised by their content, so a wrongly named book must stay selectable. */}
      <input ref={files} type="file" multiple hidden data-testid="pick-files" onChange={(e) => take(e.currentTarget)} />
      <input ref={folder} type="file" multiple hidden data-testid="pick-folder" {...{ webkitdirectory: '' }} onChange={(e) => take(e.currentTarget)} />
    </BottomSheet>
  );
}
