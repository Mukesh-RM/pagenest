# Design review 2: real app on `feature/integrate-1` (b6f00a0)

Reviewer: PageNest Design Reviewer. Date: 2026-10-24 (Asia/Calcutta). Review 1 (gallery build) is on branch `feature/design-review-1`.

## Method

- Production build served with `vite preview`, fresh browser profile, Chromium. About 300 captures at 360, 430, 1024 and 1440 px in Light and Dark, Black and Sepia for Reader and Player, 200% text, reduced motion, seeded edge cases (long title, no cover, 2-line author, 0% and 100%), and 5,000 and 10,000 book libraries.
- Overall score is the **lowest of the five dimensions**. 4 or more is approved; under 4 goes back to the owner.
- Measured this time (Chromium, 4x CPU throttle unless noted): Lighthouse 11.7.1 mobile, 3 runs each; scroll frame times; tap-to-paint latency; layout shift; offline reload; focus order.
- I viewed the approved and the flagged screenshots myself. Other theme or width variants of the same screen were captured but not each inspected.

## Measured results

| Check | Result | Bar | Verdict |
|---|---|---|---|
| Lighthouse, first launch (root) | Perf **77**, A11y 97, Best practices 100, PWA 100. LCP 4.3 s, FCP 3.6 s, TBT 9 to 35 ms, CLS 0 | 90+ | **Perf fails** |
| Lighthouse, Library after onboarding | Perf 91, A11y 100, BP 100, PWA 100. LCP 0.13 s, TBT under 20 ms, **CLS 0.19** | 90+, CLS under 0.1 | Scores pass; **CLS fails** |
| Scroll, scripted scroll, 4x CPU, 10,000 books | 60 fps, p95 frame 16.7 ms, no frame over 20 ms, no long tasks | 60 fps | Pass |
| Scroll by touch gesture | Page did not move in the harness (0 px), so no valid number | n/a | Not measured |
| Tap to paint, 1x CPU | tab switch p50 80 ms, p95 97; open book p50 80, p95 96; Aa sheet p50 63 | under 100 ms | Pass |
| Tap to paint, 4x CPU | tab switch p95 **131 ms**; open book p95 **109 ms**; Aa sheet p95 79 | under 100 ms | Marginal on slow phones |
| Library first card | about 0.9 s wall, FCP about 0.14 s, no layout shift in the harness | none | Pass |
| Offline after first load | Library, book open, all tabs and deep link work | works offline | Pass |
| Console errors | none in any flow | zero | Pass |
| Keyboard | Tab reaches Keep reading, Not now, Add, search, Sort, List, Select; focus ring is a visible 2 px outline | visible focus | Pass |
| First launch to first book | **1 tap**, 0.6 to 1.2 s, then lands on a **placeholder** ("The reader arrives in a later release") | first book within 30 s | Fails in practice |

The two CLS numbers disagree (Lighthouse 0.19, my probe 0). Lighthouse is the gate, so treat 0.19 as real. The likely cause is the Welcome back card or the one-time hint appearing above the Library title after load.

## Score table

| Screen | Clarity | Consistency | Polish | Speed feel | A11y | Overall | Verdict |
|---|---|---|---|---|---|---|---|
| Onboarding (3 steps, sample book card) | 4 | 4 | 3 | 4 | 4 | **3** | Redo |
| First launch to first book | 2 | 3 | 3 | 5 | 4 | **2** | Redo |
| Library, grid | 4 | 3 | 3 | 4 | 4 | **3** | Redo |
| Library, list view | 4 | 3 | 2 | 4 | 4 | **2** | Redo |
| Library, empty | 4 | 4 | 4 | 4 | 4 | **4** | Approved |
| Welcome back card | 3 | 3 | 3 | 4 | 4 | **3** | Redo |
| Book details sheet | 3 | 4 | 4 | 4 | 4 | **3** | Redo |
| Reader | 2 | 3 | 3 | 4 | 4 | **2** | Redo |
| Reader Aa sheet (Light, Black) | 4 | 4 | 4 | 4 | 4 | **4** | Approved |
| Audio player | 2 | 3 | 3 | 4 | 4 | **2** | Redo |
| Mini-player | not in the build | | | | | n/a | Missing |
| Collections (empty) | 4 | 4 | 4 | 4 | 4 | **4** | Approved |
| Stats (empty) | 4 | 4 | 4 | 4 | 4 | **4** | Approved |
| Settings, with Custom theme | 4 | 4 | 4 | 4 | 4 | **4** | Approved |
| Install help sheet | 4 | 4 | 4 | 4 | 4 | **4** | Approved |
| iOS install sheet, update snackbar | not individually inspected | | | | | n/a | Re-check |

## Best competitor per screen

