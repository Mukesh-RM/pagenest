/**
 * A tiny, forgiving XML reader for package files (EPUB OPF and container, FB2 description,
 * DOCX core properties, ComicInfo). Web Workers have no DOMParser, and these files need only
 * names, attributes and text. It does not validate, and it never throws.
 */

export interface XmlNode {
  /** Tag name without a namespace prefix, lower-cased (`dc:Title` becomes `title`). */
  readonly name: string;
  /** Attributes by lower-cased name; the prefix is kept (`xlink:href`) and also stored without it (`href`). */
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: XmlNode[];
  /** Direct text of this element, entities decoded, whitespace trimmed. */
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      try {
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      } catch {
        return whole;
      }
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function localName(name: string): string {
  const colon = name.indexOf(':');
  return (colon === -1 ? name : name.slice(colon + 1)).toLowerCase();
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const raw = (m[1] as string).toLowerCase();
    const value = decodeEntities((m[2] ?? m[3]) as string);
    attrs[raw] = value;
    const short = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
    if (!(short in attrs)) attrs[short] = value;
  }
  return attrs;
}

/** Parse markup into a tree under a synthetic root. */
export function parseXml(source: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  // Groups: 1 CDATA, 2 closing slash, 3 tag name, 4 attributes, 5 self-closing slash, 6 text.
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!(?!--|\[CDATA)[^>]*>|<(\/?)([^\s/>]+)([^>]*?)(\/?)>|([^<]+)/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const top = stack[stack.length - 1] as XmlNode;
    if (m[1] !== undefined) {
      top.text += m[1];
    } else if (m[6] !== undefined) {
      top.text += decodeEntities(m[6]);
    } else if (m[3] !== undefined) {
      const name = localName(m[3]);
      if (m[2] === '/') {
        for (let i = stack.length - 1; i > 0; i -= 1) {
          if ((stack[i] as XmlNode).name === name) {
            stack.length = i;
            break;
          }
        }
      } else {
        const node: XmlNode = { name, attrs: parseAttrs(m[4] ?? ''), children: [], text: '' };
        top.children.push(node);
        if (m[5] !== '/') stack.push(node);
      }
    }
  }
  const trim = (n: XmlNode): void => {
    n.text = n.text.replace(/\s+/g, ' ').trim();
    n.children.forEach(trim);
  };
  trim(root);
  return root;
}

/** All descendants (depth first) with this tag name. */
export function findAll(node: XmlNode, name: string): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (n: XmlNode): void => {
    for (const c of n.children) {
      if (c.name === name) out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}

export function findFirst(node: XmlNode, name: string): XmlNode | undefined {
  for (const c of node.children) {
    if (c.name === name) return c;
    const deeper = findFirst(c, name);
    if (deeper) return deeper;
  }
  return undefined;
}

/** All text inside a node, children included. */
export function allText(node: XmlNode): string {
  return [node.text, ...node.children.map(allText)].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
