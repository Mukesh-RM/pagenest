import type { PDFDocumentProxy, PDFPageProxy, TextLayer as PdfTextLayer } from 'pdfjs-dist';
import type { Locator, TextRange, Unsubscribe } from '@/app/contracts';
import type {
  DocumentMetadata,
  HighlightColor,
  ReaderAppearance,
  ReaderPosition,
  ReaderSelection,
  SearchHit,
  TocItem,
} from '@/engines/reader/types';
import { HIGHLIGHT_ALPHA, HIGHLIGHT_FILL, pdfTint, themeColors } from '@/features/reader/core/appearance';
import { Emitter, frameThrottle } from '@/features/reader/core/emitter';
import { throwIfAborted } from '@/features/reader/core/errors';
import type { KeyboardLike, ReaderDocumentExt } from '@/features/reader/core/ext-types';
import { reflowAt, sectionsOfRange } from '@/features/reader/core/ranges';
import { searchText } from '@/features/reader/core/search';
import { prefersReducedMotion } from '@/ui/utils/motion';
import { PageLayout, type PageAnchor } from './page-layout';
import { buildPageText, offsetOfItemChar, spansForRange, type PageText } from './page-text';
import { RenderQueue } from './render-queue';
import { MAX_TILE_DEVICE_PX, planTiles, type Tile } from './tiles';

const TAP_MOVE_PX = 10;
const TAP_MAX_MS = 450;
const DOUBLE_TAP_MS = 300;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const PAGE_TEXT_CACHE = 48;

interface TileView {
  readonly canvas: HTMLCanvasElement;
  readonly tile: Tile;
  /** Device pixels per PDF point the canvas was drawn at. */
  readonly deviceScale: number;
  readonly key: string;
}

interface PageView {
  readonly page: number;
  readonly el: HTMLDivElement;
  readonly tiles: Map<string, TileView>;
  readonly hl: HTMLDivElement;
  readonly text: HTMLDivElement;
  readonly links: HTMLDivElement;
  textLayer?: PdfTextLayer;
  textScale?: number;
  textDivs?: HTMLElement[];
  textBusy?: boolean;
  linksScale?: number;
  highlightKey?: string;
}

export interface PdfDocumentInit {
  readonly pdf: PDFDocumentProxy;
  readonly host: HTMLElement;
  readonly appearance: ReaderAppearance;
  readonly start: PageAnchor;
  readonly destroy: () => void;
}

interface HighlightEntry {
  readonly id: string;
  readonly range: TextRange;
  readonly color: HighlightColor;
}

/** One open PDF: continuous scrolling pages with tiled, lazy canvases, a text layer and a link layer. */
export class PdfReaderDocument implements ReaderDocumentExt {
  readonly layout = 'fixed' as const;
  metadata: DocumentMetadata = {};
  #toc: readonly TocItem[] = [];

  readonly #pdf: PDFDocumentProxy;
  readonly #host: HTMLElement;
  readonly #destroyLoading: () => void;
  readonly #scroller: HTMLDivElement;
  readonly #surface: HTMLDivElement;
  readonly #views = new Map<number, PageView>();
  readonly #pages = new Map<number, Promise<PDFPageProxy>>();
  readonly #texts = new Map<number, Promise<PageText>>();
  readonly #resolvedTexts = new Map<number, PageText>();
  readonly #queue = new RenderQueue(2);
  readonly #layout: PageLayout;
  readonly #highlights = new Map<string, HighlightEntry>();
  readonly #position = new Emitter<ReaderPosition>();
  readonly #selection = new Emitter<ReaderSelection | undefined>();
  readonly #taps = new Emitter<'left' | 'center' | 'right'>();
  readonly #keys = new Emitter<KeyboardLike>();
  readonly #hlTaps = new Emitter<string>();
  readonly #tocChange = new Emitter<void>();
  readonly #cleanups: Array<() => void> = [];
  readonly #rendered = new Map<number, Array<() => void>>();
  readonly #pageCount: number;
  #appearance: ReaderAppearance;
  #hits: readonly TextRange[] = [];
  #lastSelectionKey = '';
  #closed = false;
  #scrollIdleTimer = 0;
  #scrolling = false;
  #pendingSizes = false;
  #dpr = 1;
  #lastPosition: ReaderPosition;
  #restoring = true;
  #lastTap = { time: 0, x: 0, y: 0 };
  readonly zoom = {
    get: (): number => this.#layout.zoom,
    set: (zoom: number): void => this.#setZoom(zoom),
  };

