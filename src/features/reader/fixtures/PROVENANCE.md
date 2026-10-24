# Reader fixtures: provenance

Public-domain files only. Nothing here is copyrighted material. These files are used by the unit tests, the Playwright
tests and the dev-only fixture loader (`import.meta.env.DEV`). They are **not** imported by any production code path;
the build is checked for them (see `../README.md`, "Production guard").

| File | Source | License / status | How it was made |
|---|---|---|---|
| `alice.epub` | https://www.gutenberg.org/ebooks/11.epub3.images (downloaded 2026-10-24) | Public domain (Lewis Carroll, 1865; Project Gutenberg #11, no restrictions on use in the US) | Unmodified download |
| `alice-illustrated.epub` | https://www.gutenberg.org/ebooks/28885.epub3.images (downloaded 2026-10-24) | Public domain (text 1865, Arthur Rackham drawings 1907; Project Gutenberg #28885) | Unmodified download |
| `alice.mobi` | https://www.gutenberg.org/ebooks/11.kindle.images (downloaded 2026-10-24) | Public domain (Project Gutenberg #11) | Unmodified download |
| `alice.txt` | https://www.gutenberg.org/cache/epub/11/pg11.txt (downloaded 2026-10-24) | Public domain (Project Gutenberg #11) | Unmodified download |
| `alice.pdf` | Generated from `alice.txt` (chapters I to IV) | Text public domain; PDF container CC0 | `tools/build_fixtures.py` (reportlab) |
| `alice.fb2` | Generated from `alice.txt` (chapters I to III) | Text public domain; container CC0 | `tools/build_fixtures.py` |
| `alice.docx` | Generated from `alice.txt` (chapters I to III) | Text public domain; container CC0 | `tools/build_fixtures.py` (python-docx) |
| `alice.cbz` | Ten Rackham illustrations from `alice-illustrated.epub` | Public domain (Arthur Rackham, 1907) | `tools/build_fixtures.py` |

The 50 MB PDF used for the open-time test is **not committed**. `tools/make_large_pdf.py` synthesizes it (noisy
full-page scans plus a real text layer from `alice.txt`) so no large binary lives in the repository.

SHA-256 of the committed files:

```
alice-illustrated.epub 69c757719102f175303e7e8b8e508f1466e9aa78ddd9afb05609d00150699b3d
alice.cbz f8438f7bee61753aacbe7cfce2f08b0136f8c94aeb6597d976ffea535cfb6e9a
alice.docx f1c7486e8127fcbf65823b2012db43fd92973f445710cf3648771062fe2d98af
alice.epub 4f81245d31380ac1d6eafb9a321e3691369bc70985736ae4bccf849a4f784036
alice.fb2 93ff8c3b9b99b2c774514885b1b25a5d3c60f2ac94cf60fa9e04295d791a50d1
alice.mobi 1b4222ffdf1862a39d0fae6d42c588f28a34c12ad73cc21c2849fe2646cac3e1
alice.pdf c7d45bebcfa4b19a744d14574786534ef5f6cc5302785cba55de6d3113bf959e
alice.txt 01b38ea4c710a84bc18d0bd41271a5a1a92b94e97b2812f4dece97d4a694725e
```
