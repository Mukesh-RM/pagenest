#!/usr/bin/env python3
"""Synthesizes a large "scanned book" style PDF for the 50 MB open-time test. Not committed (too big); the e2e and
perf scripts build it on demand.

Every page carries one full-page noisy JPEG (as a scan would) plus a real text layer taken from Project Gutenberg #11
(public domain) and a page-number footer. The xref table is at the end of the file (not linearized), which is the hard
case for opening quickly.

Usage: python make_large_pdf.py <out.pdf> [target_megabytes=50]
"""
import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

out, target_mb = Path(sys.argv[1]), float(sys.argv[2]) if len(sys.argv) > 2 else 50.0
fixtures = Path(__file__).resolve().parent.parent
raw = (fixtures / "alice.txt").read_text(encoding="utf-8-sig")
body = raw.split("*** START OF THE PROJECT GUTENBERG EBOOK", 1)[1].split("\n", 1)[1]
words = body.split()

rng = np.random.default_rng(11)
w, h = 1240, 1754  # A4 at 150 dpi


def scan_jpeg():
    # smooth paper tone plus heavy grain: compresses poorly, like a real scan
    base = np.linspace(225, 245, h, dtype=np.float32)[:, None] * np.ones((1, w), dtype=np.float32)
    grain = rng.normal(0, 38, (h, w)).astype(np.float32)
    px = np.clip(base + grain, 0, 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(px, "L").save(buf, "JPEG", quality=85)
    return buf.getvalue()


pages = 0
total = 0
c = canvas.Canvas(str(out), pagesize=A4, pageCompression=1)
c.setTitle("InkQuiet large PDF fixture")
c.setAuthor("InkQuiet fixtures (generated)")
cursor = 0
while True:
    jpg = scan_jpeg()
    c.drawImage(ImageReader(io.BytesIO(jpg)), 0, 0, width=A4[0], height=A4[1])
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Times-Roman", 11)
    y = A4[1] - 60
    line = []
    for _ in range(46):
        line = words[cursor:cursor + 11]
        cursor = (cursor + 11) % (len(words) - 12)
        c.drawString(60, y, " ".join(line))
        y -= 15
    c.drawCentredString(A4[0] / 2, 30, str(pages + 1))
    if pages % 10 == 0:
        c.bookmarkPage(f"p{pages}")
        c.addOutlineEntry(f"Section {pages // 10 + 1}", f"p{pages}", 0, 0)
    c.showPage()
    pages += 1
    total += int(len(jpg) * 1.267) + 3000  # reportlab re-flates grey JPEGs (measured)
    if total / 1e6 >= target_mb:
        break
c.save()
size = out.stat().st_size
print(f"{out} pages={pages} size={size / 1e6:.1f} MB")
