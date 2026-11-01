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
import { HIGHLIGHT_ALPHA, HIGHLIGHT_FILL, marginHints, reflowCss, themeColors } from '@/features/reader/core/appearance';
import { Emitter } from '@/features/reader/core/emitter';
import type { KeyboardLike, ReaderDocumentExt } from '@/features/reader/core/ext-types';
import { reflowAt, sectionsOfRange } from '@/features/reader/core/ranges';
import { searchText } from '@/features/reader/core/search';
import { findFirstVisibleOffset, firstVisibleOffset, offsetsOfRange, rangeFromOffsets, sectionText } from '@/features/reader/core/text-offsets';
import { prefersReducedMotion } from '@/ui/utils/motion';

// foliate-js is untyped; these are the members of its view and renderer that are used here.
interface FoliateRenderer extends HTMLElement {
  setStyles(css: string | string[]): void;
  getContents(): Array<{ index: number; overlayer?: Overlayer; doc: Document }>;
  goTo(target: { index: number; anchor?: unknown }): Promise<void>;
  next(): Promise<void>;
  prev(): Promise<void>;
  /** Scroll offset of the visible page (a column or a scroll position), in the paginator's own units. */
  start?: number;
  size?: number;
  scrolled?: boolean;
  atStart?: boolean;
  atEnd?: boolean;
}
const SETTLE_MS = 1500;
/** How long a page rests before its start is checked again (layout can still be moving while pictures load). */
const REFINE_MS = 450;

interface Overlayer {
  add(key: string, range: Range, draw: (rects: unknown[], options?: Record<string, unknown>) => SVGElement, options?: Record<string, unknown>): void;
  remove(key: string): void;
  redraw(): void;
}
interface FoliateRelocate {
  index?: number;
  fraction?: number;
  range?: Range;
  cfi?: string;
  tocItem?: { label?: string } | null;
  section?: { current: number; total: number };
  time?: { section: number; total: number };
}
interface FoliateView extends HTMLElement {
  renderer: FoliateRenderer;
  book: FoliateBook;
  lastLocation?: FoliateRelocate;
  open(book: FoliateBook): Promise<void>;
  init(options: { lastLocation?: unknown; showTextStart?: boolean }): Promise<void>;
  close(): void;
  goTo(target: unknown): Promise<unknown>;
  goToFraction(fraction: number): Promise<void>;
  next(): Promise<void>;
  prev(): Promise<void>;
  resolveNavigation(target: unknown): { index: number; anchor?: unknown } | undefined;
  getSectionFractions(): number[];
}

export interface FoliateDocumentInit {
  readonly book: FoliateBook;
  readonly host: HTMLElement;
  readonly appearance: ReaderAppearance;
  readonly fixed: boolean;
  readonly onUnmount?: () => void;
}

/** Section index of a `relocate` event: foliate's progress puts it in `section.current`. */
export function sectionIndexOf(detail: FoliateRelocate): number | undefined {
  const i = detail.section?.current ?? detail.index;
  return typeof i === 'number' && Number.isInteger(i) && i >= 0 ? i : undefined;
}

const TAP_MAX_MS = 450;
const SEARCH_PREFIX = 'foliate-search:';
const HL_PREFIX = 'pn-hl:';
const NOTEREF = /noteref|footnote/i;

/** Text of a value foliate may give as a string, a list, a `{name}` object or a language map. */
export function metaText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) return value.map(metaText).filter(Boolean).join(', ') || undefined;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('name' in obj) return metaText(obj['name']);
    const first = Object.values(obj)[0];
    return metaText(first);
  }
  return undefined;
}

/** One open reflowable or comic book on top of foliate-js (paginator or fixed layout). */
export class FoliateReaderDocument implements ReaderDocumentExt {
  readonly layout: 'fixed' | 'reflow';
  readonly direction: 'ltr' | 'rtl';
  metadata: DocumentMetadata = {};
  #toc: readonly TocItem[] = [];
  #ticks: readonly number[] = [];
  readonly #tocHrefs = new WeakMap<object, string>();

