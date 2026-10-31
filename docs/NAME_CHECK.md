# Product name verification (2026-10-31)

Owner preference: **Readtide**. This check follows the fallback order in the rename task: Readtide → Homeshelf Reader → InkQuiet → (propose one calm word).

## Chosen name: **InkQuiet**

Readtide and Homeshelf Reader both conflict with existing book/reading products in the same space. **InkQuiet** is the first name in the fallback list with no matching reading-app trademark or store listing found (domain caveat below).

---

## 1. Readtide — **not clear (conflict)**

| Channel | Finding | Evidence |
|--------|---------|----------|
| **US trademark** | Pending **Class 9** application for downloadable e-book/reading mobile apps | Readtide, LLC, US serial **99842854**, filed 2026-05-24, published for opposition 2026-10-20. Goods: downloadable mobile apps for downloading, organizing, and reading electronic books and publications. [Markinton summary](https://markinton.com/trademark/readtide-99842854); verify on [USPTO TSDR](https://tsdr.uspto.gov/) with serial 99842854. |
| **App Store / web product** | Live reading app marketed as Readtide | [readtide.app](https://readtide.app/) — private, ad-free reader; Shore (free) / Ocean (paid) tiers. Direct overlap with this PWA. |
| **Web** | Active site using the Readtide name for fiction reading | [readtide.com](https://readtide.com/) — web novel catalog (contact@readtide.com). |
| **Domains** | Core names taken | `readtide.app`, `readtide.com` in use for reading products. |

**Conclusion:** Likelihood of confusion with an existing reading app and a pending US mark in the same Nice class. Do **not** ship under Readtide without legal review and owner acceptance of risk.

---

## 2. Homeshelf Reader — **not clear (conflict)**

| Channel | Finding | Evidence |
|--------|---------|----------|
| **Google Play / iOS** | **Homeshelf** — home library catalog and reading planner for homeschool families (barcode scan, lending, reading plans) | [Elco Dev product page](https://www.elcodev.com/apps/homeshelf), [Google Play listing preview](https://apppage.net/preview/com.elcodev.homeshelf) (Books & Reference, Sept 2026). |
| **Domains** | `homeshelf.app` hosts a related library tool | [homeshelf.app](https://homeshelf.app/) |
| **US trademark** | No mark found for the exact string "Homeshelf Reader" in this search | — |
| **Related mark** | **ARC BOOKSHELF** (American Reading Company) covers downloadable reading software (different brand) | [USPTO 88700118](https://uspto.report/TM/88700118) |

**Conclusion:** "Homeshelf" is already a book-library app brand; adding "Reader" does not clear confusion in books software.

---

## 3. InkQuiet — **clear enough to adopt**

| Channel | Finding | Evidence |
|--------|---------|----------|
| **App Store / Google Play** | No listing found for **InkQuiet** or **Ink Quiet** as a books/reader app in web search (2026-10-31) | Searches returned unrelated **Inkitt** / **Galatea** reading apps, not InkQuiet. |
| **US trademark** | No USPTO hit for **INKQUIET** as a reading/e-book Class 9 mark in this search | — |
| **Web** | `inkquiet.com` is a generic placeholder template (design agency boilerplate), not a reading product | [inkquiet.com](https://inkquiet.com/) |
| **Domains** | `.com` registered to unrelated placeholder content; no reading app at that URL | Product can use another domain; Cloudflare project URL unchanged per deploy rules. |
| **Phonetic / brand** | Distinct from **Inkitt** (major fiction platform) despite shared "Ink-" prefix | Different spelling and positioning; monitor if marketing near Inkitt. |

**Conclusion:** No direct competitor app or pending reading trademark identified. Suitable for a calm, offline-first reader PWA pending formal clearance before App Store / Play submission.

---

## 4. Alternate one-word name (not needed)

If InkQuiet were blocked, a reasonable calm candidate would be **Stillmark** (still + bookmark; no hits as a reading app in quick search). Not used because InkQuiet cleared first.

---

## Implementation note

User-visible branding in this PR uses **InkQuiet**. Internal identifiers unchanged per task: npm package name `pagenest`, `PageNestDB`, import alias `@pagenest/e2e-port`, backup format id `pagenest-backup`, Cloudflare project URL in `docs/DEPLOY.md`.
