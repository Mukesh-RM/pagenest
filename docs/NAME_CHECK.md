# PageNest name check

**Date:** 31 October 2026  
**Scope:** Informal clearance for a **free, MIT-licensed, offline-first reading PWA** (e-books, PDFs, audiobooks, narration). Not legal advice. A trademark attorney and formal USPTO/EUIPO search are still required before App Store / Play listing or federal registration.

## Verdict

**Do not treat “PageNest” as clearly free to use** for this product.

The name is already used by several reading-adjacent apps and an active commercial brand in another category. The closest collision is **PageNest Read** on the App Store — same “PageNest” family, same job (local EPUB/PDF/CBZ reader). That creates **high likelihood of confusion** if this PWA is marketed under “PageNest” on iOS or the web, even though this repo is a separate MIT project.

**Practical recommendation:** Keep “PageNest” as the **internal repo / codename** until counsel clears it, or **rebrand before public launch** using one of the alternatives below (after a fresh search).

## Method

- Web and app-store intelligence (MWM, AppBrain, Chrome Stats, official sites).
- USPTO: no **PageNest** registration surfaced in public search summaries; full wordmark clearance still needed at [tmsearch.uspto.gov](https://tmsearch.uspto.gov/).
- Domains and GitHub org names were not exhaustively WHOIS-checked; treat domain availability as unknown here.

## Findings for “PageNest”

| Source | What it is | Relevance |
| --- | --- | --- |
| [PageNest Read](https://mwm.ai/apps/pagenest-read/6805689420) (Hyoshin Kwak, App Store, Books) | iPhone/iPad reader for EPUB, PDF, Markdown, TXT, ZIP, CBZ; optional PageNest account sync | **Direct conflict** — same category and overlapping features |
| [pagenest.ai](https://pagenest.ai/) (pagenest, Inc.) | AI website builder; Terms claim **pagenest** name, logo, and branding ([terms](https://pagenest.ai/terms/)) | **Different goods**, but active US company asserting brand rights on “pagenest” |
| [pagenest.app](https://pagenest.app/) | “Coming soon” landing | **Same exact name** on the public web |
| Android `com.pagenest.bookvale` ([AppBrain](https://www.appbrain.com/app/pagenest/com.pagenest.bookvale)) | “PageNest” reading **tracker** (not a full reader); removed from Google Play June 2026 | Shows recent third-party use of the exact name in reading |
| This project | PWA at `pagenest-42f.pages.dev`, GitHub `Mukesh-RM/pagenest` | Establishes **your** use, but does not resolve conflicts with earlier store listings or pagenest.ai |

### Trademarks

No confirmed **live US registration for the exact mark “PageNest”** appeared in the secondary sources used for this memo. That does **not** mean the mark is available: pending applications, common-law rights, and international filings may exist. **PageNest Read** and **pagenest, Inc.** may rely on use in commerce even without a registration you can see in a quick search.

### App stores

- **Apple:** “PageNest Read” is the dominant hit for PageNest + books; expect review questions if you ship another “PageNest” reader.
- **Google Play:** A prior “PageNest” listing existed under `com.pagenest.bookvale` (removed); package namespace may still be reserved in practice.

## If you rebrand — three alternatives (lighter initial scan)

Each name below had **no obvious exact-match reading app** in a quick web/store pass on 31 Oct 2026. **Re-run USPTO, EUIPO, App Store, Play, and domain checks before committing.**

| Candidate | Rationale | Caveats spotted |
| --- | --- | --- |
| **InkQuiet** | Suggests calm, private reading; distinct from “PageNest” | [inkquiet.com](https://inkquiet.com/) is a generic services landing (not a reader) — domain may be squatted |
| **Readtide** | Short, readable, “flow” metaphor | [Readtide](https://readtide.app/) is an existing iPhone reading app — similar space, different spelling/branding but audible similarity |
| **Homeshelf** (e.g. “Homeshelf Reader”) | PWA-on-home-screen story; offline library | Many “shelf*” reader names exist (Shelfy, SHELFill, etc.); pick a distinctive compound and check Class 9/42 |

Other directions if those fail clearance: coined compounds (**Pageward Local**, **StillBind**, **Offbind Reader**) or descriptive-plus-coined (**Local Folio PWA**) — always prefer marks that are **not** generic “Reader” alone.

## Next steps before launch

1. Commission or run a **full trademark clearance** (US at minimum if you host on `.com` / US stores).
2. Decide: **rename publicly** vs. **continue as PageNest** with documented risk acceptance.
3. If renaming: update `manifest.webmanifest`, `index.html`, README, Cloudflare project display name, and store assets in one release to avoid split branding.

## References (checked 31 Oct 2026)

- PageNest Read — https://mwm.ai/apps/pagenest-read/6805689420  
- pagenest.ai — https://pagenest.ai/ , https://pagenest.ai/terms/  
- pagenest.app — https://pagenest.app/  
- Android PageNest (removed) — https://www.appbrain.com/app/pagenest/com.pagenest.bookvale  
- USPTO trademark search — https://www.uspto.gov/trademarks/search  
