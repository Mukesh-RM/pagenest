# Deploying PageNest

PageNest is a static PWA hosted on Cloudflare Pages (free plan).

- Pages project: `pagenest` (production branch `main`)
- Live URL: <https://pagenest-42f.pages.dev> (free `*.pages.dev` address; deployed and serving production)
- No server, database or login; only the built `dist/` folder is uploaded.

## CI

`.github/workflows/ci.yml` runs on every pull request and push: `npm ci`, lint,
type check, unit tests, build, then Playwright smoke tests (Chromium only) once
`playwright.config.*` and a `test:e2e` script exist. Missing npm scripts are
skipped (`--if-present`). Superseded runs on pull requests and other branches are cancelled (runs on `main` are never cancelled; each main push has its own concurrency group keyed on the commit SHA) and npm and Playwright
downloads are cached, to stay inside the free GitHub Actions allowance.
E2E port and base URL variables for CI jobs are documented in [TESTING.md](./TESTING.md).
CI never needs Cloudflare credentials and never deploys.

## Manual deploy (after merging to `main`)

```bash
git checkout main && git pull
export CLOUDFLARE_API_TOKEN=...   # type it into your shell; never commit it
scripts/deploy.sh                 # builds, then deploys dist/ to production
scripts/deploy.sh --no-build      # deploy the existing dist/
```

On a detached checkout (for example a fresh CI-style clone at a commit) git
reports the branch as `HEAD`, so tell the script which branch this is:

```bash
BRANCH=main scripts/deploy.sh
```

The `main` deploy goes to production at <https://pagenest-42f.pages.dev>. Each
deployment also gets its own `https://<id>.pagenest-42f.pages.dev` URL.

`CLOUDFLARE_ACCOUNT_ID` is optional; the script reads it from `wrangler whoami`
when the token sees exactly one account. The token needs only
**Account > Cloudflare Pages > Edit**.

## Adding a repo secret without exposing it

Secrets live in GitHub, never in the repo, workflow files or logs.

1. Create a scoped token at <https://dash.cloudflare.com/profile/api-tokens>
   with only "Account > Cloudflare Pages > Edit".
2. Add it from a terminal so the value never appears in history or output:

   ```bash
   gh secret set CLOUDFLARE_API_TOKEN --repo Mukesh-RM/pagenest
   # paste the value at the prompt (input is hidden), then press Enter
   ```

   or via GitHub: Settings > Secrets and variables > Actions > New repository secret.
3. A future deploy job would reference it as `${{ secrets.CLOUDFLARE_API_TOKEN }}`
   in the step's `env:` block. GitHub masks secret values in logs. Do not echo
   it, do not use `set -x`, and do not expose secrets to pull requests from forks.

No deploy job exists yet; deploys are manual until Casey asks for automation.

## Offline cache of the Reader engines (Decision 15)

The service worker's precache holds the app shell, the import worker and the import parsers. The Reader's large lazy engines are not in it:
`assets/engine-pdf-*.js`, `assets/engine-foliate-*.js`, `assets/docx-core-*.js`, `assets/docx.worker-*.js` and `assets/pdf.worker*.mjs` are excluded with
`globIgnores` in `vite.config.ts` (a test fails if the import worker, a parser or any `.js` as a whole is ignored by accident, and the 1 MB
file cap in `vite.config.ts` is unchanged). They are cached at runtime, cache first, so a format works offline after it has opened once.

The rule is in `src/sw/sw.ts` (added by the Reader, approved by Casey), after the precache route and the font rule: same-origin files under `/assets/` that are scripts,
workers, `.mjs` or `.epub` go cache first into the `pn-engines-v1` cache. Precached files are answered by the precache route registered first, so this
rule only sees files that are not precached. Hashed names make old entries unreachable after an update, so the worker should prune `pn-engines-*` entries
that no current page asks for (open item for Shell and PWA).

The app warms the cache so the first sample book or first PDF works offline too: `src/app/offline-warm.ts` runs 5 s after the Library is drawn,
when the browser is idle, only when a service worker controls the page, the device is online and has not asked to save data, once per page load.
`src/app/offline-assets.ts` lists what is warmed (the sample book today; add the engines as they ship).
