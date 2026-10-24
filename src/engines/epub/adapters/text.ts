import { sanitizeHtml } from './sanitize';
import type { SectionInput } from './synthetic-book';

/** Converters for plain-ish formats. Everything returns sections of safe body HTML. */

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- text decoding ----------

export interface DecodedText {
  readonly text: string;
  readonly encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
}

/**
 * Decode old and new text files without being told the encoding: byte order marks first, then UTF-16 without a mark
 * (lots of zero bytes), then strict UTF-8, and finally Windows-1252 (the usual encoding of old Western text files).
 */
export function decodeText(bytes: Uint8Array): DecodedText {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let evenZero = 0;
  let oddZero = 0;
  for (let i = 0; i < sample.length; i++) if (sample[i] === 0) {
      if (i % 2) oddZero++;
      else evenZero++;
    }
  const half = sample.length / 2;
  if (sample.length >= 4 && oddZero > half * 0.4 && evenZero < half * 0.1) return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'utf-16le' };
  if (sample.length >= 4 && evenZero > half * 0.4 && oddZero < half * 0.1) return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'utf-16be' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' };
  }
}

// ---------- plain text ----------

const HEADING = /^(?:chapter|part|book|section|volume|prologue|epilogue|preface|introduction|contents|appendix)\b.{0,70}$/i;
const ROMAN_HEADING = /^(?:[IVXLCDM]{1,8}\.?|\d{1,3}\.)\s+\S.{0,60}$/;
const MAX_SECTION_CHARS = 60000;

/** Paragraphs of a plain text file: blank lines separate them and hard-wrapped lines are joined. */
export function textParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\t/g, '    ');
  const hasBlankLines = /\n[ \t]*\n/.test(normalized);
  const blocks = hasBlankLines ? normalized.split(/\n[ \t]*\n/) : normalized.split('\n');
  return blocks.map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean).join(' ').replace(/ {2,}/g, ' ').trim()).filter(Boolean);
}

/** Split a plain text file into chapters at headings; very long stretches are split so pages stay quick to build. */
export function plainTextToSections(text: string, fallbackTitle = 'Text'): SectionInput[] {
  const paragraphs = textParagraphs(text);
  const sections: Array<{ title: string; paras: string[]; chars: number }> = [];
  let current = { title: fallbackTitle, paras: [] as string[], chars: 0 };
  const flush = (): void => {
    if (current.paras.length) sections.push(current);
  };
  for (const p of paragraphs) {
    const isHeading = p.length <= 80 && (HEADING.test(p) || (ROMAN_HEADING.test(p) && current.paras.length > 0));
    if (isHeading && current.chars > 400) {
      flush();
      current = { title: p, paras: [p], chars: p.length };
      continue;
    }
    if (isHeading && current.paras.length === 0) current.title = p;
    if (current.chars > MAX_SECTION_CHARS) {
      flush();
      current = { title: `${current.title} (continued)`, paras: [], chars: 0 };
    }
    current.paras.push(p);
    current.chars += p.length;
  }
  flush();
  if (!sections.length) sections.push({ title: fallbackTitle, paras: [''], chars: 0 });
  return sections.map((s) => ({
    title: s.title,
    html: s.paras.map((p, i) => (i === 0 && p === s.title ? `<h2>${escapeHtml(p)}</h2>` : `<p>${escapeHtml(p)}</p>`)).join(''),
  }));
}

// ---------- markdown ----------

function inline(src: string): string {
  let out = escapeHtml(src);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_m, a: string | undefined, b: string | undefined) => `<strong>${a ?? b ?? ''}</strong>`);
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)|(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, (_m, p1: string | undefined, a: string | undefined, p2: string | undefined, b: string | undefined) => `${p1 ?? p2 ?? ''}<em>${a ?? b ?? ''}</em>`);
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string) => alt);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => `<a href="${url.replace(/&amp;/g, '&')}">${label}</a>`);
  return out;
}