  readonly #view: FoliateView;
  readonly #book: FoliateBook;
  readonly #host: HTMLElement;
  readonly #fixed: boolean;
  #appearance: ReaderAppearance;
  #lastPosition: ReaderPosition;
  #closed = false;
  readonly #position = new Emitter<ReaderPosition>();
  readonly #selection = new Emitter<ReaderSelection | undefined>();
  readonly #wordTap = new Emitter<{ word: string; anchor: DOMRect }>();
  readonly #taps = new Emitter<'left' | 'center' | 'right'>();
  readonly #keys = new Emitter<KeyboardLike>();
  readonly #hlTaps = new Emitter<string>();
  readonly #images = new Emitter<{ src: string; alt: string }>();
  readonly #notes = new Emitter<{ text: string }>();
  readonly #tocChange = new Emitter<void>();
  readonly #highlights = new Map<string, { range: TextRange; color: HighlightColor }>();
  #hits: readonly TextRange[] = [];
  readonly #texts = new Map<number, Promise<string>>();
  readonly #cleanups: Array<() => void> = [];
  readonly #docs = new Set<Document>();
  #annotationTapAt = 0;
  #wordTapAt = 0;
  #lastIndex: number | undefined;
  #relocateSeq = 0;
  #lastSelectionKey = '';
  #firstRelocate: (() => void) | undefined;
  readonly zoom = undefined;

  constructor(view: FoliateView, init: FoliateDocumentInit) {
    this.#view = view;
    this.#book = init.book;
    this.#host = init.host;
    this.#fixed = init.fixed;
    this.#appearance = init.appearance;
    this.layout = init.fixed ? 'fixed' : 'reflow';
    this.direction = init.book.dir === 'rtl' ? 'rtl' : 'ltr';
    this.#lastPosition = { locator: init.fixed ? { kind: 'page', page: 1, offset: 0 } : reflowAt(0, 0), percent: 0 };
    if (init.onUnmount) this.#cleanups.push(init.onUnmount);
    this.#wire();
  }

  /** Called once by the engine after `view.open`. Resolves when the first page is on screen. */
  async start(locator: Locator | undefined): Promise<void> {
    this.#guardRender();
    this.#applyLayoutAttributes();
    this.applyStyles();
    this.#buildToc();
    const first = new Promise<void>((resolve) => {
      this.#firstRelocate = resolve;
      window.setTimeout(resolve, 6000);
    });
    const target = locator && this.#locatorToTarget(locator);
    if (target) {
      try {
        await this.#navigate(target);
      } catch {
        await this.#view.init({ showTextStart: true });
      }
    } else await this.#view.init({ showTextStart: !this.#fixed });
    await first;
    // The first scroll can run before pictures and fonts have their sizes, when the spot has no box yet. Once they do,
    // put the page on the saved spot again, so a reopened book shows exactly the page it was closed on.
    if (target && !this.#fixed && (await this.#layoutSettled(SETTLE_MS))) await this.#navigate(target).catch(() => undefined);
    this.#readMetadata();
  }

  /**
   * The paginator re-renders whenever its box changes size. If that happens while the next section's document is still
   * loading (no body yet), foliate throws from inside its resize observer. The section renders itself when it has
   * loaded, so a render attempted before that is safe to skip.
   */
  #guardRender(): void {
    const renderer = this.#view.renderer as FoliateRenderer & { render?: () => void };
    const render = renderer.render?.bind(renderer);
    if (!render) return;
    renderer.render = () => {
      try {
        render();
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
      }
    };
  }

