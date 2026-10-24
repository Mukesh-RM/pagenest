/** Extensions that are stripped from a file name when it becomes a title. */
const KNOWN_EXTENSIONS = /\.(epub|pdf|mobi|azw3?|fb2|cbz|docx?|txt|rtf|html?|md|djvu|mp3|m4b|m4a|aac|ogg|opus|flac|wav|zip|bin|part|download|crdownload)$/i;
/** Copy suffixes such as `__1_`, `_(2)`, ` (3)`, ` - Copy`. */
const COPY_SUFFIX = /(?:[_\s]*\(\d{1,3}\)|_{1,}\d{1,3}_{1,}|[\s_-]+copy(?:[\s_]*\d+)?)$/i;

/**
 * A readable title from a file name, for files whose own metadata has no title.
 * `My_Book.final.epub__1_` becomes `My Book final`. Only used for display; what a file IS
 * is decided from its bytes.
 */
export function titleFromFileName(name: string): string {
  let text = name.split(/[\\/]/).pop() ?? name;
  for (let i = 0; i < 4; i += 1) {
    const before = text;
    text = text.replace(COPY_SUFFIX, '').replace(KNOWN_EXTENSIONS, '');
    if (text === before) break;
  }
  text = text.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/^[.\s-]+/, '');
  return text === '' ? 'Untitled' : text.slice(0, 200);
}

/** Folder of a relative path (`A/B/c.mp3` gives `A/B`), or `''`. */
export function folderOf(relPath: string | undefined): string {
  if (!relPath) return '';
  const i = relPath.lastIndexOf('/');
  return i === -1 ? '' : relPath.slice(0, i);
}

/** Last part of a folder path. */
export function lastFolderName(folder: string): string {
  return folder.split('/').pop() ?? folder;
}