  constructor(init: PdfDocumentInit) {
    this.#pdf = init.pdf;
    this.#host = init.host;
    this.#destroyLoading = init.destroy;
    this.#appearance = init.appearance;
    this.#pageCount = init.pdf.numPages;
    this.#dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

    this.#scroller = document.createElement('div');
    this.#scroller.className = 'pn-pdf';
    this.#scroller.tabIndex = 0;
    this.#scroller.setAttribute('role', 'document');
    this.#scroller.setAttribute('aria-label', 'PDF pages');
    this.#surface = document.createElement('div');
    this.#surface.className = 'pn-pdf-surface';
    this.#scroller.append(this.#surface);
    this.#host.append(this.#scroller);

    this.#layout = new PageLayout({
      pageCount: this.#pageCount,
      estimate: { width: 595, height: 842 },
      viewportWidth: this.#host.clientWidth || 800,
      columns: this.#columnsFor(),
      gap: 8,
    });
    this.#lastPosition = this.#computePosition(init.start);
    this.applyAppearanceSync(init.appearance);
    this.#wire();
  }

  /** Measure the first pages, lay out, scroll to the saved spot and resolve when something is on screen. */
  async start(start: PageAnchor, signal?: AbortSignal): Promise<void> {
    const first = await this.#getPage(start.page);
    const vp = first.getViewport({ scale: 1 });
    this.#layout.setPageSize(start.page, vp.width, vp.height);
    if (!this.#layout.hasSize(1)) {
      const p1 = await this.#getPage(1);
      const v1 = p1.getViewport({ scale: 1 });
      this.#layout.setPageSize(1, v1.width, v1.height);
      this.#estimateFrom(v1.width, v1.height);
    } else {
      this.#estimateFrom(vp.width, vp.height);
    }
    throwIfAborted(signal);
    this.#relayout(start);
    this.#scroller.scrollTop = this.#layout.yOf(start);
    this.#update();
    await this.#whenRendered(start.page, 4000);
    this.#restoring = false;
    this.#emitPosition();
    void this.#loadMetadata();
    void this.#loadOutline();
    window.setTimeout(() => void this.#measureAllPages(), 250);
  }

  // ---- ReaderDocument ----

  get toc(): readonly TocItem[] {
    return this.#toc;
  }

  position(): ReaderPosition {
    return this.#lastPosition;
  }

  async goTo(locator: Locator): Promise<void> {
    let anchor: PageAnchor | undefined;
    if (locator.kind === 'page') anchor = { page: locator.page, offset: locator.offset };
    else if (locator.kind === 'reflow') anchor = await this.#anchorForOffset(locator.section + 1, locator.textOffset);
    if (!anchor) return;
    anchor = { page: Math.min(Math.max(1, anchor.page), this.#pageCount), offset: anchor.offset };
    this.#scrollToAnchor(anchor, false);
    await this.#whenRendered(anchor.page, 2500);
  }

  async goToRange(range: TextRange): Promise<void> {
    const start = range.start;
    if (start.kind !== 'reflow') return;
    const anchor = await this.#anchorForOffset(start.section + 1, start.textOffset);
    const box = this.#layout.boxOf(anchor.page);
    const target = box.y + anchor.offset * box.height - this.#scroller.clientHeight * 0.3;
    this.#scroller.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
    this.#update();
    await this.#whenRendered(anchor.page, 2500);
  }

  async goToFraction(fraction: number): Promise<void> {
    const f = Math.min(1, Math.max(0, fraction)) * this.#pageCount;
    const page = Math.min(this.#pageCount, Math.floor(f) + 1);
    await this.goTo({ kind: 'page', page, offset: Math.min(1, f - Math.floor(f)) });
  }

  async next(): Promise<boolean> {
    return this.#advance(1);
  }

  async prev(): Promise<boolean> {
    return this.#advance(-1);
  }

  /** Page turn: finish the page you are on screen by screen, then land on the next page's top. */
  #advance(dir: 1 | -1): boolean {
    const s = this.#scroller;
    const height = s.clientHeight;
    const top = s.scrollTop;
    const bottom = top + height;
    const anchor = this.#layout.anchorAt(top + 2);
    const box = this.#layout.boxOf(anchor.page);
    let target: number;
    if (dir === 1) {
      if (box.y + box.height > bottom + 24) target = Math.min(top + height * 0.9, box.y + box.height - height * 0.2);
      else {
        const nextRow = this.#layout.rowOf(anchor.page) + 1;
        const nextPage = nextRow * this.#layout.columns + 1;
        if (nextPage > this.#pageCount) return false;
        target = this.#layout.boxOf(nextPage).y - 4;
      }
    } else if (top > box.y + 24) {
      target = Math.max(box.y - 4, top - height * 0.9);
    } else {
      const prevRow = this.#layout.rowOf(anchor.page) - 1;
      if (prevRow < 0) return top > 0 ? (this.#scrollTo(0), true) : false;
      const prevPage = prevRow * this.#layout.columns + 1;
      const pb = this.#layout.boxOf(prevPage);
      target = Math.max(pb.y - 4, pb.y + pb.height - height * 0.95);
    }
    this.#scrollTo(Math.max(0, target));
    return true;
  }

  #scrollTo(top: number): void {
    const instant = prefersReducedMotion() || this.#appearance.pageTurn === 'none';
    this.#scroller.scrollTo({ top, behavior: instant ? 'auto' : 'smooth' });
  }

  async applyAppearance(appearance: ReaderAppearance): Promise<void> {
    this.applyAppearanceSync(appearance);
  }

  applyAppearanceSync(appearance: ReaderAppearance): void {
    this.#appearance = appearance;
    const tint = pdfTint(appearance);
    const colors = themeColors(appearance);
    const style = this.#scroller.style;
    style.setProperty('--pn-pdf-bg', colors.page);
    style.setProperty('--pn-pdf-page-bg', tint.background);
    style.setProperty('--pn-pdf-filter', tint.filter);
    style.setProperty('--pn-pdf-blend', tint.blend);
    style.setProperty('--pn-pdf-accent', colors.accent);
    this.#scroller.dataset['theme'] = appearance.theme;
  }

  async *search(query: string, signal?: AbortSignal): AsyncGenerator<SearchHit> {
    for (let page = 1; page <= this.#pageCount; page++) {
      if (signal?.aborted || this.#closed) return;
      const text = await this.#pageText(page);
      for (const hit of searchText(text.text, query, (offset) => reflowAt(page - 1, offset))) yield hit;
      if (page % 8 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  selection(): ReaderSelection | undefined {
    return this.#readSelection();
  }

  showHighlight(id: string, range: TextRange, color: HighlightColor): void {
    this.#highlights.set(id, { id, range, color });
    this.#redrawHighlights();
  }

  hideHighlight(id: string): void {
    if (this.#highlights.delete(id)) this.#redrawHighlights();
  }

  showSearchHits(ranges: readonly TextRange[]): void {
    this.#hits = ranges;
    this.#redrawHighlights();
  }

  onPositionChange(listener: (position: ReaderPosition) => void): Unsubscribe {
    return this.#position.on(listener);
  }

  onSelectionChange(listener: (selection: ReaderSelection | undefined) => void): Unsubscribe {
    return this.#selection.on(listener);
  }

  onTap(listener: (zone: 'left' | 'center' | 'right') => void): Unsubscribe {
    return this.#taps.on(listener);
  }

  onKey(listener: (event: KeyboardLike) => void): Unsubscribe {
    return this.#keys.on(listener);
  }

  onHighlightTap(listener: (id: string) => void): Unsubscribe {
    return this.#hlTaps.on(listener);
  }

  onTocChange(listener: () => void): Unsubscribe {
    return this.#tocChange.on(listener);
  }

  chapterTicks(): readonly number[] {
    return this.#toc.map((t) => (t.locator.kind === 'page' ? (t.locator.page - 1) / this.#pageCount : 0));
  }

  currentLabel(): string {
    const p = this.#lastPosition;
    return p.chapterTitle ? `${p.chapterTitle}, page ${p.page}` : `Page ${p.page}`;
  }

  minutesLeft(): number | undefined {
    return undefined;
  }

  selectionRect(): DOMRect | undefined {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return undefined;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const host = this.#host.getBoundingClientRect();
    return new DOMRect(rect.left - host.left, rect.top - host.top, rect.width, rect.height);
  }

  clearSelection(): void {
    document.getSelection()?.removeAllRanges();
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    window.clearTimeout(this.#scrollIdleTimer);
    for (const off of this.#cleanups.splice(0)) off();
    this.#queue.close();
    for (const view of this.#views.values()) this.#disposeView(view);
    this.#views.clear();
    this.#scroller.remove();
    for (const emitter of [this.#position, this.#selection, this.#taps, this.#keys, this.#hlTaps, this.#tocChange]) emitter.clear();
    this.#destroyLoading();
    await this.#pdf.destroy().catch(() => undefined);
  }

  // ---- layout and rendering ----

  #columnsFor(): number {
    const w = this.#host.clientWidth;
    return w >= 1000 && w > this.#host.clientHeight ? 2 : 1;
  }

  #estimateFrom(width: number, height: number): void {
    // Most pages of a document share one size: use the first real one for the rest until they are measured.
    this.#layout.setEstimate(width, height);
  }

  #relayout(keep: PageAnchor): void {
    this.#layout.setViewportWidth(this.#host.clientWidth || 800);
    this.#layout.setColumns(this.#columnsFor());
    this.#layout.recompute();
    this.#surface.style.width = `${this.#layout.totalWidth}px`;
    this.#surface.style.height = `${this.#layout.totalHeight}px`;
    const y = this.#layout.yOf(keep);
    if (Math.abs(this.#scroller.scrollTop - y) > 0.5) this.#scroller.scrollTop = y;
  }

  #update(): void {
    if (this.#closed) return;
    const s = this.#scroller;
    const top = s.scrollTop;
    const bottom = top + s.clientHeight;
    const vh = s.clientHeight;
    const domPages = new Set(this.#layout.visiblePages(top, bottom, vh * 1.2));
    const renderPages = new Set(this.#layout.visiblePages(top, bottom, vh * 0.5));
    const readPages = new Set(this.#layout.visiblePages(top, bottom, 0));
    const focus = this.#layout.anchorAt(top + vh / 3).page;

    for (const [page, view] of [...this.#views]) {
      if (!domPages.has(page)) {
        this.#disposeView(view);
        this.#views.delete(page);
      }
    }
    for (const page of domPages) {
      const view = this.#views.get(page) ?? this.#createView(page);
      this.#placeView(view);
      if (!renderPages.has(page)) continue;
      this.#ensureTiles(view, top, bottom, Math.abs(page - focus));
      if (readPages.has(page)) {
        void this.#ensureText(view, Math.abs(page - focus));
        void this.#ensureLinks(view);
      }
    }
    this.#queue.cancelWhere((key) => {
      const page = Number(key.split(':', 2)[1]);
      return !renderPages.has(page);
    });
  }

  #createView(page: number): PageView {
    const el = document.createElement('div');
    el.className = 'pn-pdf-page';
    el.dataset['page'] = String(page);
    el.setAttribute('aria-label', `Page ${page}`);
    const hl = document.createElement('div');
    hl.className = 'pn-pdf-hl';
    const text = document.createElement('div');
    text.className = 'pn-pdf-text textLayer';
    const links = document.createElement('div');
    links.className = 'pn-pdf-links';
    el.append(hl, text, links);
    this.#surface.append(el);
    const view: PageView = { page, el, tiles: new Map(), hl, text, links };
    this.#views.set(page, view);
    return view;
  }

  #placeView(view: PageView): void {
    const box = this.#layout.boxOf(view.page);
    const st = view.el.style;
    st.left = `${box.x}px`;
    st.top = `${box.y}px`;
    st.width = `${box.width}px`;
    st.height = `${box.height}px`;
    // Stretch tiles drawn at another scale until a sharp one arrives (no white flash while zooming).
    const want = box.scale * this.#dpr;
    for (const t of view.tiles.values()) {
      const ratio = want / t.deviceScale;
      const cs = t.canvas.style;
      cs.left = `${(t.tile.x * ratio) / this.#dpr}px`;
      cs.top = `${(t.tile.y * ratio) / this.#dpr}px`;
      cs.width = `${(t.tile.width * ratio) / this.#dpr}px`;
      cs.height = `${(t.tile.height * ratio) / this.#dpr}px`;
    }
  }

  #disposeView(view: PageView): void {
    this.#queue.cancelWhere((k) => k.startsWith(`t:${view.page}:`) || k === `x:${view.page}`);
    view.textLayer?.cancel();
    for (const t of view.tiles.values()) {
      t.canvas.width = 0;
      t.canvas.height = 0;
    }
    view.el.remove();
    void this.#pages.get(view.page)?.then((p) => p.cleanup());
  }

  #ensureTiles(view: PageView, top: number, bottom: number, distance: number): void {
    const box = this.#layout.boxOf(view.page);
    const deviceScale = box.scale * this.#dpr;
    const scaleKey = deviceScale.toFixed(4);
    const margin = (bottom - top) * 0.25;
    const left = this.#scroller.scrollLeft;
    const right = left + this.#scroller.clientWidth;
    const visible = {
      left: (left - box.x - margin) * this.#dpr,
      right: (right - box.x + margin) * this.#dpr,
      top: (top - box.y - margin) * this.#dpr,
      bottom: (bottom - box.y + margin) * this.#dpr,
    };
    const tiles = planTiles(box.width * this.#dpr, box.height * this.#dpr, visible, MAX_TILE_DEVICE_PX);
    const wanted = new Set<string>();
    for (const tile of tiles) {
      const tileId = `${tile.ix},${tile.iy}`;
      const key = `t:${view.page}:${scaleKey}:${tileId}`;
      wanted.add(key);
      const existing = view.tiles.get(tileId);
      if (existing && existing.key === key) continue;
      void this.#queue.enqueue({
        key,
        priority: distance,
        run: (signal) => this.#renderTile(view, tile, tileId, key, deviceScale, signal),
      });
    }
    // Drop canvases that are far outside the wanted band (but keep stale-scale ones until replaced).
    for (const [tileId, t] of [...view.tiles]) {
      const outside = !tiles.some((p) => `${p.ix},${p.iy}` === tileId);
      if (outside) {
        t.canvas.remove();
        t.canvas.width = 0;
        t.canvas.height = 0;
        view.tiles.delete(tileId);
      }
    }
  }

  async #renderTile(view: PageView, tile: Tile, tileId: string, key: string, deviceScale: number, signal: AbortSignal): Promise<void> {
    const page = await this.#getPage(view.page);
    if (signal.aborted || this.#closed) return;
    const canvas = document.createElement('canvas');
    canvas.width = tile.width;
    canvas.height = tile.height;
    canvas.className = 'pn-pdf-canvas';
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const viewport = page.getViewport({ scale: deviceScale });
    const task = page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      transform: [1, 0, 0, 1, -tile.x, -tile.y],
      background: '#ffffff',
    });
    const onAbort = (): void => task.cancel();
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      await task.promise;
    } catch {
      canvas.width = 0;
      return; // cancelled or the page failed; the page stays blank rather than breaking the others
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
    if (signal.aborted || this.#closed || !this.#views.has(view.page)) {
      canvas.width = 0;
      return;
    }
    const old = view.tiles.get(tileId);
    view.el.insertBefore(canvas, view.hl);
    if (old) {
      old.canvas.remove();
      old.canvas.width = 0;
    }
    view.tiles.set(tileId, { canvas, tile, deviceScale, key });
    this.#placeView(view);
    view.el.dataset['rendered'] = 'true';
    const waiters = this.#rendered.get(view.page);
    if (waiters) {
      this.#rendered.delete(view.page);
      for (const done of waiters) done();
    }
  }

  async #ensureText(view: PageView, distance: number): Promise<void> {
    const box = this.#layout.boxOf(view.page);
    if (view.textScale === box.scale || view.textBusy) return;
    if (!view.tiles.size) return; // draw the picture first
    view.textBusy = true;
    const scale = box.scale;
    try {
      await this.#queue.enqueue({
        key: `x:${view.page}`,
        priority: distance + 0.5,
        run: async (signal) => {
          const [page, lib] = await Promise.all([this.#getPage(view.page), import('pdfjs-dist')]);
          if (signal.aborted || this.#closed || !this.#views.has(view.page)) return;
          view.textLayer?.cancel();
          view.text.replaceChildren();
          const viewport = page.getViewport({ scale });
          view.text.style.setProperty('--scale-factor', String(scale));
          view.text.style.setProperty('--user-unit', '1');
          view.text.style.setProperty('--total-scale-factor', String(scale));
          const layer = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: view.text, viewport });
          view.textLayer = layer;
          signal.addEventListener('abort', () => layer.cancel(), { once: true });
          await layer.render();
          if (signal.aborted) return;
          view.textDivs = layer.textDivs;
          view.textScale = scale;
          layer.textDivs.forEach((d, i) => (d.dataset['i'] = String(i)));
          await this.#drawHighlightsOn(view);
        },
      });
    } finally {
      view.textBusy = false;
    }
  }

  async #ensureLinks(view: PageView): Promise<void> {
    const box = this.#layout.boxOf(view.page);
    if (view.linksScale === box.scale) return;
    view.linksScale = box.scale;
    try {
      const page = await this.#getPage(view.page);
      const annotations = await page.getAnnotations({ intent: 'display' });
      if (!this.#views.has(view.page) || this.#closed) return;
      const viewport = page.getViewport({ scale: box.scale });
      view.links.replaceChildren();
      for (const a of annotations as Array<{ subtype?: string; rect?: number[]; url?: string; dest?: unknown; unsafeUrl?: string }>) {
        if (a.subtype !== 'Link' || !a.rect) continue;
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect) as [number, number, number, number];
        const link = document.createElement('a');
        link.className = 'pn-pdf-link';
        link.style.left = `${Math.min(x1, x2)}px`;
        link.style.top = `${Math.min(y1, y2)}px`;
        link.style.width = `${Math.abs(x2 - x1)}px`;
        link.style.height = `${Math.abs(y2 - y1)}px`;
        if (a.url) {
          link.href = a.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.setAttribute('aria-label', `Link to ${a.url}`);
        } else if (a.dest) {
          link.href = '#';
          link.setAttribute('aria-label', 'Link to another page');
          link.addEventListener('click', (event) => {
            event.preventDefault();
            void this.#goToDest(a.dest);
          });
        } else continue;
        view.links.append(link);
      }
    } catch {
      view.linksScale = undefined;
    }
  }

  async #goToDest(dest: unknown): Promise<void> {
    const index = await this.#destToPageIndex(dest);
    if (index !== undefined) await this.goTo({ kind: 'page', page: index + 1, offset: 0 });
  }

  async #destToPageIndex(dest: unknown): Promise<number | undefined> {
    try {
      const explicit = typeof dest === 'string' ? await this.#pdf.getDestination(dest) : (dest as unknown[] | null);
      const target = explicit?.[0];
      if (typeof target === 'number') return target;
      if (target && typeof target === 'object') return await this.#pdf.getPageIndex(target as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
    } catch {
      /* a broken destination just does nothing */
    }
    return undefined;
  }

  // ---- pages, text, metadata ----

  #getPage(page: number): Promise<PDFPageProxy> {
    let p = this.#pages.get(page);
    if (!p) {
      p = this.#pdf.getPage(page);
      this.#pages.set(page, p);
      p.catch(() => this.#pages.delete(page));
    }
    return p;
  }

  #pageText(page: number): Promise<PageText> {
    let t = this.#texts.get(page);
    if (!t) {
      t = this.#getPage(page).then(async (p) => {
        const built = buildPageText((await p.getTextContent()).items as Array<{ str?: string; hasEOL?: boolean; transform?: number[] }>);
        this.#resolvedTexts.set(page, built);
        return built;
      });
      this.#texts.set(page, t);
      if (this.#texts.size > PAGE_TEXT_CACHE) {
        const oldest = this.#texts.keys().next().value;
        if (oldest !== undefined && oldest !== page) {
          this.#texts.delete(oldest);
          this.#resolvedTexts.delete(oldest);
        }
      }
    }
    return t;
  }

  async #anchorForOffset(page: number, offset: number): Promise<PageAnchor> {
    const p = Math.min(Math.max(1, page), this.#pageCount);
    try {
      const [text, pdfPage] = await Promise.all([this.#pageText(p), this.#getPage(p)]);
      const items = text.items;
      let index = items.findIndex((i) => i.offset + i.length > offset);
      if (index < 0) index = items.length - 1;
      const item = items[index];
      if (!item) return { page: p, offset: 0 };
      const vp = pdfPage.getViewport({ scale: 1 });
      const [, y] = vp.convertToViewportPoint(item.x, item.y);
      return { page: p, offset: Math.min(1, Math.max(0, (y - 12) / vp.height)) };
    } catch {
      return { page: p, offset: 0 };
    }
  }

  async #loadMetadata(): Promise<void> {
    try {
      const info = (await this.#pdf.getMetadata()).info as Record<string, unknown> | undefined;
      const title = typeof info?.['Title'] === 'string' ? (info['Title'] as string).trim() : '';
      const author = typeof info?.['Author'] === 'string' ? (info['Author'] as string).trim() : '';
      this.metadata = { ...(title ? { title } : {}), ...(author ? { author } : {}), pages: this.#pageCount };
    } catch {
      this.metadata = { pages: this.#pageCount };
    }
  }

  async #loadOutline(): Promise<void> {
    try {
      const outline = await this.#pdf.getOutline();
      if (!outline?.length) return;
      type Node = { title: string; dest: unknown; items?: Node[] };
      const convert = async (nodes: Node[], depth: number): Promise<TocItem[]> => {
        const items: TocItem[] = [];
        for (const n of nodes) {
          if (this.#closed) return items;
          const index = n.dest ? await this.#destToPageIndex(n.dest) : undefined;
          const children = n.items?.length && depth < 4 ? await convert(n.items, depth + 1) : [];
          if (index === undefined && !children.length) continue;
          const page = index === undefined ? ((children[0]?.locator as { page?: number } | undefined)?.page ?? 1) : index + 1;
          items.push({ title: n.title.trim() || `Page ${page}`, locator: { kind: 'page', page, offset: 0 }, ...(children.length ? { children } : {}) });
        }
        return items;
      };
      this.#toc = await convert(outline as Node[], 0);
      this.#emitPosition();
      this.#tocChange.emit();
    } catch {
      /* no usable outline: the scrubber and page numbers still work */
    }
  }

  async #measureAllPages(): Promise<void> {
    for (let page = 1; page <= this.#pageCount && !this.#closed; page++) {
      if (this.#layout.hasSize(page)) continue;
      try {
        const p = await this.#getPage(page);
        const vp = p.getViewport({ scale: 1 });
        if (this.#layout.setPageSize(page, vp.width, vp.height)) this.#pendingSizes = true;
      } catch {
        /* an unreadable page keeps the estimate */
      }
      if (page % 6 === 0) {
        this.#applyPendingSizes();
        await new Promise<void>((r) => setTimeout(r, 16));
      }
    }
    this.#applyPendingSizes();
  }

  #applyPendingSizes(): void {
    if (!this.#pendingSizes || this.#scrolling || this.#closed) return;
    this.#pendingSizes = false;
    const keep = this.#layout.anchorAt(this.#scroller.scrollTop);
    this.#relayout(keep);
    this.#update();
  }

  #whenRendered(page: number, timeoutMs: number): Promise<void> {
    if (this.#views.get(page)?.el.dataset['rendered'] === 'true') return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = (): void => {
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(() => {
        const list = this.#rendered.get(page);
        if (list) this.#rendered.set(page, list.filter((f) => f !== done));
        resolve();
      }, timeoutMs);
      const list = this.#rendered.get(page) ?? [];
      list.push(done);
      this.#rendered.set(page, list);
    });
  }

  // ---- position ----

  #scrollToAnchor(anchor: PageAnchor, smooth: boolean): void {
    this.#restoring = false;
    const top = this.#layout.yOf(anchor);
    this.#scroller.scrollTo({ top, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
    this.#update();
    this.#emitPosition();
  }

  #computePosition(anchor: PageAnchor): ReaderPosition {
    const page = Math.min(this.#pageCount, Math.max(1, anchor.page));
    const percent = (((page - 1) + anchor.offset) / this.#pageCount) * 100;
    const chapter = this.#chapterAt(page);
    return {
      locator: { kind: 'page', page, offset: Math.round(anchor.offset * 10000) / 10000 },
      percent: Math.min(100, Math.max(0, percent)),
      page,
      pageCount: this.#pageCount,
      ...(chapter ? { chapterTitle: chapter } : {}),
    };
  }

  #chapterAt(page: number): string | undefined {
    let found: string | undefined;
    const walk = (items: readonly TocItem[]): void => {
      for (const item of items) {
        if (item.locator.kind === 'page' && item.locator.page <= page) found = item.title;
        if (item.children) walk(item.children);
      }
    };
    walk(this.#toc);
    return found;
  }

  #emitPosition(): void {
    if (this.#closed || this.#restoring) return;
    const anchor = this.#layout.anchorAt(this.#scroller.scrollTop);
    const next = this.#computePosition(anchor);
    this.#lastPosition = next;
    this.#position.emit(next);
  }

  // ---- zoom ----

  #setZoom(zoom: number, focus?: { x: number; y: number }): void {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    if (Math.abs(z - this.#layout.zoom) < 0.001) return;
    const s = this.#scroller;
    const anchor = this.#layout.anchorAt(s.scrollTop);
    const oldWidth = this.#layout.totalWidth;
    const fx = focus ? (s.scrollLeft + focus.x) / oldWidth : (s.scrollLeft + s.clientWidth / 2) / oldWidth;
    this.#layout.setZoom(z);
    this.#relayout(anchor);
    s.scrollLeft = Math.max(0, fx * this.#layout.totalWidth - (focus ? focus.x : s.clientWidth / 2));
    this.#update();
    this.#emitPosition();
  }

  // ---- input ----

  #wire(): void {
    const s = this.#scroller;
    const throttled = frameThrottle(() => {
      this.#update();
      this.#emitPosition();
    });
    const onScroll = (): void => {
      this.#scrolling = true;
      window.clearTimeout(this.#scrollIdleTimer);
      this.#scrollIdleTimer = window.setTimeout(() => {
        this.#scrolling = false;
        this.#applyPendingSizes();
      }, 180);
      if (this.#restoring) return;
      throttled();
    };
    s.addEventListener('scroll', onScroll, { passive: true });
    this.#cleanups.push(() => {
      s.removeEventListener('scroll', onScroll);
      throttled.cancel();
    });

    const ro = new ResizeObserver(() => {
      if (this.#closed || !this.#host.clientWidth) return;
      const keep = this.#layout.anchorAt(s.scrollTop);
      this.#relayout(keep);
      this.#update();
    });
    ro.observe(this.#host);
    this.#cleanups.push(() => ro.disconnect());

    // Taps, double-tap zoom and pinch.
    const pointers = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; t: number; id: number } | undefined;
    let pinch: { dist: number; zoom: number; cx: number; cy: number } | undefined;
    const rectOf = (): DOMRect => s.getBoundingClientRect();
    const onDown = (e: PointerEvent): void => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
      else {
        down = undefined;
        const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const r = rectOf();
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.#layout.zoom, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
      }
    };
    const onMove = (e: PointerEvent): void => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const ratio = Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist;
        const live = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.zoom * ratio)) / this.#layout.zoom;
        this.#surface.style.transformOrigin = `${s.scrollLeft + pinch.cx}px ${s.scrollTop + pinch.cy}px`;
        this.#surface.style.transform = `scale(${live})`;
      }
    };
    const onUp = (e: PointerEvent): void => {
      const wasPinch = pinch !== undefined;
      pointers.delete(e.pointerId);
      if (pinch && pointers.size < 2) {
        const m = /scale\(([\d.]+)\)/.exec(this.#surface.style.transform);
        const live = m ? Number(m[1]) : 1;
        const focus = { x: pinch.cx, y: pinch.cy };
        this.#surface.style.transform = '';
        this.#surface.style.transformOrigin = '';
        this.#setZoom(this.#layout.zoom * live, focus);
        pinch = undefined;
      }
      if (wasPinch || !down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = e.timeStamp - down.t < TAP_MAX_MS;
      const start = down;
      down = undefined;
      if (moved > TAP_MOVE_PX || !quick) return;
      if (!document.getSelection()?.isCollapsed) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('a')) return;
      const r = rectOf();
      const x = start.x - r.left;
      if (e.timeStamp - this.#lastTap.time < DOUBLE_TAP_MS && Math.hypot(start.x - this.#lastTap.x, start.y - this.#lastTap.y) < 40) {
        this.#lastTap.time = 0;
        this.#setZoom(this.#layout.zoom > 1.05 ? 1 : 2.5, { x, y: start.y - r.top });
        return;
      }
      this.#lastTap = { time: e.timeStamp, x: start.x, y: start.y };
      const hit = this.#highlightAt(start.x, start.y);
      if (hit) {
        this.#hlTaps.emit(hit);
        return;
      }
      const third = r.width / 3;
      this.#taps.emit(x < third ? 'left' : x > third * 2 ? 'right' : 'center');
    };
    const onCancel = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = undefined;
      this.#surface.style.transform = '';
      down = undefined;
    };
    s.addEventListener('pointerdown', onDown);
    s.addEventListener('pointermove', onMove);
    s.addEventListener('pointerup', onUp);
    s.addEventListener('pointercancel', onCancel);
    this.#cleanups.push(() => {
      s.removeEventListener('pointerdown', onDown);
      s.removeEventListener('pointermove', onMove);
      s.removeEventListener('pointerup', onUp);
      s.removeEventListener('pointercancel', onCancel);
    });

    // Ctrl or pinch on a trackpad zooms too.
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = rectOf();
      this.#setZoom(this.#layout.zoom * Math.exp(-e.deltaY * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    s.addEventListener('wheel', onWheel, { passive: false });
    this.#cleanups.push(() => s.removeEventListener('wheel', onWheel));

    const onSelection = (): void => {
      const sel = this.#readSelection();
      const key = sel ? JSON.stringify(sel.range) : '';
      if (key === this.#lastSelectionKey) return;
      this.#lastSelectionKey = key;
      this.#selection.emit(sel);
    };
    const throttledSelection = frameThrottle(onSelection);
    document.addEventListener('selectionchange', throttledSelection);
    this.#cleanups.push(() => {
      document.removeEventListener('selectionchange', throttledSelection);
      throttledSelection.cancel();
    });
  }

  #highlightAt(clientX: number, clientY: number): string | undefined {
    for (const view of this.#views.values()) {
      for (const rect of view.hl.querySelectorAll<HTMLElement>('[data-hl-id]')) {
        const r = rect.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return rect.dataset['hlId'];
      }
    }
    return undefined;
  }

  // ---- selection and highlights ----

  #readSelection(): ReaderSelection | undefined {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return undefined;
    const range = sel.getRangeAt(0);
    if (!this.#scroller.contains(range.commonAncestorContainer)) return undefined;
    const start = this.#pointToLocator(range.startContainer, range.startOffset);
    const end = this.#pointToLocator(range.endContainer, range.endOffset);
    if (!start || !end) return undefined;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text) return undefined;
    return { range: { start, end }, text };
  }

  #pointToLocator(container: Node, offset: number): Locator | undefined {
    const el = container.nodeType === 3 ? container.parentElement : (container as Element);
    const pageEl = el?.closest<HTMLElement>('.pn-pdf-page');
    if (!pageEl) return undefined;
    const page = Number(pageEl.dataset['page']);
    if (!this.#views.has(page)) return undefined;
    const div = el?.closest<HTMLElement>('[data-i]');
    const text = this.#resolvedTexts.get(page);
    if (!text) return undefined;
    if (!div) {
      const first = text.items[0];
      return reflowAt(page - 1, offset === 0 && first ? 0 : text.text.length);
    }
    const index = Number(div.dataset['i']);
    const chars = container.nodeType === 3 ? offset : offset > 0 ? (text.items[index]?.str.length ?? 0) : 0;
    return reflowAt(page - 1, offsetOfItemChar(text.items, index, chars));
  }

  #redrawHighlights(): void {
    for (const view of this.#views.values()) void this.#drawHighlightsOn(view);
  }

  async #drawHighlightsOn(view: PageView): Promise<void> {
    if (!view.textDivs) return;
    const text = await this.#pageText(view.page);
    view.hl.replaceChildren();
    const parts: Array<{ id: string; color: string; alpha: number; start: number; end: number }> = [];
    for (const h of this.#highlights.values()) {
      for (const p of sectionsOfRange(h.range)) {
        if (p.section === view.page - 1) parts.push({ id: h.id, color: HIGHLIGHT_FILL[h.color], alpha: HIGHLIGHT_ALPHA, start: p.start, end: Math.min(p.end, text.text.length) });
      }
    }
    for (const [i, r] of this.#hits.entries()) {
      for (const p of sectionsOfRange(r)) {
        if (p.section === view.page - 1) parts.push({ id: `hit-${i}`, color: themeColors(this.#appearance).accent, alpha: 0.35, start: p.start, end: Math.min(p.end, text.text.length) });
      }
    }
    if (!parts.length) return;
    const pageRect = view.el.getBoundingClientRect();
    const zoomRatio = pageRect.width / (view.el.offsetWidth || 1);
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      for (const span of spansForRange(text.items, part.start, part.end)) {
        const div = view.textDivs[span.index];
        const node = div?.firstChild;
        if (!div || !node || node.nodeType !== 3) continue;
        const range = document.createRange();
        range.setStart(node, Math.min(span.from, (node as Text).length));
        range.setEnd(node, Math.min(span.to, (node as Text).length));
        for (const rect of range.getClientRects()) {
          const box = document.createElement('div');
          box.className = 'pn-pdf-hl-rect';
          box.dataset['hlId'] = part.id;
          box.style.left = `${(rect.left - pageRect.left) / zoomRatio}px`;
          box.style.top = `${(rect.top - pageRect.top) / zoomRatio}px`;
          box.style.width = `${rect.width / zoomRatio}px`;
          box.style.height = `${rect.height / zoomRatio}px`;
          box.style.background = part.color;
          box.style.opacity = String(part.alpha);
          frag.append(box);
        }
      }
    }
    view.hl.append(frag);
  }
}

