# Live release smoke @ pagenest-42f.pages.dev

360×740 Playwright profiles (`release-smoke-chromium` = Pixel 7, `release-smoke-webkit` = iPhone 14).

Run:

```bash
npm run smoke:live -- https://pagenest-42f.pages.dev/
```

## Deploy `109a37b` smoke (2026-11-01)

Bundle: `main-CaS_SA7T.js` / `engine-foliate-CVVxng76.js`.

| Phase | Chromium | WebKit |
|-------|----------|--------|
| Upgrade | **PASS** | **FAIL** — foliate 240s (“Still opening…”) |
| Core | **PASS** | **FAIL** — foliate 240s |
| OPFS blocked | skip | skip (suite exited) |
| Read-aloud device | not run | not run |
| Read-aloud legacy Piper | not run | not run |

**Root cause (WebKit):** Cloudflare Pages merged the global `/*` `_headers` rule with `/assets/*`, so **CSP and COOP were sent on JavaScript module responses**. WebKit loaded `foliate-view` but book iframe documents stayed empty. Fixed in **`b7ec1fc`** (document headers on HTML routes only). Re-run live smoke after that deploy.

Screenshots in this folder from the Chromium portions of that run; WebKit foliate shots pending green smoke post-`b7ec1fc`.

## Prior merges on this host

| SHA | Notes |
|-----|--------|
| `109a37b` | WebKit foliate bootstrap + build-time sandbox strip (#35) |
| `571119b` | Tap zones (#30), page turn (#31), smoke console guards |
