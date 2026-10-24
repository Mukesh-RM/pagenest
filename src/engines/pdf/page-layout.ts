/**
 * Where every PDF page sits in the scrolling surface. Pure maths, no DOM, so it is unit tested and cheap to
 * recompute when a real page size replaces the estimate.
 *
 * Pages sit in rows of `columns` (1 on phones, 2 for a landscape spread). Each page is scaled so its own width fits
 * its column at `zoom` 1 ("fit width"); zoom above 1 can make the surface wider than the viewport.
 */

export interface PageBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** CSS pixels per PDF point for this page. */
  readonly scale: number;
}

export interface LayoutOptions {
  readonly pageCount: number;
  /** Natural size (PDF points) used for pages whose real size is not known yet. */
  readonly estimate: { readonly width: number; readonly height: number };
  readonly viewportWidth: number;
  readonly columns?: number;
  readonly zoom?: number;
  /** Space between pages and around the surface, in CSS px. */
  readonly gap?: number;
}

export interface PageAnchor {
  /** 1-based page number. */
  readonly page: number;
  /** 0 (top of the page) to 1 (bottom). */
  readonly offset: number;
}

export class PageLayout {
  readonly pageCount: number;
  readonly #sizes: Array<{ w: number; h: number } | undefined>;
  #estimate: { width: number; height: number };
  #viewportWidth: number;
  #columns: number;
  #zoom: number;
  #gap: number;
  #boxes: PageBox[] = [];
  #rowTops: number[] = [];
  #rowOfPage: number[] = [];
  #height = 0;
  #width = 0;

  constructor(options: LayoutOptions) {
    this.pageCount = options.pageCount;
    this.#sizes = new Array(options.pageCount).fill(undefined);
    this.#estimate = { ...options.estimate };
    this.#viewportWidth = Math.max(1, options.viewportWidth);
    this.#columns = Math.max(1, options.columns ?? 1);
    this.#zoom = options.zoom ?? 1;
    this.#gap = options.gap ?? 8;
    this.recompute();
  }

  get totalHeight(): number {
    return this.#height;
  }

  get totalWidth(): number {
    return this.#width;
  }

  get zoom(): number {
    return this.#zoom;
  }

  get columns(): number {
    return this.#columns;
  }

  /** Record a page's real size (PDF points). Returns true when the layout changed and was recomputed. */
  setPageSize(page: number, width: number, height: number): boolean {
    const i = page - 1;
    if (i < 0 || i >= this.pageCount || !(width > 0) || !(height > 0)) return false;
    const old = this.#sizes[i];
    if (old && old.w === width && old.h === height) return false;
    this.#sizes[i] = { w: width, h: height };
    return true;
  }

  hasSize(page: number): boolean {
    return this.#sizes[page - 1] !== undefined;
  }

  /** Natural size (PDF points) used for pages that have not been measured yet. */
  setEstimate(width: number, height: number): void {
    if (width > 0 && height > 0) this.#estimate = { width, height };
  }

  setViewportWidth(width: number): void {
    this.#viewportWidth = Math.max(1, width);
  }

  setZoom(zoom: number): void {
    this.#zoom = zoom;
  }

  setColumns(columns: number): void {
    this.#columns = Math.max(1, Math.floor(columns));
  }

