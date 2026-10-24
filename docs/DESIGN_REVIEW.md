# Design review 1: `feature/ui-redesign` (7026e5f)

Reviewer: PageNest Design Reviewer. Date: 2026-10-24 (Asia/Calcutta).

## How this was scored

- Five dimensions, 1 to 5: clarity, consistency, polish, speed feel, accessibility.
- A screen's **overall score is its lowest dimension**. Overall 4 or 5 is approved. Under 4 goes back to the owner.
- Evidence: the 93 gallery screenshots in `/workspace/pn-redesign-shots` (430 and 360 px, Light, Dark, Black, Sepia, 200% text, reduced motion, 1024, 1280 and 1440 px), the source on the branch, and my own captures of the **real running app** (onboarding, Settings, Stats, Library) at 430 and 360 px in Light and Dark.
- Speed feel is judged from the code (skeletons, FLIP, rAF sheet drag) and one probe (tab switch took 13 to 24 ms in the real app). Lighthouse and 60 fps were **not measured** here; QA owns those gates.
- Benchmark: ReadEra, Moon+ Reader, Kindle, Apple Books, Google Play Books, Kobo, Libby, Audible, Pocket Casts. Notes in `/workspace/pn-review-notes/readera.md`. No branding, icons or layouts are to be copied.

## Score table

| Screen | Clarity | Consistency | Polish | Speed feel | A11y | Overall | Verdict |
|---|---|---|---|---|---|---|---|
| Library (grid, resume card, loading, empty, error) | 4 | 4 | 3 | 4 | 4 | **3** | Redo |
| Book detail (sheet and laptop dialog) | 4 | 4 | 3 | 4 | 4 | **3** | Redo |
| Reader (Light, Dark, Sepia, Black, laptop) | 4 | 5 | 4 | 4 | 4 | **4** | Approved |
| Reader Aa sheet | 3 | 4 | 4 | 4 | 4 | **3** | Redo |
| Audio player | 4 | 3 | 4 | 3 | 4 | **3** | Redo |
| Mini-player | 3 | 3 | 4 | 4 | 4 | **3** | Redo |
| Voice step 1 ("Pick a voice") | 4 | 4 | 3 | 3 | 4 | **3** | Redo |
| Onboarding (real app) | 3 | 2 | 2 | 3 | 4 | **2** | Redo |
| Settings (real app) | 3 | 3 | 3 | 4 | 3 | **3** | Redo |
| Errors | 3 | 4 | 4 | 4 | 4 | **3** | Redo |
| Finished-book moment | 4 | 4 | 3 | 4 | 4 | **3** | Redo |
| Empty states | 4 | 3 | 4 | 4 | 4 | **3** | Redo |

Approved shots are in `docs/screens` (Reader only).

## Best competitor per screen, and where we stand

| Screen | Best competitor | We do better | We do worse |
|---|---|---|---|
| Library | Apple Books (Continue row), ReadEra (dense, instant) | Per-card progress, filter chips, "Welcome back, chapter 7" card, offline promise, tinted covers | No sort or grid/list switch visible (ReadEra has both); lone "…" line on generated covers |
| Book detail | Apple Books, Kobo | Resume-aware buttons (Continue reading / Keep listening), time and narrator at a glance | Remove sits right above the main actions; laptop progress bar is clipped |
| Reader | Kindle, Apple Books | Calm chrome, real hyphenation, four first-class themes, comfortable line length on laptop | No time left in chapter or page position on phone (Kindle shows it); tiny progress caption at laptop |
| Aa sheet | Apple Books themes panel | Live preview, page-colour chips | Two unlabeled option rows; no brightness control |
| Audio player | Pocket Casts, Libby | "4 h 28 min left at 1.25×" is clearer than either; tinted cover | No FLIP from cover; Black theme is not black; 15 and 30 labels are tiny |
| Mini-player | Apple Books, Audible | Progress hairline, chapter line | Ambiguous replay icon, outline play differs from the full player |
| Voice step 1 | Libby (setup) | Honest size and offline labels | Next floats mid-screen; selected row styled differently |
| Onboarding | Libby, ReadEra (no sign-up, straight in) | "No account, no ads, no tracking" copy is excellent | Text-only screens with a huge empty area; says books arrive "in the next release" |
| Settings | Apple Books | Theme previews, plain words | Flat list, unclear selected state, dense Install help block |
| Errors | Libby | Plain-word titles and copy | Try again on errors that cannot be retried |
| Finished moment | Kobo (stats moment) | Time spent, kind tone | Static, no moment; small cover |
| Empty states | Libby | Calm copy, "Add books" action | Gallery illustrations differ from the real app's icon circles; gallery shows placeholder copy |