  /** Waits (at most `ms`) for the open section's fonts and pictures to be ready. True when it did not time out. */
  async #layoutSettled(ms: number): Promise<boolean> {
    const doc = this.#view.renderer.getContents()[0]?.doc;
    if (!doc) return false;
    const pictures = Array.from(doc.images).filter((img) => !img.complete);
    const ready = Promise.all([doc.fonts?.ready, ...pictures.map((img) => img.decode().catch(() => undefined))]).then(() => true);
    return Promise.race([ready, new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), ms))]);
  }

  // ---- ReaderDocument ----

  get toc(): readonly TocItem[] {
    return this.#toc;
  }

  position(): ReaderPosition {
    return this.#lastPosition;
  }

  async goTo(locator: Locator): Promise<void> {
    const href = this.#tocHrefs.get(locator);
    if (href) {
      await this.#view.goTo(href);
      return;
    }
    const target = this.#locatorToTarget(locator);
    if (!target) return;
    await this.#navigate(target);
  }

  async goToRange(range: TextRange): Promise<void> {
    const start = range.start;
    if (start.kind !== 'reflow') return;
    const end = range.end.kind === 'reflow' && range.end.section === start.section ? range.end.textOffset : start.textOffset;
    await this.#view.renderer.goTo({ index: this.#clampIndex(start.section), anchor: (doc: Document) => rangeFromOffsets(doc, start.textOffset, end) });
  }

  async goToFraction(fraction: number): Promise<void> {
    const f = Math.min(1, Math.max(0, fraction));
    if (this.#fixed) {
      await this.#view.renderer.goTo({ index: this.#clampIndex(Math.round(f * (this.#book.sections.length - 1))) });
      return;
    }
    await this.#view.goToFraction(f);
  }

  async next(): Promise<boolean> {
    if (this.#atEnd()) return false;
    await this.#view.next();
    return true;
  }

  async prev(): Promise<boolean> {
    if (this.#atStart()) return false;
    await this.#view.prev();
    return true;
  }

  async applyAppearance(appearance: ReaderAppearance): Promise<void> {
    this.#appearance = appearance;
    this.#applyLayoutAttributes();
    this.applyStyles();
    // Highlights are drawn from text offsets, so they follow the text when the layout changes.
    window.setTimeout(() => this.#redrawOverlays(), 60);
  }

  async *search(query: string, signal?: AbortSignal): AsyncGenerator<SearchHit> {
    if (this.#fixed) return;
    const sections = this.#book.sections;
    for (let index = 0; index < sections.length; index++) {
      if (signal?.aborted || this.#closed) return;
      const text = await this.#sectionTextOf(index);
      for (const hit of searchText(text, query, (offset) => reflowAt(index, offset))) yield hit;
      if (index % 3 === 2) await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  selection(): ReaderSelection | undefined {
    return this.#readSelection();
  }

  showHighlight(id: string, range: TextRange, color: HighlightColor): void {
    this.#highlights.set(id, { range, color });
    this.#redrawOverlays();
  }

  hideHighlight(id: string): void {
    if (!this.#highlights.delete(id)) return;
    for (const c of this.#view.renderer.getContents()) c.overlayer?.remove(HL_PREFIX + id);
  }

  showSearchHits(ranges: readonly TextRange[]): void {
    for (const c of this.#view.renderer.getContents()) {
      for (let i = 0; i < this.#hits.length; i++) c.overlayer?.remove(`${SEARCH_PREFIX}${i}`);
    }
    this.#hits = ranges;
    this.#redrawOverlays();
  }

  onPositionChange(listener: (position: ReaderPosition) => void): Unsubscribe {
    return this.#position.on(listener);
  }

  onSelectionChange(listener: (selection: ReaderSelection | undefined) => void): Unsubscribe {
    return this.#selection.on(listener);
  }

  onWordTap(listener: (payload: { word: string; anchor: DOMRect }) => void): Unsubscribe {
    return this.#wordTap.on(listener);
  }

  onTap(listener: (zone: 'left' | 'center' | 'right') => void): Unsubscribe {
    return this.#taps.on(listener);
  }

  onKey(listener: (event: KeyboardLike) => void): Unsubscribe {
    return this.#keys.on(listener);
  }

  onImageTap(listener: (image: { src: string; alt: string }) => void): Unsubscribe {
    return this.#images.on(listener);
  }

  onFootnote(listener: (note: { text: string }) => void): Unsubscribe {
    return this.#notes.on(listener);
  }

  onHighlightTap(listener: (id: string) => void): Unsubscribe {
    return this.#hlTaps.on(listener);
  }

  onTocChange(listener: () => void): Unsubscribe {
    return this.#tocChange.on(listener);
  }

  chapterTicks(): readonly number[] {
    return this.#ticks;
  }

  currentLabel(): string {
    const p = this.#lastPosition;
    if (this.#fixed) return `Page ${p.page ?? 1}`;
    return p.chapterTitle ? p.chapterTitle : `${Math.round(p.percent)}%`;
  }

  minutesLeft(wordsPerMinute = 230): number | undefined {
    const remainingUnits = this.#view.lastLocation?.time?.section;
    if (remainingUnits === undefined || !Number.isFinite(remainingUnits) || this.#fixed) return undefined;
    // foliate measures sections in units of 1600 bytes of markup, about a minute at 250 words per minute.
    return (remainingUnits * 250) / wordsPerMinute;
  }

  selectionRect(): DOMRect | undefined {
    for (const content of this.#view.renderer.getContents()) {
      const sel = content.doc.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) continue;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const frame = content.doc.defaultView?.frameElement?.getBoundingClientRect();
      const host = this.#host.getBoundingClientRect();
      return new DOMRect(rect.left + (frame?.left ?? 0) - host.left, rect.top + (frame?.top ?? 0) - host.top, rect.width, rect.height);
    }
    return undefined;
  }

  clearSelection(): void {
    for (const c of this.#view.renderer.getContents()) c.doc.getSelection()?.removeAllRanges();
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    for (const off of this.#cleanups.splice(0)) off();
    try {
      this.#view.close();
    } catch {
      /* the view may already be torn down */
    }
    this.#book.destroy?.();
    this.#view.remove();
    for (const e of [this.#position, this.#selection, this.#wordTap, this.#taps, this.#keys, this.#hlTaps, this.#images, this.#notes, this.#tocChange]) e.clear();
  }

  // ---- styles and layout ----

  applyStyles(): void {
    if (this.#fixed) {
      this.#host.style.setProperty('--pn-reader-bg', themeColors(this.#appearance).page);
      return;
    }
    this.#view.renderer.setStyles(`${reflowCss(this.#appearance)}\n:root{--overlayer-highlight-opacity:${HIGHLIGHT_ALPHA};}`);
  }

  #applyLayoutAttributes(): void {
    if (this.#fixed) return;
    const r = this.#view.renderer;
    const hints = marginHints(this.#appearance.margins);
    const scrolled = this.#appearance.pageTurn === 'scroll';
    r.setAttribute('flow', scrolled ? 'scrolled' : 'paginated');
    r.setAttribute('gap', `${hints.gapPercent}%`);
    r.setAttribute('margin', '56px');
    r.setAttribute('max-inline-size', `${hints.maxInlinePx}px`);
    r.setAttribute('max-column-count', '2');
    const animated = !scrolled && this.#appearance.pageTurn !== 'none' && !prefersReducedMotion();
    if (animated) r.setAttribute('animated', '');
    else r.removeAttribute('animated');
  }

  // ---- navigation helpers ----

  #clampIndex(index: number): number {
    return Math.min(Math.max(0, index), this.#book.sections.length - 1);
  }

  #atStart(): boolean {
    const r = this.#view.renderer;
    if (this.#fixed) return (this.#lastIndex ?? 0) <= 0;
    return Boolean(r.atStart);
  }

  #atEnd(): boolean {
    const r = this.#view.renderer;
    if (this.#fixed) return (this.#lastIndex ?? 0) >= this.#book.sections.length - 1;
    return Boolean(r.atEnd);
  }

  #locatorToTarget(locator: Locator): { index: number; anchor?: unknown; cfi?: string } | undefined {
    if (locator.kind === 'page') return { index: this.#clampIndex(locator.page - 1) };
    if (locator.kind !== 'reflow') return undefined;
    const index = this.#clampIndex(locator.section);
    if (this.#fixed) return { index };
    return {
      index,
      // One character, not a collapsed point: a collapsed range reports no box, so a spot at the top of a page could be placed on the page before it.
      anchor: (doc: Document) => rangeFromOffsets(doc, locator.textOffset, locator.textOffset + 1),
      ...(locator.cfi ? { cfi: locator.cfi } : {}),
    };
  }

  async #navigate(target: { index: number; anchor?: unknown; cfi?: string }): Promise<void> {
    try {
      await this.#view.renderer.goTo({ index: target.index, ...(target.anchor ? { anchor: target.anchor } : {}) });
    } catch (error) {
      // Section and text offset could not be used: try the CFI, then just the section.
      const resolved = target.cfi ? this.#view.resolveNavigation(target.cfi) : undefined;
      if (resolved) await this.#view.renderer.goTo(resolved);
      else if (target.index >= 0) await this.#view.renderer.goTo({ index: target.index });
      else throw error;
    }
  }

  // ---- toc, metadata ----

  #buildToc(): void {
    const convert = (items: FoliateTocItem[] | null | undefined): TocItem[] =>
      (items ?? []).map((item) => {
        const resolved = this.#safeResolve(item.href);
        const locator: Locator = this.#fixed
          ? { kind: 'page', page: (resolved?.index ?? 0) + 1, offset: 0 }
          : reflowAt(resolved?.index ?? 0, 0);
        this.#tocHrefs.set(locator, item.href);
        const children = convert(item.subitems);
        return { title: (item.label ?? '').trim() || 'Untitled', locator, ...(children.length ? { children } : {}) };
      });
    this.#toc = convert(this.#book.toc);
    try {
      const fractions = this.#view.getSectionFractions();
      this.#ticks = (this.#book.toc ?? [])
        .map((item) => this.#safeResolve(item.href)?.index)
        .filter((i): i is number => typeof i === 'number')
        .map((i) => Math.min(1, fractions[i] ?? 0));
    } catch {
      this.#ticks = [];
    }
    this.#tocChange.emit();
  }

  #safeResolve(href: string): { index: number } | undefined {
    try {
      const resolved = this.#view.resolveNavigation(href);
      return resolved && Number.isInteger(resolved.index) ? { index: resolved.index } : undefined;
    } catch {
      return undefined;
    }
  }

  #readMetadata(): void {
    const m = this.#book.metadata ?? {};
    const title = metaText(m['title']);
    const author = metaText(m['author']);
    const language = metaText(m['language']);
    this.metadata = {
      ...(title ? { title } : {}),
      ...(author ? { author } : {}),
      ...(language ? { language } : {}),
      ...(this.#fixed ? { pages: this.#book.sections.length } : {}),
    };
    const cover = this.#book.getCover?.();
    if (cover) {
      void Promise.resolve(cover)
        .then((blob) => {
          if (blob) this.metadata = { ...this.metadata, cover: blob };
        })
        .catch(() => undefined);
    }
  }

  // ---- events from foliate ----

  #wire(): void {
    const v = this.#view;
    const on = (type: string, handler: (event: CustomEvent) => void): void => {
      const h = handler as EventListener;
      v.addEventListener(type, h);
      this.#cleanups.push(() => v.removeEventListener(type, h));
    };
    on('relocate', (e) => this.#onRelocate(e.detail as FoliateRelocate));
    on('load', (e) => this.#onLoad(e.detail as { doc: Document; index: number }));
    on('create-overlay', (e) => this.#drawOverlays((e.detail as { index: number }).index));
    on('show-annotation', (e) => {
      const { value } = e.detail as { value: string };
      if (value.startsWith(HL_PREFIX)) {
        this.#annotationTapAt = performance.now();
        this.#hlTaps.emit(value.slice(HL_PREFIX.length));
      }
    });
    on('external-link', (e) => {
      e.preventDefault();
      const { href } = e.detail as { href: string };
      if (/^(https?:|mailto:|tel:)/i.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
    });
    on('link', (e) => {
      const { a, href } = e.detail as { a: Element; href: string };
      const type = `${a.getAttribute('epub:type') ?? ''} ${a.getAttribute('role') ?? ''}`;
      if (!NOTEREF.test(type)) return;
      e.preventDefault();
      void this.#footnoteText(href).then((text) => {
        if (text) this.#notes.emit({ text });
        else void this.#view.goTo(href);
      });
    });
  }

  async #footnoteText(href: string): Promise<string | undefined> {
    try {
      const resolved = this.#view.resolveNavigation(href);
      if (!resolved) return undefined;
      const doc = await this.#book.sections[resolved.index]?.createDocument?.();
      const anchor = typeof resolved.anchor === 'function' ? (resolved.anchor as (d: Document) => unknown)(doc as Document) : undefined;
      const el = anchor instanceof Range ? anchor.startContainer.parentElement : (anchor as Element | undefined);
      const block = el?.closest('aside, li, p, div') ?? el;
      const text = (block?.textContent ?? '').replace(/\s+/g, ' ').trim();
      return text ? text.slice(0, 900) : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * The span of the section document (its own horizontal coordinates) that is on screen. The paginator keeps a spare
   * page in front of the text, so a view scrolled to `start` shows the document from `start - size` to `start`.
   */
  #pageBounds(r: FoliateRenderer): [number, number] {
    const size = r.size ?? 0;
    const start = r.start ?? 0;
    return [start - size, start];
  }

  /** Where the page really starts: the first visible character, not the start of the paragraph that runs onto the page. */
  #firstVisibleOffset(doc: Document, range: Range): number {
    const r = this.#view.renderer;
    const paged = r.getAttribute('flow') !== 'scrolled' && !r.scrolled;
    const style = doc.defaultView?.getComputedStyle(doc.body);
    const plain = style?.writingMode === 'horizontal-tb' && style.direction === 'ltr';
    if (!paged || !plain || typeof r.start !== 'number') return offsetsOfRange(doc, range).start;
    try {
      const [from, to] = this.#pageBounds(r);
      return firstVisibleOffset(doc, range, from, to);
    } catch {
      return offsetsOfRange(doc, range).start;
    }
  }

  /** Pictures and fonts can still be changing the layout when a page is first reported; settle on the final page start. */
  #refineOffset(seq: number, index: number): void {
    if (this.#closed || seq !== this.#relocateSeq || this.#fixed) return;
    const current = this.#lastPosition.locator;
    if (current.kind !== 'reflow' || current.section !== index) return;
    const r = this.#view.renderer;
    const doc = r.getContents().find((c) => c.index === index)?.doc;
    if (!doc || typeof r.start !== 'number' || r.getAttribute('flow') === 'scrolled' || r.scrolled) return;
    const style = doc.defaultView?.getComputedStyle(doc.body);
    if (style?.writingMode !== 'horizontal-tb' || style.direction !== 'ltr') return;
    let offset: number | undefined;
    try {
      const [from, to] = this.#pageBounds(r);
      offset = findFirstVisibleOffset(doc, 0, from, to);
    } catch {
      return;
    }
    if (offset === undefined || offset === current.textOffset) return;
    this.#lastPosition = { ...this.#lastPosition, locator: reflowAt(index, offset, current.cfi) };
    this.#position.emit(this.#lastPosition);
  }

  #onRelocate(detail: FoliateRelocate): void {
    if (this.#closed) return;
    const index = sectionIndexOf(detail);
    if (index === undefined) return;
    const content = this.#view.renderer.getContents().find((c) => c.index === index);
    let locator: Locator;
    if (this.#fixed) locator = { kind: 'page', page: index + 1, offset: 0 };
    else {
      let textOffset = 0;
      if (content && detail.range) {
        try {
          textOffset = this.#firstVisibleOffset(content.doc, detail.range);
        } catch {
          textOffset = 0;
        }
      }
      locator = reflowAt(index, textOffset, detail.cfi);
    }
    this.#lastIndex = index;
    const total = this.#book.sections.length;
    const fraction = this.#fixed ? index / Math.max(1, total - 1) : typeof detail.fraction === 'number' && Number.isFinite(detail.fraction) ? detail.fraction : 0;
    this.#lastPosition = {
      locator,
      percent: Math.min(100, Math.max(0, fraction * 100)),
      ...(detail.tocItem?.label ? { chapterTitle: detail.tocItem.label.trim() } : {}),
      ...(this.#fixed ? { page: index + 1, pageCount: total } : {}),
    };
    this.#position.emit(this.#lastPosition);
    const seq = ++this.#relocateSeq;
    window.setTimeout(() => this.#refineOffset(seq, index), REFINE_MS);
    this.#firstRelocate?.();
    this.#firstRelocate = undefined;
  }

  #onLoad({ doc, index }: { doc: Document; index: number }): void {
    if (this.#docs.has(doc)) return;
    this.#docs.add(doc);
    const win = doc.defaultView;
    if (!win) return;

    let downAt: { x: number; y: number; t: number } | undefined;
    const onDown = (e: PointerEvent): void => {
      downAt = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    };
    const onClick = (e: MouseEvent): void => {
      const start = downAt;
      downAt = undefined;
      if (start && (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10 || e.timeStamp - start.t > TAP_MAX_MS)) return;
      if (!doc.getSelection()?.isCollapsed) return;
      const target = e.target as Element | null;
      if (target?.closest('a[href]')) return;
      const host = this.#host.getBoundingClientRect();
      const x = e.clientX - host.left;
      const img = target?.closest('img');
      const imgSrc = img?.getAttribute('src');
      const third = host.width / 3;
      const zone = x < third ? 'left' : x > third * 2 ? 'right' : 'center';
      // Highlight taps are reported by foliate's overlayer in the same click; let that handler run first.
      window.setTimeout(() => {
        if (performance.now() - this.#annotationTapAt < 60 || performance.now() - this.#wordTapAt < 400 || this.#closed) return;
        if (img && imgSrc && !this.#fixed) this.#images.emit({ src: img.currentSrc || img.src, alt: img.alt });
        else this.#taps.emit(zone);
      }, 0);
    };
    const onKey = (e: KeyboardEvent): void => this.#keys.emit(e);
    const onSelection = (): void => {
      const sel = this.#readSelection();
      const key = sel ? JSON.stringify(sel.range) : '';
      if (key === this.#lastSelectionKey) return;
      this.#lastSelectionKey = key;
      this.#selection.emit(sel);
    };
    const onPointerUp = (e: PointerEvent): void => {
      const start = downAt ?? { x: e.clientX, y: e.clientY, t: e.timeStamp };
      if (e.button !== 0) return;
      if (e.timeStamp - start.t > TAP_MAX_MS || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return;
      const sel = doc.getSelection();
      if (sel && !sel.isCollapsed) return;
      const target = e.target as Element | null;
      if (target?.closest('a[href]')) return;
      let range = doc.caretRangeFromPoint?.(e.clientX, e.clientY) ?? caretRangeFromPoint(doc, e.clientX, e.clientY);
      if (!range) {
        const hit = doc.elementFromPoint(e.clientX, e.clientY);
        const text = hit?.textContent ?? '';
        if (hit && text.length >= 2) {
          range = doc.createRange();
          range.selectNodeContents(hit);
          range.collapse(true);
        }
      }
      if (!range) return;
      const word = wordAtRange(range);
      if (word.length < 2) return;
      const rect = range.getBoundingClientRect();
      const frame = win.frameElement?.getBoundingClientRect();
      const host = this.#host.getBoundingClientRect();
      const anchor = new DOMRect(
        rect.left + (frame?.left ?? 0) - host.left,
        rect.top + (frame?.top ?? 0) - host.top,
        Math.max(rect.width, 24),
        Math.max(rect.height, 16),
      );
      this.#wordTap.emit({ word, anchor });
      this.#wordTapAt = performance.now();
    };
    doc.addEventListener('pointerdown', onDown);
    doc.addEventListener('pointerup', onPointerUp);
    doc.addEventListener('click', onClick);
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('selectionchange', onSelection);
    this.#cleanups.push(() => {
      doc.removeEventListener('pointerdown', onDown);
      doc.removeEventListener('pointerup', onPointerUp);
      doc.removeEventListener('click', onClick);
      doc.removeEventListener('keydown', onKey);
      doc.removeEventListener('selectionchange', onSelection);
    });
    void index;
  }

  // ---- selection ----

  #readSelection(): ReaderSelection | undefined {
    if (this.#fixed) return undefined;
    for (const content of this.#view.renderer.getContents()) {
      const sel = content.doc.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) continue;
      const { start, end } = offsetsOfRange(content.doc, sel.getRangeAt(0));
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      if (!text || end <= start) continue;
      return { range: { start: reflowAt(content.index, start), end: reflowAt(content.index, end) }, text };
    }
    return undefined;
  }

  // ---- overlays (highlights, search hits) ----

  #redrawOverlays(): void {
    for (const c of this.#view.renderer.getContents()) this.#drawOverlays(c.index);
  }

  #drawOverlays(index: number): void {
    const content = this.#view.renderer.getContents().find((c) => c.index === index);
    const overlayer = content?.overlayer;
    if (!content || !overlayer) return;
    void import('foliate-js/overlayer.js').then(({ Overlayer: O }) => {
      if (this.#closed) return;
      const draw = (key: string, range: TextRange, color: string, fn: typeof O.highlight): void => {
        for (const part of sectionsOfRange(range)) {
          if (part.section !== index) continue;
          try {
            const end = Number.isFinite(part.end) ? part.end : Number.MAX_SAFE_INTEGER;
            overlayer.add(key, rangeFromOffsets(content.doc, part.start, end), fn, { color });
          } catch {
            /* a stored range that no longer fits the text is skipped rather than breaking the page */
          }
        }
      };
      for (const [id, h] of this.#highlights) draw(HL_PREFIX + id, h.range, HIGHLIGHT_FILL[h.color], O.highlight);
      const accent = themeColors(this.#appearance).accent;
      this.#hits.forEach((r, i) => draw(`${SEARCH_PREFIX}${i}`, r, accent, O.outline));
    });
  }

  async #sectionTextOf(index: number): Promise<string> {
    let t = this.#texts.get(index);
    if (!t) {
      const section = this.#book.sections[index];
      t = Promise.resolve(section?.createDocument?.()).then((doc) => (doc ? sectionText(doc) : ''));
      this.#texts.set(index, t);
    }
    return t;
  }
}

function caretRangeFromPoint(doc: Document, x: number, y: number): Range | undefined {
  const direct = doc.caretRangeFromPoint?.(x, y);
  if (direct) return direct;
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return undefined;
  const range = doc.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  return range;
}

function wordAtRange(range: Range): string {
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return range.toString().trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'-]+$/gu, '');
  const text = node.textContent ?? '';
  let start = range.startOffset;
  let end = range.endOffset;
  while (start > 0 && /[\p{L}\p{N}'-]/u.test(text[start - 1]!)) start--;
  while (end < text.length && /[\p{L}\p{N}'-]/u.test(text[end]!)) end++;
  return text.slice(start, end).trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'-]+$/gu, '');
}
