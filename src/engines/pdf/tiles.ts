/**
 * Tiled rendering. A page is cut into a grid of tiles measured in DEVICE pixels, so tile edges always land on whole
 * device pixels (no hairline seams) and no canvas ever exceeds `maxTile` pixels a side, even for a page zoomed to 5x.
 * Only tiles that touch the visible part of the page (plus a margin) are drawn.
 */

export interface Tile {
  readonly ix: number;
  readonly iy: number;
  /** Position inside the page, in device pixels. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const MAX_TILE_DEVICE_PX = 2048;

export function tileKey(page: number, tile: Pick<Tile, 'ix' | 'iy'>, scaleKey: string): string {
  return `${page}:${scaleKey}:${tile.ix},${tile.iy}`;
}

/**
 * Tiles to draw for one page.
 * @param pageWidth page size in device pixels
 * @param visible the part of the page that is on screen (plus margin), in device pixels, relative to the page's top left
 */
export function planTiles(
  pageWidth: number,
  pageHeight: number,
  visible: { left: number; top: number; right: number; bottom: number },
  maxTile: number = MAX_TILE_DEVICE_PX,
): Tile[] {
  const w = Math.max(1, Math.round(pageWidth));
  const h = Math.max(1, Math.round(pageHeight));
  const cols = Math.ceil(w / maxTile);
  const rows = Math.ceil(h / maxTile);
  // Fewer, evenly sized tiles instead of a thin sliver at the edge.
  const tw = Math.ceil(w / cols);
  const th = Math.ceil(h / rows);
  const left = Math.max(0, visible.left);
  const top = Math.max(0, visible.top);
  const right = Math.min(w, visible.right);
  const bottom = Math.min(h, visible.bottom);
  if (right <= left || bottom <= top) return [];
  const tiles: Tile[] = [];
  for (let iy = Math.floor(top / th); iy <= Math.min(rows - 1, Math.floor((bottom - 1) / th)); iy++) {
    for (let ix = Math.floor(left / tw); ix <= Math.min(cols - 1, Math.floor((right - 1) / tw)); ix++) {
      const x = ix * tw;
      const y = iy * th;
      tiles.push({ ix, iy, x, y, width: Math.min(tw, w - x), height: Math.min(th, h - y) });
    }
  }
  return tiles;
}
