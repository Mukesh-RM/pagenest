import { expect, type Page } from '@playwright/test';

export interface Problem { what: string; where: string }

const fmt = (ps: Problem[]) => ps.map((p) => `  - ${p.what}: ${p.where}`).join('\n');

/** Horizontal overflow of the page or of the main scroll area, and clipped text in non-scrolling containers. */
export async function overflowProblems(page: Page): Promise<Problem[]> {
  return page.evaluate(() => {
    const out: { what: string; where: string }[] = [];
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push({ what: 'page scrolls horizontally', where: `scrollWidth ${de.scrollWidth} > ${de.clientWidth}` });
    if (document.body.scrollWidth > de.clientWidth + 1) out.push({ what: 'body wider than the viewport', where: `${document.body.scrollWidth} > ${de.clientWidth}` });
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue; // not rendered, or visually hidden (sr-only)
      if (r.right > de.clientWidth + 1 && !el.closest('[aria-hidden="true"]') && cs.position !== 'fixed' && !el.closest('[data-allow-overflow]')) {
        // content poking out to the right of the viewport (ignore elements inside their own horizontal scroller)
        let scroller: Element | null = el.parentElement; let inside = false;
        while (scroller) { const o = getComputedStyle(scroller).overflowX; if ((o === 'auto' || o === 'scroll') && scroller.scrollWidth > scroller.clientWidth) { inside = true; break; } scroller = scroller.parentElement; }
        if (!inside) out.push({ what: 'element extends past the right edge', where: `${describe(el)} right=${Math.round(r.right)} viewport=${de.clientWidth}` });
      }
      const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      const clips = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
      const lineClamped = cs.getPropertyValue('-webkit-line-clamp') !== 'none' && cs.getPropertyValue('-webkit-line-clamp') !== '';
      if (hasOwnText && clips && !lineClamped && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') {
        out.push({ what: 'text clipped horizontally', where: `${describe(el)} scrollWidth ${el.scrollWidth} > ${el.clientWidth}` });
      }
      const clipsY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
      if (hasOwnText && clipsY && !lineClamped && el.scrollHeight > el.clientHeight + 2) {
        out.push({ what: 'text clipped vertically', where: `${describe(el)} scrollHeight ${el.scrollHeight} > ${el.clientHeight}` });
      }
    }
    return out;
  });
}

export async function expectNoOverflow(page: Page, label: string): Promise<void> {
  const problems = await overflowProblems(page);
  expect(problems, `${label}\n${fmt(problems)}`).toEqual([]);
}

/** Interactive controls that are too small to tap. Inline links inside running text are exempt (WCAG 2.5.8 inline exception). */
export async function smallTargets(page: Page, minPx: number): Promise<Problem[]> {
  return page.evaluate((minPx) => {
    const out: { what: string; where: string }[] = [];
    const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="radio"], [role="tab"], [role="switch"], [role="checkbox"], [tabindex]:not([tabindex="-1"])';
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || (el as HTMLElement).hidden) continue;
      let r = el.getBoundingClientRect();
      // Native radios and checkboxes: the whole label is the tap target, so measure the label when it is larger than the input.
      const label = (el as HTMLInputElement).labels?.[0];
      if (label && (el as HTMLInputElement).type !== 'text') { const lr = label.getBoundingClientRect(); if (lr.width * lr.height > r.width * r.height) r = lr; }
      if (r.width === 0 && r.height === 0) continue;
      if (el.tagName === 'A' && el.closest('p, li > span, dd')) { const p = el.closest('p'); if (p && (p.textContent ?? '').trim() !== (el.textContent ?? '').trim()) continue; }
      if (r.width < minPx - 0.5 || r.height < minPx - 0.5) {
        out.push({ what: 'target smaller than minimum', where: `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}` });
      }
    }
    return out;
  }, minPx);
}

export async function expectTargetsBigEnough(page: Page, minPx: number, label: string): Promise<void> {
  const problems = await smallTargets(page, minPx);
  expect(problems, `${label} (minimum ${minPx} px)\n${fmt(problems)}`).toEqual([]);
}

