/**
 * HTML cleaning for converted documents. The reader never runs a document's scripts: markup is parsed into an inert
 * document, dangerous elements and attributes are dropped, and only safe link and image addresses stay. (The app's
 * CSP blocks scripts and network access in book frames too; this keeps the content itself clean.)
 */

const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'TEMPLATE', 'FRAME', 'FRAMESET', 'APPLET']);
const SAFE_LINK = /^(https?:|mailto:|tel:|#)/i;
const SAFE_IMAGE = /^(data:image\/(png|jpe?g|gif|webp|svg\+xml|bmp);|blob:)/i;

/** Remove unsafe elements and attributes from `root` in place. */
export function sanitizeTree(root: Element): void {
  for (const el of [...root.querySelectorAll('*')]) {
    if (DROP.has(el.tagName.toUpperCase())) {
      el.remove();
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'srcdoc') el.removeAttribute(attr.name);
      else if (name === 'href' && !SAFE_LINK.test(attr.value.trim())) el.removeAttribute(attr.name);
      else if (name === 'src' && !SAFE_IMAGE.test(attr.value.trim())) el.removeAttribute(attr.name);
      else if (name === 'srcset' || name === 'xlink:href' || name === 'formaction') el.removeAttribute(attr.name);
    }
    if (el.tagName === 'IMG' && !el.getAttribute('src')) el.remove();
  }
}

export function sanitizeHtml(html: string): { title: string; body: HTMLElement } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.title.trim();
  sanitizeTree(doc.body);
  return { title, body: doc.body };
}
