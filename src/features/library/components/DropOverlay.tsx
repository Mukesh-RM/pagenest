import { useEffect, useState } from 'react';
import { Icon } from '@/ui';
import type { ImportItem } from '@/workers/import/protocol';
import { collectDropped, dragHasFiles } from '../dropped-files';

/** While files are dragged over the page, say where they will go. Dropping adds them. */
export function DropOverlay({ onDrop }: { onDrop: (items: ImportItem[]) => void }) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent): void => {
      if (!dragHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      depth += 1;
      setOver(true);
    };
    const overHandler = (e: DragEvent): void => {
      if (dragHasFiles(e.dataTransfer)) e.preventDefault(); // allow the drop
    };
    const leave = (e: DragEvent): void => {
      if (!dragHasFiles(e.dataTransfer)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const drop = (e: DragEvent): void => {
      if (!dragHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      if (e.dataTransfer) void collectDropped(e.dataTransfer).then((items) => items.length > 0 && onDrop(items));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', overHandler);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', overHandler);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [onDrop]);
  if (!over) return null;
  return (
    <div className="pn-lib-drop" role="presentation">
      <div className="pn-lib-drop__card">
        <Icon name="download" size={32} />
        <p>Drop to add to your library</p>
      </div>
    </div>
  );
}