| Screen | Best competitor | We do better | We do worse |
|---|---|---|---|
| Onboarding and first book | ReadEra (straight in), Libby | One-tap sample book in about 1 s, plain "no account, no ads, no tracking" promise, nothing to sign up for | Text-only steps with a half-empty screen; the book then opens to a placeholder, where ReadEra opens text instantly |
| Library | Apple Books (Continue row, quiet cards), ReadEra (dense, instant) | Sort, grid and list, select mode, filter chips, format badges, 10,000 books at 60 fps, offline | Title printed twice on generated covers; cover art is cropped; list thumbnails glitch; resume card shown at 0% |
| Reader | Kindle, Apple Books | Chrome and Aa sheet are calm and complete | There is no book text yet, so it cannot be compared |
| Aa sheet | Apple Books | Live preview, page colour chips, now labeled spacing and margins, and a black Black sheet | No brightness control |
| Player | Pocket Casts, Libby | n/a, placeholder | No controls, no scrubber, no time left |
| Collections, Stats | Libby, Apple Books | Calm copy, no streak pressure | Nothing to compare until they have content |
| Settings | Apple Books | Theme previews, AA-checked Custom theme, text size, storage, install help in one plain page | No sections or cards; Install help text is dense |
| Install help | Libby | Step icons, one clear action, offline reassurance | Minor: "work offline. Ready to use offline." repeats itself |

## Checks requested

- **Cover tint**: not shown anywhere in the real app (no player, no detail sheet with a cover).
- **Shared transition (FLIP)**: not present in the real app yet.
- **Dark and Black first-class**: Library, Settings, Aa sheet and Player are all properly dark and black now. The Black Aa sheet and Black player are true black (fixed since review 1).
- **Long title**: grid card truncates to 2 lines with an ellipsis, and the generated cover clamps with an ellipsis at 5 lines. Acceptable.
- **No cover**: generated colour tile with initials works well.
- **2-line author**: clips to one line on cards; the full text is not reachable on the card.
- **0% and 100%**: 100% shows a heart and check with a "100%" label in list view. A 0% book is treated as "Welcome back, You were on 0%", which is wrong.
- **200% text**: Library holds; the search placeholder, "Reading now" chip and card title clip, and "The Tale of Peter…" truncates after one line. Mostly acceptable.
- **360 px**: no overflow. Chip row scrolls without a fade hint.
- **Laptop 1024, 1440**: sidebar plus up to seven columns look good, and the resume card spans the width.

## Redo list, priority order

| # | Priority | Owner | Fix |
|---|---|---|---|
| 1 | High | Reader | The reader shows a placeholder. Real text must render for the sample book so "first book in 1 tap" is true. Until then the main promise fails. |
| 2 | High | Audio | The player is a placeholder. It needs the full player and a mini-player, with cover tint and the FLIP grow from the cover. |
| 3 | High | Shell and PWA, Architect | First-launch Lighthouse performance is 77 (LCP 4.3 s on simulated slow 4G). Cut the first-paint cost (fonts, bundle, service-worker first load). Target 90+. |
| 4 | High | Library with UI/UX | Library layout shift: Lighthouse CLS 0.19. Reserve space for the Welcome back card and hints, or place them in a fixed slot. |
| 5 | High | Library with UI/UX | List view thumbnails: the generated cover text overlaps in the 40 px tile ("SB", "B" garbled). Show initials only at that size. |
| 6 | Medium | Library | Do not show Welcome back for a book at 0%. Fix the wording ("You were on 0% of Not Started Yet"). Put the card below the page title or in a fixed slot. |
| 7 | Medium | Library with UI/UX | Generated covers print the title twice (on the cover and below the card) and the initials collide with the heart and select badges. Use the UI/UX card with one title. |
| 8 | Medium | Library | Real covers are cropped (Peter Rabbit loses its top line). Fit the whole cover on a fixed 2:3 frame with a soft background. |
| 9 | Medium | Library | Book details is only an edit form. The designed detail sheet (cover, progress, narrator, Continue, Keep listening) is missing. |
| 10 | Medium | UI/UX Designer | Onboarding and first-run: add the designed icon or illustration, fill the empty lower half, and make the sample book card a visual card with the cover. |
| 11 | Medium | Shell and PWA | Tap latency on slow phones: tab switch p95 131 ms and book open p95 109 ms at 4x CPU. Aim under 100 ms. |
| 12 | Low | Library | Search placeholder clips ("Search title, author or"). Shorten to "Search". Add a fade at the end of the filter chips. |
| 13 | Low | UI/UX Designer | Settings: group into cards. Install help copy: remove the repeated "offline" sentence. |
| 14 | Low | QA | Make touch-scroll measurement work in the harness. Re-run Lighthouse with a mid-size library. |

## Approved screenshots

In `docs/screens` (prefix `r2-`): empty Library (Light), Reader Aa sheet (Light, Black), Collections (Light), Stats (Dark), Settings (Light) and Settings with Custom theme, Install help sheet (Light). Evidence JSON: `docs/review-evidence/`.

## Re-check after the next changes

1. Reader renders real text; first-launch tap count and time to text (target 1 tap, under 5 s).
2. Player and mini-player exist; check Black tint, FLIP grow and reduced motion.
3. Library built on the UI/UX card and sheet components: re-score grid, list, resume card, detail sheet, at 360, 430, 1024 and 1440 in Light and Dark; check the CLS drops under 0.1.
4. Lighthouse first-launch Performance 90+ and Library CLS under 0.1.
5. UI/UX Onboarding and Settings versions: re-score both, and re-test 200% text.
6. Tap latency at 4x CPU under 100 ms.
