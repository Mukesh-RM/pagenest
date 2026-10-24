#!/usr/bin/env bash
# Deploy the built PageNest app (dist/) to Cloudflare Pages (free plan).
#
# Usage (run from the repo root, after merging to main):
#   scripts/deploy.sh              # build, then deploy to production (branch main)
#   scripts/deploy.sh --no-build   # deploy the existing dist/ as is
#   BRANCH=preview scripts/deploy.sh   # deploy a preview of another branch
#
# Branch: an explicit BRANCH env var always wins. Otherwise the current git
# branch is used; on a detached checkout (e.g. a clean checkout of a commit)
# it defaults to the production branch, main.
#
# Credentials are NEVER stored in the repo. The script reads them from the
# environment only:
#   CLOUDFLARE_API_TOKEN   token with "Account > Cloudflare Pages > Edit"
#   CLOUDFLARE_ACCOUNT_ID  optional; looked up from `wrangler whoami` when the
#                          token can see exactly one account
# See docs/DEPLOY.md for how to add them as a GitHub repo secret safely.

set -euo pipefail

PROJECT="pagenest"
PRODUCTION_BRANCH="main"
DIST_DIR="dist"

cd "$(dirname "$0")/.."

build=true
if [ "${1:-}" = "--no-build" ]; then
  build=false
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "error: CLOUDFLARE_API_TOKEN is not set (value is never printed)." >&2
  echo "       See docs/DEPLOY.md." >&2
  exit 1
fi

if [ -z "${BRANCH:-}" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
    BRANCH="$PRODUCTION_BRANCH"
    echo "note: detached checkout; defaulting to production branch '$PRODUCTION_BRANCH'."
  fi
fi
if [ "$BRANCH" != "$PRODUCTION_BRANCH" ]; then
  echo "note: deploying branch '$BRANCH' as a preview (production branch is '$PRODUCTION_BRANCH')."
fi

if [ "$build" = true ]; then
  echo "==> Installing dependencies and building"
  npm ci
  npm run build
fi

if [ ! -d "$DIST_DIR" ] || [ -z "$(ls -A "$DIST_DIR" 2>/dev/null)" ]; then
  echo "error: $DIST_DIR/ is missing or empty; nothing to deploy." >&2
  exit 1
fi

# Resolve the account id from wrangler when it was not provided.
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  CLOUDFLARE_ACCOUNT_ID="$(npx --yes wrangler whoami 2>/dev/null \
    | grep -Eo '[0-9a-f]{32}' | sort -u || true)"
  if [ "$(printf '%s\n' "$CLOUDFLARE_ACCOUNT_ID" | grep -c .)" != "1" ]; then
    echo "error: could not pick a single account; set CLOUDFLARE_ACCOUNT_ID." >&2
    exit 1
  fi
  export CLOUDFLARE_ACCOUNT_ID
fi

echo "==> Deploying $DIST_DIR/ to Cloudflare Pages project '$PROJECT' (branch: $BRANCH)"
export WRANGLER_SEND_METRICS=false
npx --yes wrangler pages deploy "$DIST_DIR" \
  --project-name "$PROJECT" \
  --branch "$BRANCH" \
  --commit-dirty=true
