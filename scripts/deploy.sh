#!/bin/sh
# Build, verify and publish dist/ to the nginx host over SSH (rsync), then smoke-test the
# live site and ping IndexNow.
#
# Locally the target lives in .env.deploy (git-ignored), never in the repo:
#   cp .env.example .env.deploy && $EDITOR .env.deploy
#   npm run deploy            # or: sh scripts/deploy.sh
# In CI (.github/workflows/deploy.yml) there is no .env.deploy: the same settings arrive as
# environment variables, and SKIP_BUILD=1 publishes the build the workflow already checked.
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

# The live origin comes from the build itself (robots.txt names the sitemap), so the smoke
# test always checks the URLs this build was made for.
url=$(sed -n 's|^Sitemap: \(.*\)/sitemap\.xml$|\1|p' "$DIST/robots.txt" | head -n 1)
[ -n "$url" ] || url=$(node -e 'import("./src/site.mjs").then(m => console.log(m.site.url))')

echo "→ sync to ${DEPLOY_HOST}:${DEPLOY_PATH}"
# In CI an unknown host key or a passphrase prompt must fail instead of hanging.
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

echo "→ smoke test ${url}"
failed=0
expect() { # expect <status> <url>
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$2") || code=000
  printf '  %s %s\n' "$code" "$2"
  [ "$code" = "$1" ] || failed=1
}
# Every page in the sitemap, then the files that are not pages, then a miss. A for loop
# rather than `while read`: a pipeline would run the loop in a subshell and lose $failed.
# shellcheck disable=SC2013
for loc in $(grep -o '<loc>[^<]*</loc>' "$DIST/sitemap.xml" | sed 's|<loc>||; s|</loc>||'); do
  expect 200 "$loc"
done
for path in /search/ /robots.txt /llms.txt /llms-full.txt /sitemap.xml; do
  expect 200 "${url}${path}"
done
expect 404 "${url}/not-a-page-$(date +%s)-$$/"
[ "$failed" = 0 ] || { echo "smoke test failed" >&2; exit 1; }

if [ "$INDEXNOW" = 1 ]; then
  echo "→ IndexNow"
  node scripts/indexnow.mjs
fi
echo "✓ deployed ${url}"