/** A small, safe Markdown converter: headings, paragraphs, emphasis, code, lists, quotes, rules and links. */
export function markdownToSections(markdown: string, fallbackTitle = 'Document'): SectionInput[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | undefined;
  let quote: string[] = [];
  let code: string[] | undefined;
  const flushPara = (): void => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = (): void => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = undefined;
  };
  const flushQuote = (): void => {
    if (quote.length) html.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
    quote = [];
  };
  for (const line of lines) {
    if (code) {
      if (/^```/.test(line)) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = undefined;
      } else code.push(line);
      continue;
    }
    if (/^```/.test(line)) {
      flushPara();
      flushList();
      flushQuote();
      code = [];
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const quoted = /^>\s?(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      flushQuote();
      const level = (heading[1] as string).length;
      html.push(`<h${level}>${inline(heading[2] as string)}</h${level}>`);
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      flushList();
      flushQuote();
      html.push('<hr>');
    } else if (bullet || numbered) {
      flushPara();
      flushQuote();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((bullet ?? numbered)?.[1] ?? '');
    } else if (quoted) {
      flushPara();
      flushList();
      quote.push(quoted[1] ?? '');
    } else if (line.trim() === '') {
      flushPara();
      flushList();
      flushQuote();
    } else {
      flushList();
      flushQuote();
      para.push(line.trim());
    }
  }
  if (code) html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  flushPara();
  flushList();
  flushQuote();
  return splitHtmlSections(html.join('\n'), fallbackTitle);
}

// ---------- html ----------

/** Split sanitized body HTML into chapters at top-level `h1` (or `h2` when there is no `h1`). */
export function splitHtmlSections(bodyHtml: string, fallbackTitle: string): SectionInput[] {
  const { body } = sanitizeHtml(`<body>${bodyHtml}</body>`);
  const children = [...body.children];
  const level = children.some((c) => c.tagName === 'H1') ? 'H1' : children.some((c) => c.tagName === 'H2') ? 'H2' : '';
  const sections: Array<{ title: string; parts: string[] }> = [];
  let current: { title: string; parts: string[] } | undefined;
  for (const child of children) {
    if (level && child.tagName === level) {
      if (current) sections.push(current);
      current = { title: (child.textContent ?? '').trim() || fallbackTitle, parts: [child.outerHTML] };
    } else {
      current ??= { title: fallbackTitle, parts: [] };
      current.parts.push(child.outerHTML);
    }
  }
  if (current) sections.push(current);
  if (!sections.length) sections.push({ title: fallbackTitle, parts: [escapeHtml(body.textContent ?? '')] });
  return sections.map((s) => ({ title: s.title, html: s.parts.join('') }));
}

export function htmlToSections(html: string, fallbackTitle = 'Document'): { title: string; sections: SectionInput[] } {
  const { title, body } = sanitizeHtml(html);
  return { title, sections: splitHtmlSections(body.innerHTML, title || fallbackTitle) };
}

// ---------- rtf ----------

const RTF_SKIP_DESTINATIONS = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'footnote', 'object', 'themedata', 'datastore', 'latentstyles', 'listtable', 'listoverridetable', 'rsidtbl', 'generator']);

/** Plain text of an RTF document: groups for fonts, colors and pictures are skipped; `\par` ends a paragraph. */
export function rtfToText(rtf: string): string {
  let out = '';
  const stack: Array<{ skip: boolean; uc: number }> = [];
  let skip = false;
  let uc = 1;
  let i = 0;
  while (i < rtf.length) {
    const ch = rtf[i] as string;
    if (ch === '{') {
      stack.push({ skip, uc });
      i++;
      if (rtf[i] === '\\' && rtf[i + 1] === '*') skip = true;
    } else if (ch === '}') {
      const top = stack.pop();
      if (top) {
        skip = top.skip;
        uc = top.uc;
      }
      i++;
    } else if (ch === '\\') {
      const next = rtf[i + 1] ?? '';
      if (/[\\{}]/.test(next)) {
        if (!skip) out += next;
        i += 2;
      } else if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (!skip && /^[0-9a-f]{2}$/i.test(hex)) out += new TextDecoder('windows-1252').decode(new Uint8Array([Number.parseInt(hex, 16)]));
        i += 4;
      } else if (/[a-z]/i.test(next)) {
        const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i));
        const word = (m?.[1] ?? '').toLowerCase();
        const arg = m?.[2] === undefined ? undefined : Number(m[2]);
        i += m?.[0].length ?? 1;
        if (RTF_SKIP_DESTINATIONS.has(word)) skip = true;
        else if (word === 'uc' && arg !== undefined) uc = arg;
        else if (word === 'u' && arg !== undefined) {
          if (!skip) out += String.fromCodePoint(arg < 0 ? arg + 65536 : arg);
          i += uc; // the fallback characters that follow \uN
        } else if (!skip && (word === 'par' || word === 'line' || word === 'sect' || word === 'page')) out += '\n\n';
        else if (!skip && word === 'tab') out += '\t';
        else if (!skip && (word === 'emdash' || word === 'endash')) out += word === 'emdash' ? '—' : '–';
        else if (!skip && (word === 'lquote' || word === 'rquote')) out += '’';
        else if (!skip && (word === 'ldblquote' || word === 'rdblquote')) out += '”';
      } else {
        i += 2;
      }
    } else {
      if (!skip && ch !== '\r' && ch !== '\n') out += ch;
      i++;
    }
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}