/** Every visible control can be scrolled into view and is not covered by something else at its centre. */
export async function unreachableControls(page: Page): Promise<Problem[]> {
  return page.evaluate(() => {
    const out: { what: string; where: string }[] = [];
    const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="radio"], [role="tab"], [role="switch"], [role="checkbox"]';
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const label = (el as HTMLInputElement).labels?.[0];
      if (!label && (el.getBoundingClientRect().width === 0 || el.getBoundingClientRect().height === 0)) continue; // not rendered (for example the tablet rail on a phone)
      const probe: Element = label && (el as HTMLInputElement).type !== 'text' ? label : el;
      probe.scrollIntoView({ block: 'center', inline: 'center' });
      const r = probe.getBoundingClientRect();
      const x = r.left + r.width / 2; const y = r.top + r.height / 2;
      const name = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { out.push({ what: 'control cannot be scrolled into view', where: name }); continue; }
      const top = document.elementFromPoint(x, y);
      if (top && !(probe === top || probe.contains(top) || top.contains(probe))) out.push({ what: 'control is covered', where: `${name} covered by ${top.tagName.toLowerCase()} "${(top.textContent ?? '').trim().slice(0, 30)}"` });
    }
    window.scrollTo(0, 0);
    return out;
  });
}

export async function expectControlsReachable(page: Page, label: string): Promise<void> {
  const problems = await unreachableControls(page);
  expect(problems, `${label}\n${fmt(problems)}`).toEqual([]);
}

/** Layout-shift recorder, installed before navigation. CLS is the sum of shifts without recent input. */
export async function recordLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls?: number; __shifts?: { value: number; sources: string[] }[] };
    w.__cls = 0; w.__shifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] }[]) {
          if (e.hadRecentInput) continue;
          w.__cls! += e.value;
          w.__shifts!.push({ value: e.value, sources: (e.sources ?? []).map((s) => (s.node as Element | undefined)?.nodeName ?? '?') });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* Chromium only */ }
  });
}

export function readCls(page: Page): Promise<{ cls: number; shifts: { value: number; sources: string[] }[] }> {
  return page.evaluate(() => {
    const w = window as unknown as { __cls?: number; __shifts?: { value: number; sources: string[] }[] };
    return { cls: w.__cls ?? 0, shifts: w.__shifts ?? [] };
  });
}

/** Longest transition or animation currently defined or running, in ms, with the element responsible. */
export async function longestMotion(page: Page): Promise<{ ms: number; where: string }> {
  return page.evaluate(() => {
    let best = { ms: 0, where: 'none' };
    const toMs = (v: string) => Math.max(0, ...v.split(',').map((t) => (t.trim().endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000) || 0));
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const t = toMs(cs.transitionDuration) + toMs(cs.transitionDelay);
      const a = cs.animationName !== 'none' ? toMs(cs.animationDuration) + toMs(cs.animationDelay) : 0;
      const infinite = cs.animationName !== 'none' && cs.animationIterationCount === 'infinite' ? 1e9 : 0;
      const ms = Math.max(t, a, infinite);
      if (ms > best.ms) best = { ms, where: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.textContent ?? '').trim().slice(0, 25)}" transition=${cs.transitionDuration} animation=${cs.animationName} ${cs.animationDuration}${infinite ? ' infinite' : ''}` };
    }
    for (const an of document.getAnimations()) {
      const timing = an.effect?.getComputedTiming();
      const ms = timing && Number.isFinite(Number(timing.duration)) ? Number(timing.duration) + Number(timing.delay ?? 0) : 0;
      if (ms > best.ms) best = { ms, where: `running animation ${(an as CSSAnimation).animationName ?? (an as CSSTransition).transitionProperty ?? an.constructor.name}` };
    }
    return best;
  });
}

/**
 * "Usable layout": navigation and content are both visible and fit the screen width.
 * The page scrolls as a whole (the tab bar is fixed to the bottom on phones, a rail sits beside the content on laptops).
 * Phones: the visible navigation is a bar pinned to the bottom edge, and the content leaves room for it (bottom padding)
 * so the last item is never hidden. Laptops: a side rail that does not overlap the content, and the content area takes at
 * least `minContentShare` (budgets.ts minContentShareOfWidth) of the screen so the page is not a thin strip.
 */
