/** True for Safari / Playwright WebKit (not Chromium-on-iOS). */
export function isWebKitEngine(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /AppleWebKit/i.test(ua) && !/\bChrome\//i.test(ua) && !/\bChromium\//i.test(ua) && !/\bEdg\//i.test(ua);
}

function sandboxStripper(): { strip: (el: Element) => void; stripTree: (root: ParentNode) => void } {
  const strip = (el: Element): void => {
    if (el instanceof HTMLIFrameElement && el.hasAttribute('sandbox')) el.removeAttribute('sandbox');
  };
  return { strip, stripTree: (root: ParentNode) => root.querySelectorAll('iframe[sandbox]').forEach(strip) };
}

/**
 * foliate-js sandboxes book iframes for other engines; on WebKit that breaks blob: EPUB frames (CSP / sandbox interaction).
 * foliate-js documents the sandbox as ineffective on WebKit anyway — drop it so reflow books open on iPhone.
 */
/** Strip sandbox from foliate book iframes already in the tree (call after `view.open`). */
export function unsandboxFoliateIframesNow(root: HTMLElement): void {
  if (!isWebKitEngine()) return;
  sandboxStripper().stripTree(root);
}

export function watchUnsandboxFoliateIframes(root: HTMLElement): () => void {
  if (!isWebKitEngine()) return () => undefined;

  const { strip, stripTree } = sandboxStripper();
  stripTree(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLIFrameElement) strip(node);
        else if (node instanceof Element) node.querySelectorAll('iframe[sandbox]').forEach(strip);
      }
    }
  });
  observer.observe(root, { subtree: true, childList: true });
  return () => observer.disconnect();
}
