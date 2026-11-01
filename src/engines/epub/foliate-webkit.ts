/** True for Safari / Playwright WebKit (not Chromium-on-iOS). */
export function isWebKitEngine(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /AppleWebKit/i.test(ua) && !/\bChrome\//i.test(ua) && !/\bChromium\//i.test(ua) && !/\bEdg\//i.test(ua);
}

let iframeSandboxPatchInstalled = false;

/**
 * foliate-js sandboxes book iframes inside **closed** shadow roots; DOM observers on the host cannot reach them.
 * On WebKit, sandbox + blob: EPUB frames fail (see foliate-js README / WebKit 218086). Ignore sandbox assignments on WebKit.
 */
export function installWebKitFoliateIframeFix(): void {
  if (!isWebKitEngine() || iframeSandboxPatchInstalled || typeof HTMLIFrameElement === 'undefined') return;
  iframeSandboxPatchInstalled = true;
  const proto = HTMLIFrameElement.prototype;
  const origSet = proto.setAttribute;
  proto.setAttribute = function setAttribute(name: string, value: string) {
    if (name === 'sandbox') return;
    return origSet.call(this, name, value);
  };
  if (proto.setAttributeNS) {
    const origSetNS = proto.setAttributeNS;
    proto.setAttributeNS = function setAttributeNS(ns: string | null, name: string, value: string) {
      if (name === 'sandbox') return;
      return origSetNS.call(this, ns, name, value);
    };
  }
}

function sandboxStripper(): { strip: (el: Element) => void; stripTree: (root: ParentNode) => void } {
  const strip = (el: Element): void => {
    if (el instanceof HTMLIFrameElement && el.hasAttribute('sandbox')) el.removeAttribute('sandbox');
  };
  return { strip, stripTree: (root: ParentNode) => root.querySelectorAll('iframe[sandbox]').forEach(strip) };
}

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