export async function expectUsableLayout(
  page: Page, vp: { width: number; height: number; phone: boolean }, label: string, minContentShare: number,
): Promise<void> {
  const boxes = await page.evaluate(() => {
    const rect = (el: Element | null | undefined) => { const r = el?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; };
    const nav = [...document.querySelectorAll('nav')].find((n) => n.getBoundingClientRect().width > 0 && getComputedStyle(n).visibility !== 'hidden');
    const main = document.querySelector('main');
    return { nav: rect(nav), main: rect(main), mainPadBottom: main ? parseFloat(getComputedStyle(main).paddingBottom) : 0, pageScrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  expect(boxes.nav, `${label}: no visible navigation`).not.toBeNull();
  expect(boxes.main, `${label}: main content missing`).not.toBeNull();
  const nav = boxes.nav!; const main = boxes.main!;
  expect(nav.x, `${label}: navigation starts left of the screen`).toBeGreaterThanOrEqual(-1);
  expect(nav.x + nav.w, `${label}: navigation ends right of the screen`).toBeLessThanOrEqual(vp.width + 1);
  expect(main.x + main.w, `${label}: content ends right of the screen`).toBeLessThanOrEqual(vp.width + 1);
  if (vp.phone) {
    expect(nav.y + nav.h, `${label}: navigation ends below the screen`).toBeLessThanOrEqual(vp.height + 1);
    expect(nav.y + nav.h, `${label}: phone tab bar should be pinned to the bottom edge`).toBeGreaterThanOrEqual(vp.height - 2);
    expect(nav.w, `${label}: phone tab bar should span the screen`).toBeGreaterThanOrEqual(vp.width * 0.95);
    expect(boxes.mainPadBottom, `${label}: content needs bottom padding of at least the tab bar height (${Math.round(nav.h)} px) so the last item is not hidden`).toBeGreaterThanOrEqual(nav.h - 1);
    expect(main.w, `${label}: content should use the full phone width`).toBeGreaterThanOrEqual(vp.width * 0.95);
  } else {
    expect(nav.h, `${label}: laptop navigation should be a side rail, not a bar`).toBeGreaterThan(nav.w);
    // the rail must stay usable while the page scrolls: scroll to the bottom and require every rail link inside the viewport
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const hidden = await page.evaluate(() => {
      const links = [...document.querySelectorAll('nav a')].filter((a) => a.getBoundingClientRect().width > 0);
      return links.filter((a) => { const r = a.getBoundingClientRect(); return r.top < 0 || r.bottom > innerHeight; }).map((a) => (a.textContent ?? '').trim());
    });
    expect(hidden, `${label}: rail links scroll out of view when the page scrolls (the rail should be sticky or fixed): ${hidden.join(', ')}`).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    const overlap = nav.x < main.x + main.w - 1 && nav.x + nav.w > main.x + 1;
    expect(overlap, `${label}: rail overlaps content (nav ${JSON.stringify(nav)}, main ${JSON.stringify(main)})`).toBe(false);
    expect(main.w, `${label}: content area is only ${Math.round(main.w)} px of ${vp.width}`).toBeGreaterThanOrEqual(vp.width * minContentShare);
  }
}

/**
 * Emulates a 200% system text size for apps whose root size is driven by CSS variables set in px (PageNest sets
 * --pn-font-size and --pn-text-*): every such px variable on the root is multiplied by `scale`, exactly what an OS text
 * scale does to px text. Returns the resulting body font size.
 */
export async function applyTextScale(page: Page, scale: number): Promise<number> {
  return page.evaluate((scale) => {
    const root = document.documentElement;
    const names = ['--pn-font-size', '--pn-text-xs', '--pn-text-sm', '--pn-text-md', '--pn-text-lg', '--pn-text-xl'];
    const cs = getComputedStyle(root);
    const bases = names.map((n) => parseFloat(cs.getPropertyValue(n)));
    names.forEach((n, i) => { if (Number.isFinite(bases[i])) root.style.setProperty(n, `${bases[i]! * scale}px`); });
    return parseFloat(getComputedStyle(document.body).fontSize);
  }, scale);
}
