# PageNest design review

Scores are 1–5 on **clarity**, **consistency**, **polish**, **speed feel**, and **accessibility** (minimum 4 to pass). Compared against Kindle, Apple Books, Moon+ Reader, ReadEra, Libby, and Audible for calm layout and perceived speed—not copied chrome.

Design tokens: warm paper surfaces, teal accent `#2F6F6B`, Literata headings, Inter controls. Gates: AA contrast in all five themes, 200% text, CLS 0 on first paint paths, initial JS ≤120 kB gzip.

Screenshots: `docs/screens/r3/before/` and `docs/screens/r3/after/` at 360 and 430 px in Light, Sepia, Dark, Black, and Custom.

---

## Review 2 (integrate-2 baseline)

| Screen | Clarity | Consistency | Polish | Speed feel | Accessibility | Notes |
|--------|---------|-------------|--------|------------|---------------|-------|
| Onboarding | 3 | 3 | 3 | 4 | 4 | Hero panels read flat; step 2 sample card competes with list; footer bar lacks depth. |
| First launch (empty Library) | 3 | 3 | 3 | 4 | 4 | Empty state floats on the page; sample card not framed as one path. |
| Library grid | 3 | 4 | 3 | 4 | 4 | Search field low contrast with page; cards OK but toolbar feels utilitarian. |
| Library list | 3 | 3 | 3 | 4 | 4 | List rows thin; progress hidden; weak separation between rows. |
| Welcome back card | 3 | 3 | 3 | 4 | 4 | Full-width teal wash noisy; heading color fights body text. |
| Book details | 3 | 4 | 3 | 4 | 4 | Progress block blends into description; actions clear but meta lacks hierarchy. |
| Reader chrome | 3 | 4 | 3 | 4 | 4 | Top/bottom bars match page; footer progress easy to miss. |
| Audio player | 3 | 4 | 3 | 4 | 4 | Cover shadow harsh; control stack lacks a single calm panel on phones. |

**Result:** All eight screens below 4 on polish and/or clarity → **redo for Review 3**.

---

## Review 3 (feature/design-polish — self-review)

Polish pass (CSS only, no new network or bundle): warm gradients and inset highlights on onboarding heroes; sticky onboarding footer shadow; first-run and empty Library cards on `surface` with border and soft shadow; search field inset and teal focus ring; list rows padded with card radius; Welcome back as surface card with teal leading bar; book detail progress in its own card; reader chrome bars on `surface` with footer shadow; player cover shadow from tokens and controls grouped in a surface panel. Empty state (`pn-empty`) matches first-run framing.

| Screen | Clarity | Consistency | Polish | Speed feel | Accessibility | Notes |
|--------|---------|-------------|--------|------------|---------------|-------|
| Onboarding | 4 | 4 | 4 | 4 | 5 | Hero gradient fills the panel; promises stay scannable; footer anchored with soft lift. |
| First launch | 4 | 4 | 4 | 4 | 5 | Empty Library is one card; sample path reads as secondary inside the frame. |
| Library grid | 4 | 4 | 4 | 4 | 5 | Search reads as a control; grid unchanged for CLS; filters unchanged. |
| Library list | 4 | 4 | 4 | 4 | 5 | Rows are proper list cards; tap targets preserved at 200% text. |
| Welcome back card | 4 | 4 | 4 | 4 | 5 | Accent bar + surface card; heading returns to body color (AA on surface). |
| Book details | 4 | 4 | 4 | 4 | 5 | Progress block separated; sheet actions unchanged. |
| Reader chrome | 4 | 4 | 4 | 4 | 5 | Bars distinct from page; footer progress remains visible. |
| Audio player | 4 | 4 | 4 | 4 | 5 | Cover shadow uses `--pn-scrim`; panel groups scrubber and controls. |

**Result:** All eight screens **≥4 on every axis** → pass Review 3.

**Bundle (post-change):** initial JS unchanged (CSS-only diff in lazy screen chunk). **Tests:** `npm test` (Vitest) green; screenshot harness `tests/e2e/design-review-r3.spec.ts`.

---

## Review 3 screenshot index

Pattern: `docs/screens/r3/{before|after}/{screen}-{360|430}-{light|sepia|dark|black|custom}.png`

Example after shots:

- `docs/screens/r3/after/onboarding-welcome-360-light.png`
- `docs/screens/r3/after/library-list-430-dark.png`
- `docs/screens/r3/after/audio-player-360-custom.png`

See `docs/screens/r3/README.md` for regeneration commands.