## Checks requested by Casey

- **Cover tint**: present on Book detail and the Audio player and legible in Light, Dark and Sepia. **Fails on Black**: the player turns a slate teal instead of true black, so Black is not first-class there.
- **Shared transition (FLIP grow)**: implemented for cover to Book detail only (`BookDetailSheet.tsx`). **Missing** for cover to player and for mini-player to full player. Reduced motion is respected (`playFlip` skips).
- **Dark and Black as first-class**: Library, Reader and Aa sheet are good. Player (Black tint) and the Black Aa sheet (grey sheet instead of black) are not.
- **Long title**: wraps on Book detail and truncates with an ellipsis on cards; fine. Cover art itself shows a lone "…" line (polish bug).
- **Missing cover**: not shown in any capture. The sample set has no book without a cover, so this is **not verified**.
- **2-line author**: truncates cleanly under the card; the author line printed on the cover also clips ("IMANI…"). Needs a fix.
- **0% and 100%**: 100% shows only in the Finished moment. A card at 0% (Field Notes) shows an empty bar; no "New" cue. Acceptable, not great.
- **200% text**: Library works but the search placeholder clips ("Search titles and aut"); chips scroll. Player and Aa sheet hold up.
- **360 px**: no overflow. The filter row cuts "Finished" with no fade to signal scrolling.
- **Laptop 1024, 1280, 1440**: sidebar and a five-column grid work well. The Reader column is a good width. Player leaves a lot of blank space.
- **Console errors**: none on the real app at 430 and 360 in Light and Dark.
- **Gallery is not the app**: the real app still shows the old empty Library ("Adding files arrives in the next update"), sans-serif page titles (the gallery uses serif) and plain onboarding. The redesigned screens are not wired into the shipped routes yet, so the 30-second first-book rule cannot be tested.

## Redo list (priority order)

| # | Priority | Owner | Fix |
|---|---|---|---|
| 1 | High | UI/UX Designer with Architect | Wire the redesigned Library, Detail, Player and Mini-player into the real routes, and use the same serif page titles everywhere. Today the real app does not match the gallery. |
| 2 | High | UI/UX Designer | Onboarding: add the designed icon, real illustration or a sample book, bottom-anchored actions, and remove "arrives in the next release". The first book must open in 30 s without a sign-up. |
| 3 | High | UI/UX Designer | Black theme: the player tint must keep a true black surface. The Black Aa sheet should be black, not grey. |
| 4 | High | UI/UX Designer | Add the FLIP cover grow for cover to player and mini-player to player. |
| 5 | Medium | UI/UX Designer | Book detail: fix the clipped progress bar in the laptop dialog. Move Remove out of the main action area into a menu, with the existing confirm. |
| 6 | Medium | UI/UX Designer | Generated covers: clamp the title without a lone "…" line, and fix the clipped author on the cover. |
| 7 | Medium | UI/UX Designer | Aa sheet: label the two spacing rows (Line spacing, Margins); consider a brightness slider. |
| 8 | Medium | UI/UX Designer | Mini-player: make the back-15 icon unmistakable, with a filled play to match the full player. |
| 9 | Medium | UI/UX Designer | Errors: show Try again only where retry can work. DRM, damaged and unsupported files get Dismiss and a help line. |
| 10 | Medium | UI/UX Designer with Reader | Reader on phone: add a quiet "time left in chapter" line. |
| 11 | Low | UI/UX Designer | Voice step 1: pin Next to the bottom, match the selected row's play button, shorten the Clara description. |
| 12 | Low | UI/UX Designer | Settings: group into cards, show a clear selected state on the theme cards, shorten the Install help text. |
| 13 | Low | UI/UX Designer | Finished moment: add a short entrance and a larger cover. Library: add sort and a grid/list switch, and a fade at the end of the filter row. |
| 14 | Low | UI/UX Designer | Player: tidy the 15 and 30 labels and the empty area on phone; 200% text: do not clip the search placeholder. |
| 15 | Low | QA | Run Lighthouse and a 60 fps scroll check on the real app, and add a missing-cover book to the sample data. |

## Approved

Reader at 430 px in Light, Dark, Sepia and Black, and at 1440 px in Dark. See `docs/screens`.
