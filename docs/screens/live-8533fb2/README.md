# Live feature shots — `8533fb2`

Capture after deploy with:

```bash
PAGENEST_LIVE_SHOTS_DIR=docs/screens/live-8533fb2 \
PAGENEST_SMOKE_LIVE=1 \
npx playwright test e2e/live-22cde07-feature-shots.spec.ts \
  --project=release-smoke-chromium --project=release-smoke-webkit
```

(Run from `tests/` with `PAGENEST_BASE_URL` set to the deployed origin.)

Includes the opaque **Word lookup** bottom sheet (shot 06) and **drive mode** dark player (shot 07).
