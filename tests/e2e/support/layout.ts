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
      if (r.width === 0 || r.height === 0) continue;
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
      const r = el.getBoundingClientRect();
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
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2; const y = r.top + r.height / 2;
      const name = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { out.push({ what: 'control cannot be scrolled into view', where: name }); continue; }
      const top = document.elementFromPoint(x, y);
      if (top && !(el === top || el.contains(top) || top.contains(el))) out.push({ what: 'control is covered', where: `${name} covered by ${top.tagName.toLowerCase()} "${(top.textContent ?? '').trim().slice(0, 30)}"` });
    }
    document.querySelector('main')?.scrollTo(0, 0);
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
