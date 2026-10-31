#!/usr/bin/env python3
"""Builds the small public-domain reader fixtures from Project Gutenberg #11 (Alice's Adventures in Wonderland).

Dev tooling only: run with a venv that has reportlab, python-docx and pillow. Inputs (alice.epub, alice-illustrated.epub, alice.txt) are
downloaded from gutenberg.org (see ../PROVENANCE.md). Outputs: alice.pdf, alice.fb2, alice.docx, alice.cbz.
The book text and the Tenniel illustrations are public domain; the containers are generated here (CC0).

Usage: python build_fixtures.py <fixtures-dir>
"""
import io
import re
import sys
import textwrap
import zipfile
from pathlib import Path

from docx import Document
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Flowable
from reportlab.lib.units import mm

out = Path(sys.argv[1])
raw = (out / "alice.txt").read_text(encoding="utf-8-sig")
body = raw.split("*** START OF THE PROJECT GUTENBERG EBOOK", 1)[1].split("\n", 1)[1]
body = body.split("*** END OF THE PROJECT GUTENBERG EBOOK", 1)[0]
parts = re.split(r"\n\s*(CHAPTER [IVXL]+\.)\s*\n\s*(.+?)\n", body)
chapters = []  # (heading, title, [paragraphs])
for i in range(1, len(parts) - 2, 3):
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", parts[i + 2]) if p.strip()]
    chapters.append((parts[i], parts[i + 1].strip(), paras))
assert len(chapters) >= 12, len(chapters)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---- PDF: first 4 chapters, with an outline (table of contents) ----
class Outline(Flowable):
    def __init__(self, key, title):
        super().__init__()
        self.key, self.title = key, title

    def wrap(self, w, h):
        return 0, 0

    def draw(self):
        self.canv.bookmarkPage(self.key)
        self.canv.addOutlineEntry(self.title, self.key, 0, 0)


h1 = ParagraphStyle("h1", fontName="Times-Bold", fontSize=20, leading=26, spaceAfter=10, spaceBefore=40)
h2 = ParagraphStyle("h2", fontName="Times-Italic", fontSize=13, leading=18, spaceAfter=16)
p = ParagraphStyle("p", fontName="Times-Roman", fontSize=11, leading=16, spaceAfter=7)
doc = BaseDocTemplate(str(out / "alice.pdf"), pagesize=A5, leftMargin=16 * mm, rightMargin=16 * mm,
                      topMargin=18 * mm, bottomMargin=18 * mm, title="Alice's Adventures in Wonderland",
                      author="Lewis Carroll")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")


def footer(canv, d):
    canv.setFont("Times-Roman", 9)
    canv.drawCentredString(A5[0] / 2, 10 * mm, str(d.page))


doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=footer)])
story = []
for n, (head, title, paras) in enumerate(chapters[:4]):
    if n:
        story.append(PageBreak())
    story += [Outline(f"c{n}", f"{head} {title}"), Paragraph(esc(head), h1), Paragraph(esc(title), h2)]
    story += [Paragraph(esc(t), p) for t in paras]
doc.build(story)

# ---- FB2: first 3 chapters ----
fb = ['<?xml version="1.0" encoding="utf-8"?>',
      '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info>'
      '<genre>children</genre><author><first-name>Lewis</first-name><last-name>Carroll</last-name></author>'
      "<book-title>Alice's Adventures in Wonderland</book-title><lang>en</lang></title-info>"
      '<document-info><author><nickname>InkQuiet fixtures</nickname></author><date>2026-10-24</date>'
      '<id>pagenest-fixture-alice-fb2</id><version>1.0</version></document-info></description><body>']
for head, title, paras in chapters[:3]:
    fb.append(f"<section><title><p>{esc(head)} {esc(title)}</p></title>" + "".join(f"<p>{esc(t)}</p>" for t in paras) + "</section>")
fb.append("</body></FictionBook>")
(out / "alice.fb2").write_text("\n".join(fb), encoding="utf-8")

# ---- DOCX: first 3 chapters with real heading styles ----
d = Document()
d.core_properties.title = "Alice's Adventures in Wonderland"
d.core_properties.author = "Lewis Carroll"
d.add_heading("Alice's Adventures in Wonderland", 0)
for head, title, paras in chapters[:3]:
    d.add_heading(f"{head} {title}", level=1)
    for t in paras:
        d.add_paragraph(t)
d.save(str(out / "alice.docx"))

# ---- CBZ: Rackham illustrations (1907, public domain) from the Gutenberg #28885 EPUB ----
with zipfile.ZipFile(out / "alice-illustrated.epub") as z:
    imgs = sorted((i for i in z.infolist() if re.search(r"_p\d{4}-.*\.(jpg|png)$", i.filename) and i.file_size > 12000),
                  key=lambda i: i.filename.rsplit("_", 1)[1])
    with zipfile.ZipFile(out / "alice.cbz", "w", zipfile.ZIP_STORED) as cb:
        for n, i in enumerate(imgs[:10], 1):
            cb.writestr(f"page-{n:02d}.{i.filename.rsplit('.', 1)[1]}", z.read(i))
print("built:", [f.name for f in sorted(out.iterdir()) if f.is_file()])
