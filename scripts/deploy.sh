#!/bin/sh
# Build, verify and publish dist/ to the nginx host over SSH (rsync), then smoke-test the
# live site and ping IndexNow. This is the by-hand path from a workstation that may reach the
# host; the Deploy workflow instead publishes to the `site` branch, which the host pulls.
#
# Locally the target lives in .env.deploy (git-ignored), never in the repo:
#   cp .env.example .env.deploy && $EDITOR .env.deploy
#   npm run deploy            # or: sh scripts/deploy.sh
# Anything set in the environment wins over .env.deploy, and SKIP_BUILD=1 publishes an
# existing build without building or checking it again.
#
# Settings (the environment wins over .env.deploy):
#   DEPLOY_HOST    user@host for ssh/rsync                                            required
#   DEPLOY_PATH    web root on the host                                               required
#   DEPLOY_OWNER   owner:group applied to uploaded files (needs root over SSH);
#                  empty = leave ownership to the SSH user, who owns the web root  default empty
#   INDEXNOW       1 = tell IndexNow (Bing, Yandex, ...) that the site changed       default 0
#   SKIP_BUILD     1 = publish the existing build without building or checking       default 0
#   DIST           build output directory                                             default dist
set -eu

cd "$(dirname "$0")/.."

# Remember what the caller set, read .env.deploy, then put the caller's values back, so
# `INDEXNOW=0 npm run deploy` and the CI job (no file at all) both behave as expected.
settings="DEPLOY_HOST DEPLOY_PATH DEPLOY_OWNER INDEXNOW SKIP_BUILD DIST"
for v in $settings; do eval "env_$v=\"\${$v-}\""; done
[ -f .env.deploy ] && . ./.env.deploy
for v in $settings; do eval "[ -z \"\$env_$v\" ] || $v=\"\$env_$v\""; done

: "${DEPLOY_HOST:?set DEPLOY_HOST in .env.deploy or the environment}"
: "${DEPLOY_PATH:?set DEPLOY_PATH in .env.deploy or the environment}"
DEPLOY_OWNER="${DEPLOY_OWNER:-}"
INDEXNOW="${INDEXNOW:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
DIST="${DIST:-dist}"
export DIST

if [ "$SKIP_BUILD" = 1 ]; then
  echo "→ publishing the existing $DIST/ (SKIP_BUILD=1)"
else
  echo "→ build + checks"
  node scripts/build.mjs
  node scripts/check.mjs
fi
[ -f "$DIST/sitemap.xml" ] || { echo "$DIST/sitemap.xml is missing: build first" >&2; exit 1; }

echo "→ sync to ${DEPLOY_HOST}:${DEPLOY_PATH}"
# Non-interactive runs (CI=1) must fail on an unknown host key or a passphrase prompt
# instead of hanging.
rsync_ssh="ssh"
[ -n "${CI-}" ] && rsync_ssh="ssh -o BatchMode=yes"
chown_opt=""
[ -n "$DEPLOY_OWNER" ] && chown_opt="--chown=$DEPLOY_OWNER"
# Fingerprinted CSS/JS/search index first so new HTML never references a file that isn't
# there yet, then everything else with --delete. $chown_opt is unquoted on purpose: empty
# means no option at all.
# shellcheck disable=SC2086
rsync -rlt --checksum -e "$rsync_ssh" $chown_opt --chmod=D755,F644 "$DIST/assets/" "$DEPLOY_HOST:$DEPLOY_PATH/assets/"
# shellcheck disable=SC2086
rsync -rlt --checksum --delete -e "$rsync_ssh" $chown_opt --chmod=D755,F644 "$DIST/" "$DEPLOY_HOST:$DEPLOY_PATH/"

sh scripts/smoke-test.sh

if [ "$INDEXNOW" = 1 ]; then
  echo "→ IndexNow"
  node scripts/indexnow.mjs
fi
echo "✓ deployed"
