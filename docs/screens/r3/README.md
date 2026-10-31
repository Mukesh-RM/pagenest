# Design Review 3 screenshots

Captured at **360 px** and **430 px** width in all five app themes (Light, Sepia, Dark, Black, Custom).

| Folder | When |
|--------|------|
| `before/` | `feature/integrate-2` baseline before the Review 3 polish pass |
| `after/` | Same flows after `feature/design-polish` |

File names: `{screen}-{width}-{theme}.png`

Screens: `onboarding-welcome`, `onboarding-home`, `first-launch`, `library-grid`, `library-list`, `welcome-back`, `book-detail`, `reader-chrome`, `audio-player`.

Regenerate (preview on port 4173):

```bash
cd /workspace && VITE_PN_SEED_AUDIO=1 npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort
cd tests
PAGENEST_BASE_URL=http://127.0.0.1:4173/ DESIGN_R3_PHASE=before npm test -- e2e/design-review-r3.spec.ts --project=chromium-mobile
# rebuild after CSS changes, restart preview, then:
PAGENEST_BASE_URL=http://127.0.0.1:4173/ DESIGN_R3_PHASE=after npm test -- e2e/design-review-r3.spec.ts --project=chromium-mobile
```