  /** Lay every page out again. Call after any setter. */
  recompute(): void {
    const { pageCount } = this;
    const cols = this.#columns;
    const gap = this.#gap;
    const columnWidth = Math.max(1, (this.#viewportWidth - gap * (cols + 1)) / cols) * this.#zoom;
    const natural = (i: number): { w: number; h: number } => this.#sizes[i] ?? { w: this.#estimate.width, h: this.#estimate.height };

    const widths: number[] = [];
    const heights: number[] = [];
    const scales: number[] = [];
    for (let i = 0; i < pageCount; i++) {
      const n = natural(i);
      const scale = columnWidth / n.w;
      scales.push(scale);
      widths.push(n.w * scale);
      heights.push(n.h * scale);
    }

    const rows = Math.ceil(pageCount / cols);
    let maxRow = 0;
    const rowWidths: number[] = [];
    for (let r = 0; r < rows; r++) {
      let w = gap * (Math.min(cols, pageCount - r * cols) + 1);
      for (let c = 0; c < cols && r * cols + c < pageCount; c++) w += widths[r * cols + c] as number;
      rowWidths.push(w);
      maxRow = Math.max(maxRow, w);
    }
    const surfaceWidth = Math.max(this.#viewportWidth, maxRow);

    this.#boxes = [];
    this.#rowTops = [];
    this.#rowOfPage = [];
    let y = gap;
    for (let r = 0; r < rows; r++) {
      this.#rowTops.push(y);
      let rowHeight = 0;
      for (let c = 0; c < cols && r * cols + c < pageCount; c++) rowHeight = Math.max(rowHeight, heights[r * cols + c] as number);
      let x = (surfaceWidth - (rowWidths[r] as number)) / 2 + gap;
      for (let c = 0; c < cols && r * cols + c < pageCount; c++) {
        const i = r * cols + c;
        this.#boxes.push({ x, y, width: widths[i] as number, height: heights[i] as number, scale: scales[i] as number });
        this.#rowOfPage.push(r);
        x += (widths[i] as number) + gap;
      }
      y += rowHeight + gap;
    }
    this.#height = y;
    this.#width = surfaceWidth;
  }

  boxOf(page: number): PageBox {
    const box = this.#boxes[Math.min(Math.max(page, 1), this.pageCount) - 1];
    if (!box) throw new RangeError(`Page ${page} does not exist.`);
    return box;
  }

  /** Index of the row that contains vertical position `y`. */
  #rowAt(y: number): number {
    let lo = 0;
    let hi = this.#rowTops.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.#rowTops[mid] as number) <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Pages whose boxes touch `[top - overscan, bottom + overscan]`, in order. */
  visiblePages(top: number, bottom: number, overscan = 0): number[] {
    if (this.pageCount === 0) return [];
    const from = this.#rowAt(Math.max(0, top - overscan));
    const to = this.#rowAt(Math.max(0, bottom + overscan));
    const pages: number[] = [];
    for (let r = from; r <= to; r++) {
      for (let c = 0; c < this.#columns; c++) {
        const i = r * this.#columns + c;
        if (i >= this.pageCount) break;
        pages.push(i + 1);
      }
    }
    return pages;
  }

  /** The page and how far down it `y` is. For a row of two pages the left page is reported. */
  anchorAt(y: number): PageAnchor {
    if (this.pageCount === 0) return { page: 1, offset: 0 };
    const r = this.#rowAt(Math.max(0, y));
    let page = r * this.#columns + 1;
    let box = this.boxOf(page);
    let offset = (y - box.y) / box.height;
    // In the gap under a row, the next row is what is coming into view: report its top, not "the end of the page above".
    if (offset > 1 && page + this.#columns <= this.pageCount) {
      page += this.#columns;
      box = this.boxOf(page);
      offset = 0;
    }
    return { page, offset: Math.min(1, Math.max(0, offset)) };
  }

  /** Vertical scroll position of an anchor. */
  yOf(anchor: PageAnchor): number {
    const box = this.boxOf(anchor.page);
    return box.y + Math.min(1, Math.max(0, anchor.offset)) * box.height;
  }

  /** Fraction of the whole surface for scrubbing, 0 to 1. */
  fractionAt(y: number): number {
    const range = this.#height;
    return range <= 0 ? 0 : Math.min(1, Math.max(0, y / range));
  }

  rowOf(page: number): number {
    return this.#rowOfPage[Math.min(Math.max(page, 1), this.pageCount) - 1] ?? 0;
  }
}
